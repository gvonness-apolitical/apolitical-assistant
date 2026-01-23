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
];

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
