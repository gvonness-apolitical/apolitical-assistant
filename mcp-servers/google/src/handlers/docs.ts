import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';
import {
  parseMarkdownContent,
  findTableCellIndices,
  generateTableCellRequests,
  type GoogleDocsDocument,
} from '../utils/markdown-to-gdocs.js';

// ==================== ZOD SCHEMAS ====================

export const DocsGetContentSchema = z.object({
  documentId: z.string().describe('The Google Doc ID'),
});

export const DocsGetCommentsSchema = z.object({
  documentId: z.string().describe('The Google Doc ID'),
  includeResolved: z.boolean().optional().default(false).describe('Include resolved comments'),
});

export const DocsCreateSchema = z.object({
  title: z.string().describe('The title for the new document'),
  content: z
    .string()
    .optional()
    .describe(
      'Initial markdown content (supports: # headings, **bold**, *italic*, - bullets, 1. numbered lists, tables)'
    ),
});

export const DocsAddCommentSchema = z.object({
  documentId: z.string().describe('The Google Doc ID'),
  content: z.string().describe('The comment text to add'),
});

export const DocsUpdateSchema = z.object({
  documentId: z.string().describe('The Google Doc ID to update'),
  content: z
    .string()
    .describe(
      'Markdown content (supports: # headings, **bold**, *italic*, - bullets, 1. numbered lists, tables, code blocks)'
    ),
  append: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, append content instead of replacing'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleDocsGetContent(
  args: z.infer<typeof DocsGetContentSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://docs.googleapis.com/v1/documents/${args.documentId}`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Docs API error: ${response.status}`);

  const doc = (await response.json()) as {
    title: string;
    body: {
      content: Array<{
        paragraph?: {
          paragraphStyle?: { namedStyleType?: string };
          bullet?: { listId: string; nestingLevel?: number };
          elements: Array<{
            textRun?: {
              content: string;
              textStyle?: {
                bold?: boolean;
                italic?: boolean;
                strikethrough?: boolean;
                underline?: boolean;
                link?: { url: string };
              };
            };
          }>;
        };
        table?: {
          rows: number;
          columns: number;
          tableRows: Array<{
            tableCells: Array<{
              content: Array<{
                paragraph?: {
                  elements: Array<{
                    textRun?: { content: string };
                  }>;
                };
              }>;
            }>;
          }>;
        };
      }>;
    };
    lists?: Record<
      string,
      {
        listProperties: {
          nestingLevels: Array<{ glyphType?: string; glyphFormat?: string }>;
        };
      }
    >;
  };

  const lines: string[] = [];
  const listCounters: Record<string, number[]> = {};

  for (const block of doc.body.content) {
    if (block.table) {
      // Process table
      const tableRows: string[][] = [];
      for (const row of block.table.tableRows) {
        const cells: string[] = [];
        for (const cell of row.tableCells) {
          const cellText = cell.content
            .map((c) => c.paragraph?.elements.map((el) => el.textRun?.content || '').join('') || '')
            .join('')
            .trim();
          cells.push(cellText);
        }
        tableRows.push(cells);
      }

      if (tableRows.length > 0) {
        // Header row
        const headerRow = tableRows[0]!;
        lines.push('| ' + headerRow.join(' | ') + ' |');
        lines.push('| ' + headerRow.map(() => '---').join(' | ') + ' |');
        // Data rows
        for (let i = 1; i < tableRows.length; i++) {
          lines.push('| ' + tableRows[i]!.join(' | ') + ' |');
        }
        lines.push('');
      }
      continue;
    }

    if (!block.paragraph) continue;

    const para = block.paragraph;
    const styleType = para.paragraphStyle?.namedStyleType;

    // Build text with inline formatting
    let text = '';
    for (const el of para.elements) {
      if (!el.textRun) continue;
      let content = el.textRun.content;
      const style = el.textRun.textStyle;

      if (style) {
        const trimmed = content.replace(/\n$/, '');
        const trailing = content.endsWith('\n') ? '\n' : '';

        if (style.link?.url) {
          content = `[${trimmed}](${style.link.url})${trailing}`;
        } else if (style.bold && style.italic) {
          content = `***${trimmed}***${trailing}`;
        } else if (style.bold) {
          content = `**${trimmed}**${trailing}`;
        } else if (style.italic) {
          content = `*${trimmed}*${trailing}`;
        } else if (style.strikethrough) {
          content = `~~${trimmed}~~${trailing}`;
        }
      }

      text += content;
    }

    // Remove trailing newline
    text = text.replace(/\n$/, '');

    // Apply heading prefixes
    if (styleType === 'HEADING_1') {
      lines.push(`# ${text}`);
    } else if (styleType === 'HEADING_2') {
      lines.push(`## ${text}`);
    } else if (styleType === 'HEADING_3') {
      lines.push(`### ${text}`);
    } else if (styleType === 'HEADING_4') {
      lines.push(`#### ${text}`);
    } else if (styleType === 'HEADING_5') {
      lines.push(`##### ${text}`);
    } else if (styleType === 'HEADING_6') {
      lines.push(`###### ${text}`);
    } else if (para.bullet) {
      const listId = para.bullet.listId;
      const level = para.bullet.nestingLevel || 0;
      const indent = '  '.repeat(level);

      // Check if ordered list
      const listDef = doc.lists?.[listId];
      const nestingLevel = listDef?.listProperties?.nestingLevels?.[level];
      const isOrdered =
        nestingLevel?.glyphType === 'DECIMAL' || nestingLevel?.glyphFormat === '%0.';

      if (isOrdered) {
        if (!listCounters[listId]) listCounters[listId] = [];
        if (!listCounters[listId][level]) listCounters[listId][level] = 0;
        listCounters[listId][level]++;
        lines.push(`${indent}${listCounters[listId][level]}. ${text}`);
      } else {
        lines.push(`${indent}- ${text}`);
      }
    } else {
      lines.push(text);
    }
  }

  return {
    title: doc.title,
    content: lines.join('\n'),
  };
}

export async function handleDocsGetComments(
  args: z.infer<typeof DocsGetCommentsSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Use Drive API comments endpoint
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${args.documentId}/comments`);
  url.searchParams.set('fields', 'comments(id,content,author,createdTime,resolved,replies)');

  const response = await auth.fetch(url.toString());
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`);

  const data = (await response.json()) as {
    comments: Array<{
      id: string;
      content: string;
      author: { displayName: string; emailAddress?: string };
      createdTime: string;
      resolved: boolean;
      replies?: Array<{
        content: string;
        author: { displayName: string; emailAddress?: string };
        createdTime: string;
      }>;
    }>;
  };

  let comments = data.comments || [];
  if (!args.includeResolved) {
    comments = comments.filter((c) => !c.resolved);
  }

  return {
    documentId: args.documentId,
    commentCount: comments.length,
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.author.displayName,
      authorEmail: c.author.emailAddress,
      createdTime: c.createdTime,
      resolved: c.resolved,
      replies: c.replies?.map((r) => ({
        content: r.content,
        author: r.author.displayName,
        createdTime: r.createdTime,
      })),
    })),
  };
}

