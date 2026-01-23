import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const DriveSearchSchema = z.object({
  query: z.string().describe('Search query (file name or content keywords)'),
  mimeType: z
    .string()
    .optional()
    .describe('Filter by MIME type (e.g., "application/vnd.google-apps.document")'),
  maxResults: z.number().optional().default(10).describe('Maximum number of files to return'),
});

export const DriveGetFileSchema = z.object({
  fileId: z.string().describe('The Drive file ID'),
});

// ==================== TOOL DEFINITIONS ====================

export const driveTools: Tool[] = [
  {
    name: 'drive_search',
    description: 'Search for files in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (file name or content keywords)',
        },
        mimeType: {
          type: 'string',
          description: 'Filter by MIME type (e.g., "application/vnd.google-apps.document")',
        },
        maxResults: {
          type: 'number',
          default: 10,
          description: 'Maximum number of files to return',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'drive_get_file',
    description: 'Get metadata about a specific file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The Drive file ID',
        },
      },
      required: ['fileId'],
    },
  },
];

// ==================== HANDLER FUNCTIONS ====================

export async function handleDriveSearch(
  args: z.infer<typeof DriveSearchSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  let driveQuery = `name contains '${args.query}' or fullText contains '${args.query}'`;
  if (args.mimeType) {
    driveQuery += ` and mimeType='${args.mimeType}'`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', driveQuery);
  url.searchParams.set('pageSize', args.maxResults.toString());
  url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink)');

  const response = await auth.fetch(url.toString());
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`);

  const data = (await response.json()) as {
    files: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      webViewLink: string;
    }>;
  };

  return data.files;
}

export async function handleDriveGetFile(
  args: z.infer<typeof DriveGetFileSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://www.googleapis.com/drive/v3/files/${args.fileId}?fields=id,name,mimeType,modifiedTime,createdTime,size,webViewLink,owners,permissions`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`);

  return await response.json();
}
