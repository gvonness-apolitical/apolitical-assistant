import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const SheetsGetValuesSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheet ID'),
  range: z.string().describe('The A1 notation range (e.g., "Sheet1!A1:D10")'),
});

export const SheetsGetMetadataSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheet ID'),
});

export const SheetsCreateSchema = z.object({
  title: z.string().describe('Title for the new spreadsheet'),
  sheetNames: z
    .array(z.string())
    .optional()
    .describe('Names for the sheets/tabs to create (defaults to a single "Sheet1")'),
});

export const SheetsUpdateValuesSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheet ID'),
  range: z.string().describe('The A1 notation range to update (e.g., "Sheet1!A1:D10")'),
  values: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .describe('2D array of cell values (rows × columns)'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleSheetsGetValues(
  args: z.infer<typeof SheetsGetValuesSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheetId}/values/${encodeURIComponent(args.range)}`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

  return await response.json();
}

export async function handleSheetsGetMetadata(
  args: z.infer<typeof SheetsGetMetadataSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheetId}?fields=properties,sheets.properties,namedRanges`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

  return await response.json();
}

export async function handleSheetsCreate(
  args: z.infer<typeof SheetsCreateSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const sheets = (args.sheetNames ?? ['Sheet1']).map((name) => ({
    properties: { title: name },
  }));

  const response = await auth.fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: args.title },
      sheets,
    }),
  });

  if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

  const result = (await response.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string; sheetId: number } }>;
  };

  return {
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl,
    title: result.properties.title,
    sheets: result.sheets.map((s) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
    })),
  };
}

export async function handleSheetsUpdateValues(
  args: z.infer<typeof SheetsUpdateValuesSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheetId}/values/${encodeURIComponent(args.range)}?valueInputOption=USER_ENTERED`;

  const response = await auth.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      range: args.range,
      majorDimension: 'ROWS',
      values: args.values,
    }),
  });

  if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

  return await response.json();
}

// ==================== HANDLER BUNDLE ====================

export const sheetsDefs = defineHandlers<GoogleAuth>()({
  sheets_get_values: {
    description: 'Get values from a Google Sheet',
    schema: SheetsGetValuesSchema,
    handler: handleSheetsGetValues,
  },
  sheets_get_metadata: {
    description: 'Get metadata about a Google Sheet (sheets, named ranges, etc.)',
    schema: SheetsGetMetadataSchema,
    handler: handleSheetsGetMetadata,
  },
  sheets_create: {
    description:
      'Create a new Google Sheet with optional named tabs. Returns the spreadsheet ID and URL.',
    schema: SheetsCreateSchema,
    handler: handleSheetsCreate,
  },
  sheets_update_values: {
    description:
      'Write values to a range in a Google Sheet. Values are provided as a 2D array (rows × columns).',
    schema: SheetsUpdateValuesSchema,
    handler: handleSheetsUpdateValues,
  },
});
