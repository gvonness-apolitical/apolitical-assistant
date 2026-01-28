import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from '../auth.js';

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

// ==================== TOOL DEFINITIONS ====================

export const docsTools: Tool[] = [
  {
    name: 'docs_get_content',
    description: 'Get the content of a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The Google Doc ID',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'docs_get_comments',
    description: 'Get comments and suggestions on a Google Doc (uses Drive API)',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The Google Doc ID',
        },
        includeResolved: {
          type: 'boolean',
          default: false,
          description: 'Include resolved comments',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'docs_create',
    description: 'Create a new Google Doc with optional initial markdown content',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new document',
        },
        content: {
          type: 'string',
          description:
            'Initial markdown content (# headings, **bold**, *italic*, lists, tables)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'docs_update',
    description: 'Update Google Doc content with markdown (replace or append)',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The Google Doc ID to update',
        },
        content: {
          type: 'string',
          description:
            'Markdown content (# headings, **bold**, *italic*, lists, tables, code blocks)',
        },
        append: {
          type: 'boolean',
          default: false,
          description: 'If true, append content instead of replacing',
        },
      },
      required: ['documentId', 'content'],
    },
  },
];

// ==================== MARKDOWN CONVERSION ====================

import { marked, type Token, type Tokens } from 'marked';
import * as emoji from 'node-emoji';

/**
 * Convert emoji shortcodes (e.g., :smile:) to unicode emojis
 */
function convertEmojiShortcodes(text: string): string {
  return emoji.emojify(text);
}

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

interface TableData {
  rows: number;
  cols: number;
  cells: TextRun[][]; // All cells in row-major order (header row first, then data rows)
}

interface ParsedMarkdown {
  requests: Array<Record<string, unknown>>;
  styleRequests: Array<Record<string, unknown>>;
  tables: TableData[];
}

/**
 * Extract text runs with formatting from inline tokens.
 * Converts emoji shortcodes (e.g., :smile:) to unicode emojis.
 */
