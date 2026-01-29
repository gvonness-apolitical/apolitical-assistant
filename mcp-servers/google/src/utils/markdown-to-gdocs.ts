/**
 * Markdown to Google Docs Conversion Utilities
 *
 * Converts markdown content to Google Docs API batchUpdate requests.
 * Supports:
 * - Headings (H1-H6)
 * - Bold and italic text
 * - Bullet and numbered lists
 * - Tables with header formatting
 * - Code blocks
 * - Emoji shortcodes
 */

import { marked, type Token, type Tokens } from 'marked';
import * as emoji from 'node-emoji';

// ==================== TYPES ====================

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface TableData {
  rows: number;
  cols: number;
  cells: TextRun[][]; // All cells in row-major order (header row first, then data rows)
}

export interface ParsedMarkdown {
  requests: Array<Record<string, unknown>>;
  styleRequests: Array<Record<string, unknown>>;
  tables: TableData[];
}

/**
 * Google Docs document structure for table operations
 */
export interface GoogleDocsDocument {
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

// ==================== EMOJI CONVERSION ====================

/**
 * Convert emoji shortcodes (e.g., :smile:) to unicode emojis
 */
function convertEmojiShortcodes(text: string): string {
  return emoji.emojify(text);
}

// ==================== TEXT EXTRACTION ====================

/**
 * Extract text runs with formatting from inline tokens.
 * Converts emoji shortcodes (e.g., :smile:) to unicode emojis.
 */
export function extractTextRuns(tokens: Token[]): TextRun[] {
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

// ==================== MARKDOWN PARSING ====================

/**
 * Convert markdown content to Google Docs API batchUpdate requests.
 * Returns requests for content insertion and separate table data for two-pass population.
 */
export function parseMarkdownContent(content: string, startIndex: number = 1): ParsedMarkdown {
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

// ==================== TABLE OPERATIONS ====================

/**
 * Find all tables in a Google Docs document and return their cell start indices
 */
export function findTableCellIndices(doc: GoogleDocsDocument): number[][] {
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
export function generateTableCellRequests(
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