export async function handleDocsCreate(
  args: z.infer<typeof DocsCreateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Step 1: Create the document with the title
  const createUrl = 'https://docs.googleapis.com/v1/documents';
  const createResponse = await auth.fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: args.title,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Docs API error creating document: ${createResponse.status} - ${error}`);
  }

  const doc = (await createResponse.json()) as {
    documentId: string;
    title: string;
  };

  // Step 2: If content provided, insert it with markdown formatting
  if (args.content && args.content.trim()) {
    const parsed = parseMarkdownContent(args.content, 1);

    const updateUrl = `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`;
    const updateResponse = await auth.fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: parsed.requests }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Docs API error adding content: ${updateResponse.status} - ${error}`);
    }

    // If there are tables, do a second pass to populate cell content
    if (parsed.tables.length > 0) {
      const getUrl = `https://docs.googleapis.com/v1/documents/${doc.documentId}`;
      const refetchResponse = await auth.fetch(getUrl);
      if (!refetchResponse.ok) {
        const error = await refetchResponse.text();
        throw new Error(`Docs API error refetching document: ${refetchResponse.status} - ${error}`);
      }

      const updatedDoc = (await refetchResponse.json()) as GoogleDocsDocument;
      const tablesCellIndices = findTableCellIndices(updatedDoc);
      const cellRequests = generateTableCellRequests(parsed.tables, tablesCellIndices);

      if (cellRequests.length > 0) {
        const cellUpdateResponse = await auth.fetch(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests: cellRequests }),
        });

        if (!cellUpdateResponse.ok) {
          const error = await cellUpdateResponse.text();
          throw new Error(
            `Docs API error populating table cells: ${cellUpdateResponse.status} - ${error}`
          );
        }
      }
    }
  }

  return {
    documentId: doc.documentId,
    title: doc.title,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

export async function handleDocsAddComment(
  args: z.infer<typeof DocsAddCommentSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://www.googleapis.com/drive/v3/files/${args.documentId}/comments?fields=id,content,author,createdTime`;
  const response = await auth.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: args.content }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Drive API error adding comment: ${response.status} - ${error}`);
  }
  const comment = (await response.json()) as {
    id: string;
    content: string;
    author: { displayName: string };
    createdTime: string;
  };
  return {
    commentId: comment.id,
    content: comment.content,
    author: comment.author.displayName,
    createdTime: comment.createdTime,
  };
}

export async function handleDocsUpdate(
  args: z.infer<typeof DocsUpdateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const { documentId, content, append } = args;

  // First, get the document to find the current end index
  const getUrl = `https://docs.googleapis.com/v1/documents/${documentId}`;
  const getResponse = await auth.fetch(getUrl);
  if (!getResponse.ok) {
    const error = await getResponse.text();
    throw new Error(`Docs API error fetching document: ${getResponse.status} - ${error}`);
  }

  const doc = (await getResponse.json()) as GoogleDocsDocument;

  // Find the end index of the document (last element's endIndex minus 1 for the trailing newline)
  const lastElement = doc.body.content[doc.body.content.length - 1];
  const endIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : 1;

  // Parse markdown content
  const insertIndex = append ? endIndex : 1;
  const parsed = parseMarkdownContent(content, insertIndex);

  // Build the first batch update requests
  const requests: Array<Record<string, unknown>> = [];

  if (!append && endIndex > 1) {
    // Delete existing content (from index 1 to end)
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex,
        },
      },
    });
  }

  requests.push(...parsed.requests);

  // Execute the first batch update (content + table structures)
  const updateUrl = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
  const updateResponse = await auth.fetch(updateUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Docs API error updating document: ${updateResponse.status} - ${error}`);
  }

  // If there are tables, do a second pass to populate cell content
  if (parsed.tables.length > 0) {
    // Fetch the document again to get table cell indices
    const refetchResponse = await auth.fetch(getUrl);
    if (!refetchResponse.ok) {
      const error = await refetchResponse.text();
      throw new Error(`Docs API error refetching document: ${refetchResponse.status} - ${error}`);
    }

    const updatedDoc = (await refetchResponse.json()) as GoogleDocsDocument;
    const tablesCellIndices = findTableCellIndices(updatedDoc);

    // Generate requests to populate table cells
    const cellRequests = generateTableCellRequests(parsed.tables, tablesCellIndices);

    if (cellRequests.length > 0) {
      const cellUpdateResponse = await auth.fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: cellRequests }),
      });

      if (!cellUpdateResponse.ok) {
        const error = await cellUpdateResponse.text();
        throw new Error(
          `Docs API error populating table cells: ${cellUpdateResponse.status} - ${error}`
        );
      }
    }
  }

  return {
    documentId,
    title: doc.title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    action: append ? 'appended' : 'replaced',
  };
}

// ==================== HANDLER BUNDLE ====================

export const docsDefs = defineHandlers<GoogleAuth>()({
  docs_get_content: {
    description: 'Get the content of a Google Doc',
    schema: DocsGetContentSchema,
    handler: handleDocsGetContent,
  },
  docs_get_comments: {
    description: 'Get comments and suggestions on a Google Doc (uses Drive API)',
    schema: DocsGetCommentsSchema,
    handler: handleDocsGetComments,
  },
  docs_create: {
    description: 'Create a new Google Doc with optional initial markdown content',
    schema: DocsCreateSchema,
    handler: handleDocsCreate,
  },
  docs_update: {
    description: 'Update Google Doc content with markdown (replace or append)',
    schema: DocsUpdateSchema,
    handler: handleDocsUpdate,
  },
  docs_add_comment: {
    description: 'Add a comment to a Google Doc',
    schema: DocsAddCommentSchema,
    handler: handleDocsAddComment,
  },
});
