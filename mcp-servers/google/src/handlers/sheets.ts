import { z } from 'zod';
import { createToolDefinition } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const SheetsGetValuesSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheet ID'),
  range: z.string().describe('The A1 notation range (e.g., "Sheet1!A1:D10")'),
});

export const SheetsGetMetadataSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheet ID'),
});

// ==================== TOOL DEFINITIONS ====================

export const sheetsTools = [
  createToolDefinition(
    'sheets_get_values',
    'Get values from a Google Sheet',
    SheetsGetValuesSchema
  ),
  createToolDefinition(
    'sheets_get_metadata',
    'Get metadata about a Google Sheet (sheets, named ranges, etc.)',
    SheetsGetMetadataSchema
  ),
];

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
