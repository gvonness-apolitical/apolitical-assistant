import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
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

export const DriveExportSchema = z.object({
  fileId: z.string().describe('The Drive file ID'),
  mimeType: z
    .string()
    .optional()
    .default('application/pdf')
    .describe('Export MIME type (e.g. "application/pdf", "image/png"). Defaults to PDF.'),
  outputPath: z
    .string()
    .optional()
    .describe('Custom save location. Defaults to a temp directory path.'),
});

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

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

export async function handleDriveExport(
  args: z.infer<typeof DriveExportSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // 1. Fetch file metadata to determine if it's a native Google file
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${args.fileId}?fields=name,mimeType`;
  const metaResponse = await auth.fetch(metaUrl);
  if (!metaResponse.ok) throw new Error(`Drive API error: ${metaResponse.status}`);

  const meta = (await metaResponse.json()) as { name: string; mimeType: string };

  // 2. Choose export vs direct download
  const isGoogleApp = meta.mimeType.startsWith('application/vnd.google-apps.');
  let downloadResponse: Response;

  if (isGoogleApp) {
    // Export native Google files (Docs, Sheets, Slides, etc.)
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${args.fileId}/export?mimeType=${encodeURIComponent(args.mimeType)}`;
    downloadResponse = await auth.fetch(exportUrl);
  } else {
    // Direct download for non-native files (uploaded PDFs, images, etc.)
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${args.fileId}?alt=media`;
    downloadResponse = await auth.fetch(mediaUrl);
  }

  if (!downloadResponse.ok) {
    throw new Error(`Drive export/download error: ${downloadResponse.status}`);
  }

  // 3. Read response and write to disk
  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  const ext = MIME_EXTENSIONS[isGoogleApp ? args.mimeType : meta.mimeType] || 'bin';
  const filePath = args.outputPath || join(tmpdir(), `drive-export-${args.fileId}.${ext}`);

  await writeFile(filePath, buffer);

  return {
    filePath,
    fileName: meta.name,
    mimeType: isGoogleApp ? args.mimeType : meta.mimeType,
    fileSize: buffer.length,
  };
}

// ==================== HANDLER BUNDLE ====================

export const driveDefs = defineHandlers<GoogleAuth>()({
  drive_search: {
    description: 'Search for files in Google Drive',
    schema: DriveSearchSchema,
    handler: handleDriveSearch,
  },
  drive_get_file: {
    description: 'Get metadata about a specific file',
    schema: DriveGetFileSchema,
    handler: handleDriveGetFile,
  },
  drive_export: {
    description:
      'Export or download a Google Drive file to disk. Automatically detects native Google files (Docs/Sheets/Slides) and exports them, or downloads uploaded files directly.',
    schema: DriveExportSchema,
    handler: handleDriveExport,
  },
});