function extractTextRuns(tokens: Token[]): TextRun[] {
  const runs: TextRun[] = [];

  for (const token of tokens) {
    if (token.type === 'text' || token.type === 'codespan') {
      const rawText = token.raw.replace(/`/g, '');
      runs.push({ text: convertEmojiShortcodes(rawText) });
    } else if (token.type === 'strong') {
      const innerRuns = extractTextRuns((token as Tokens.Strong).tokens || []);
      for (const run of innerRuns) {
        runs.push({ ...run, bold: true });
      }
    } else if (token.type === 'em') {
      const innerRuns = extractTextRuns((token as Tokens.Em).tokens || []);
      for (const run of innerRuns) {
        runs.push({ ...run, italic: true });
      }
    } else if ('tokens' in token && Array.isArray(token.tokens)) {
      runs.push(...extractTextRuns(token.tokens));
    } else if ('text' in token && typeof token.text === 'string') {
      runs.push({ text: convertEmojiShortcodes(token.text) });
    }
  }

  return runs;
}

/**
 * Convert markdown content to Google Docs API batchUpdate requests.
 * Returns requests for content insertion and separate table data for two-pass population.
 */
function parseMarkdownContent(content: string, startIndex: number = 1): ParsedMarkdown {
  const tokens = marked.lexer(content);
  const requests: Array<Record<string, unknown>> = [];
  const styleRequests: Array<Record<string, unknown>> = [];
  const tables: TableData[] = [];

  let currentIndex = startIndex;

  for (const token of tokens) {
    const blockStart = currentIndex;

    if (token.type === 'heading') {
      const headingToken = token as Tokens.Heading;
      const runs = extractTextRuns(headingToken.tokens || []);
      const text = runs.map((r) => r.text).join('') + '\n';

      requests.push({
        insertText: { location: { index: currentIndex }, text },
      });

      // Apply heading style
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: blockStart, endIndex: blockStart + text.length },
          paragraphStyle: { namedStyleType: `HEADING_${headingToken.depth}` },
          fields: 'namedStyleType',
        },
      });

      // Apply inline styles (bold, italic)
      let offset = 0;
      for (const run of runs) {
        if (run.bold || run.italic) {
          const textStyle: Record<string, boolean> = {};
          if (run.bold) textStyle.bold = true;
          if (run.italic) textStyle.italic = true;
          styleRequests.push({
            updateTextStyle: {
              range: {
                startIndex: blockStart + offset,
                endIndex: blockStart + offset + run.text.length,
              },
              textStyle,
              fields: Object.keys(textStyle).join(','),
            },
          });
        }
        offset += run.text.length;
      }

      currentIndex += text.length;
    } else if (token.type === 'paragraph') {
      const paraToken = token as Tokens.Paragraph;
      const runs = extractTextRuns(paraToken.tokens || []);
      const text = runs.map((r) => r.text).join('') + '\n';

      requests.push({
        insertText: { location: { index: currentIndex }, text },
      });

      // Apply inline styles
      let offset = 0;
      for (const run of runs) {
        if (run.bold || run.italic) {
          const textStyle: Record<string, boolean> = {};
          if (run.bold) textStyle.bold = true;
          if (run.italic) textStyle.italic = true;
          styleRequests.push({
            updateTextStyle: {
              range: {
                startIndex: blockStart + offset,
                endIndex: blockStart + offset + run.text.length,
              },
              textStyle,
              fields: Object.keys(textStyle).join(','),
            },
          });
        }
        offset += run.text.length;
      }

      currentIndex += text.length;
    } else if (token.type === 'list') {
      const listToken = token as Tokens.List;
      const bulletPreset = listToken.ordered
        ? 'NUMBERED_DECIMAL_NESTED'
        : 'BULLET_DISC_CIRCLE_SQUARE';

      for (const item of listToken.items) {
        const itemStart = currentIndex;
        const runs = extractTextRuns(item.tokens || []);
        const text = runs.map((r) => r.text).join('') + '\n';

        requests.push({
          insertText: { location: { index: currentIndex }, text },
        });

        // Apply bullet/number style
        styleRequests.push({
          createParagraphBullets: {
            range: { startIndex: itemStart, endIndex: itemStart + text.length },
            bulletPreset,
          },
        });

        // Apply inline styles
        let offset = 0;
        for (const run of runs) {
          if (run.bold || run.italic) {
            const textStyle: Record<string, boolean> = {};
            if (run.bold) textStyle.bold = true;
            if (run.italic) textStyle.italic = true;
            styleRequests.push({
              updateTextStyle: {
                range: {
                  startIndex: itemStart + offset,
                  endIndex: itemStart + offset + run.text.length,
                },
                textStyle,
                fields: Object.keys(textStyle).join(','),
              },
            });
          }
          offset += run.text.length;
        }

        currentIndex += text.length;
      }
    } else if (token.type === 'table') {
      const tableToken = token as Tokens.Table;
      const rows = 1 + tableToken.rows.length; // header + data rows
      const cols = tableToken.header.length;

      // Insert table structure (cells will be populated in second pass)
      requests.push({
        insertTable: {
          location: { index: currentIndex },
          rows,
          columns: cols,
        },
      });

      // Extract cell content for second pass
      const cells: TextRun[][] = [];

      // Header cells (make them bold)
      for (const headerCell of tableToken.header) {
        const runs = extractTextRuns(headerCell.tokens || []);
        // Make header cells bold
        cells.push(runs.map((r) => ({ ...r, bold: true })));
      }

      // Data cells
      for (const row of tableToken.rows) {
        for (const cell of row) {
          cells.push(extractTextRuns(cell.tokens || []));
        }
      }

      tables.push({ rows, cols, cells });

      // Table structure takes space but we don't know exact amount until after insertion
      // The second pass will handle cell population after fetching the document
      currentIndex += 1;
    } else if (token.type === 'space') {
      // Blank lines - insert newline
      requests.push({
        insertText: { location: { index: currentIndex }, text: '\n' },
      });
      currentIndex += 1;
    } else if (token.type === 'code') {
      // Code block - insert as plain text
      const codeToken = token as Tokens.Code;
      const text = codeToken.text + '\n';
      requests.push({
        insertText: { location: { index: currentIndex }, text },
      });
      currentIndex += text.length;
    }
  }

  return {
    requests: [...requests, ...styleRequests],
    styleRequests: [],
    tables,
  };
}

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
          elements: Array<{
            textRun?: { content: string };
          }>;
        };
      }>;
    };
  };

  // Extract text content
  const textContent = doc.body.content
    .filter((block) => block.paragraph)
    .map((block) => block.paragraph!.elements.map((el) => el.textRun?.content || '').join(''))
    .join('');

  return {
    title: doc.title,
    content: textContent,
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

// Type for Google Docs document structure
interface GoogleDocsDocument {
  title: string;
  body: {
    content: Array<{
      startIndex: number;
      endIndex: number;
      table?: {
        rows: number;
        columns: number;
        tableRows: Array<{
          tableCells: Array<{
            content: Array<{
              startIndex: number;
              endIndex: number;
              paragraph?: {
                elements: Array<{
                  startIndex: number;
                  endIndex: number;
                  textRun?: { content: string };
                }>;
              };
            }>;
          }>;
        }>;
      };
    }>;
  };
}

/**
 * Find all tables in a Google Docs document and return their cell start indices
 */
function findTableCellIndices(doc: GoogleDocsDocument): number[][] {
  const tablesCellIndices: number[][] = [];

  for (const element of doc.body.content) {
    if (element.table) {
      const cellIndices: number[] = [];
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells) {
          // Each cell contains content; the first paragraph's first element has the start index
          if (cell.content && cell.content.length > 0) {
            const firstContent = cell.content[0];
            if (firstContent) {
              if (
                firstContent.paragraph &&
                firstContent.paragraph.elements &&
                firstContent.paragraph.elements.length > 0 &&
                firstContent.paragraph.elements[0]
              ) {
                cellIndices.push(firstContent.paragraph.elements[0].startIndex);
              } else {
                cellIndices.push(firstContent.startIndex);
              }
            }
          }
        }
      }
      tablesCellIndices.push(cellIndices);
    }
  }

  return tablesCellIndices;
}

/**
 * Generate requests to populate table cells with content and formatting.
 * Processes cells in reverse order to maintain correct indices.
 */
function generateTableCellRequests(
  tables: TableData[],
  tablesCellIndices: number[][]
): Array<Record<string, unknown>> {
  const requests: Array<Record<string, unknown>> = [];

  // Process tables in reverse order to maintain index integrity
  for (let tableIdx = tables.length - 1; tableIdx >= 0; tableIdx--) {
    const table = tables[tableIdx];
    const cellIndices = tablesCellIndices[tableIdx];

    if (!table || !cellIndices || cellIndices.length !== table.cells.length) {
      continue; // Skip if indices don't match
    }

    // Process cells in reverse order (last cell first)
    for (let cellIdx = table.cells.length - 1; cellIdx >= 0; cellIdx--) {
      const cellRuns = table.cells[cellIdx];
      const cellStartIndex = cellIndices[cellIdx];

      if (!cellRuns || cellStartIndex === undefined) continue;

      const cellText = cellRuns.map((r) => r.text).join('');

      if (cellText.length === 0) continue;

      // Insert the text into the cell
      requests.push({
        insertText: {
          location: { index: cellStartIndex },
          text: cellText,
        },
      });

      // Apply formatting to runs
      let offset = 0;
      for (const run of cellRuns) {
        if (run.bold || run.italic) {
          const textStyle: Record<string, boolean> = {};
          if (run.bold) textStyle.bold = true;
          if (run.italic) textStyle.italic = true;
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: cellStartIndex + offset,
                endIndex: cellStartIndex + offset + run.text.length,
              },
              textStyle,
              fields: Object.keys(textStyle).join(','),
            },
          });
        }
        offset += run.text.length;
      }
    }
  }

  return requests;
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
