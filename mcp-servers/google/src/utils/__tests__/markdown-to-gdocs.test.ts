import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import {
  extractTextRuns,
  parseMarkdownContent,
  findTableCellIndices,
  generateTableCellRequests,
} from '../markdown-to-gdocs.js';
import type { TableData, GoogleDocsDocument } from '../markdown-to-gdocs.js';

// ==================== HELPERS ====================

/** Extract inline tokens from a markdown string (first block token's tokens) */
function inlineTokens(md: string): ReturnType<typeof marked.lexer>[0][] {
  const block = marked.lexer(md)[0] as Record<string, unknown>;
  return (block?.tokens as ReturnType<typeof marked.lexer>) ?? [];
}

/** Find a request by its top-level key (e.g., 'insertText', 'updateParagraphStyle') */
function findRequests(
  requests: Array<Record<string, unknown>>,
  key: string
): Array<Record<string, unknown>> {
  return requests.filter((r) => key in r);
}

/** Shorthand to build a minimal GoogleDocsDocument for table tests */
function makeDoc(content: GoogleDocsDocument['body']['content']): GoogleDocsDocument {
  return { title: 'Test', body: { content } };
}

// ==================== extractTextRuns ====================

describe('extractTextRuns', () => {
  it('should extract plain text from a text token', () => {
    const runs = extractTextRuns(inlineTokens('hello world'));
    expect(runs).toEqual([{ text: 'hello world' }]);
  });

  it('should extract bold text', () => {
    const runs = extractTextRuns(inlineTokens('**bold**'));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.text).toBe('bold');
    expect(runs[0]?.bold).toBe(true);
  });

  it('should extract italic text', () => {
    const runs = extractTextRuns(inlineTokens('*italic*'));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.text).toBe('italic');
    expect(runs[0]?.italic).toBe(true);
  });

  it('should extract bold+italic nested text', () => {
    const runs = extractTextRuns(inlineTokens('***bold italic***'));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.bold).toBe(true);
    expect(runs[0]?.italic).toBe(true);
    expect(runs[0]?.text).toContain('bold italic');
  });

  it('should extract codespan text', () => {
    const runs = extractTextRuns(inlineTokens('`code`'));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.text).toBe('code');
  });

  it('should handle mixed formatting in sequence', () => {
    const runs = extractTextRuns(inlineTokens('hello **bold** and *italic* end'));
    const texts = runs.map((r) => r.text);
    expect(texts.join('')).toBe('hello bold and italic end');

    const boldRun = runs.find((r) => r.bold);
    expect(boldRun?.text).toBe('bold');

    const italicRun = runs.find((r) => r.italic);
    expect(italicRun?.text).toBe('italic');
  });

  it('should convert emoji shortcodes to unicode', () => {
    const runs = extractTextRuns(inlineTokens(':smile:'));
    expect(runs).toHaveLength(1);
    // node-emoji converts :smile: to the grinning face emoji
    expect(runs[0]?.text).not.toContain(':smile:');
    expect(runs[0]?.text.length).toBeGreaterThan(0);
  });

  it('should return empty array for empty tokens', () => {
    const runs = extractTextRuns([]);
    expect(runs).toEqual([]);
  });

  it('should handle token with nested tokens array (recursive case)', () => {
    // A link token has a nested tokens array
    const runs = extractTextRuns(inlineTokens('[link text](http://example.com)'));
    const text = runs.map((r) => r.text).join('');
    expect(text).toContain('link text');
  });

  it('should handle token with only text property (fallback case)', () => {
    // Construct a minimal token that has .text but no .tokens and is not text/codespan/strong/em
    const fakeToken = { type: 'html', raw: '<br>', text: 'fallback text' } as never;
    const runs = extractTextRuns([fakeToken]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.text).toBe('fallback text');
  });
});

// ==================== parseMarkdownContent ====================

describe('parseMarkdownContent', () => {
  it('should produce heading requests for H1', () => {
    const result = parseMarkdownContent('# Title');
    const inserts = findRequests(result.requests, 'insertText');
    const headingStyles = findRequests(result.requests, 'updateParagraphStyle');

    expect(inserts.length).toBeGreaterThanOrEqual(1);
    expect(headingStyles.length).toBeGreaterThanOrEqual(1);

    const style = headingStyles[0]?.updateParagraphStyle as Record<string, unknown>;
    const paraStyle = style?.paragraphStyle as Record<string, string>;
    expect(paraStyle?.namedStyleType).toBe('HEADING_1');
  });

  it('should produce heading requests for H2', () => {
    const result = parseMarkdownContent('## Subtitle');
    const headingStyles = findRequests(result.requests, 'updateParagraphStyle');
    const style = headingStyles[0]?.updateParagraphStyle as Record<string, unknown>;
    const paraStyle = style?.paragraphStyle as Record<string, string>;
    expect(paraStyle?.namedStyleType).toBe('HEADING_2');
  });

  it('should produce heading requests for H3', () => {
    const result = parseMarkdownContent('### Section');
    const headingStyles = findRequests(result.requests, 'updateParagraphStyle');
    const style = headingStyles[0]?.updateParagraphStyle as Record<string, unknown>;
    const paraStyle = style?.paragraphStyle as Record<string, string>;
    expect(paraStyle?.namedStyleType).toBe('HEADING_3');
  });

  it('should produce insertText for plain paragraph', () => {
    const result = parseMarkdownContent('This is a paragraph.');
    const inserts = findRequests(result.requests, 'insertText');
    expect(inserts.length).toBeGreaterThanOrEqual(1);

    const insertData = inserts[0]?.insertText as Record<string, unknown>;
    expect(insertData?.text).toContain('This is a paragraph.');
  });

  it('should produce updateTextStyle for paragraph with bold', () => {
    const result = parseMarkdownContent('Hello **world**.');
    const textStyles = findRequests(result.requests, 'updateTextStyle');
    expect(textStyles.length).toBeGreaterThanOrEqual(1);

    const styleData = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const ts = styleData?.textStyle as Record<string, boolean>;
    expect(ts?.bold).toBe(true);
  });

  it('should produce updateTextStyle for paragraph with italic', () => {
    const result = parseMarkdownContent('Hello *world*.');
    const textStyles = findRequests(result.requests, 'updateTextStyle');
    expect(textStyles.length).toBeGreaterThanOrEqual(1);

    const styleData = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const ts = styleData?.textStyle as Record<string, boolean>;
    expect(ts?.italic).toBe(true);
  });

  it('should produce createParagraphBullets for unordered list', () => {
    const result = parseMarkdownContent('- item one\n- item two');
    const bullets = findRequests(result.requests, 'createParagraphBullets');
    expect(bullets.length).toBe(2);

    const bulletData = bullets[0]?.createParagraphBullets as Record<string, unknown>;
    expect(bulletData?.bulletPreset).toBe('BULLET_DISC_CIRCLE_SQUARE');
  });

  it('should produce createParagraphBullets for ordered list', () => {
    const result = parseMarkdownContent('1. first\n2. second');
    const bullets = findRequests(result.requests, 'createParagraphBullets');
    expect(bullets.length).toBe(2);

    const bulletData = bullets[0]?.createParagraphBullets as Record<string, unknown>;
    expect(bulletData?.bulletPreset).toBe('NUMBERED_DECIMAL_NESTED');
  });

  it('should insert list items even when they contain bold markdown syntax', () => {
    // marked v17 wraps list item content in a 'text' token, which extractTextRuns
    // handles via token.raw (stripping backticks only). Bold syntax is preserved as
    // literal text rather than producing updateTextStyle requests.
    const result = parseMarkdownContent('- **bold item**\n- normal item');
    const inserts = findRequests(result.requests, 'insertText');
    const bullets = findRequests(result.requests, 'createParagraphBullets');

    // Two list items produce two inserts and two bullet requests
    expect(inserts).toHaveLength(2);
    expect(bullets).toHaveLength(2);
  });

  it('should produce updateTextStyle for loose list items with bold text', () => {
    // A "loose" list (items separated by blank lines) produces paragraph tokens
    // inside list items, which lets extractTextRuns find strong/em tokens and
    // generate updateTextStyle requests for inline formatting.
    const result = parseMarkdownContent('- **bold item**\n\n- normal item\n');
    const textStyles = findRequests(result.requests, 'updateTextStyle');
    expect(textStyles.length).toBeGreaterThanOrEqual(1);

    const styleData = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const ts = styleData?.textStyle as Record<string, boolean>;
    expect(ts?.bold).toBe(true);
  });

  it('should produce insertTable for markdown table', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const result = parseMarkdownContent(md);
    const tablInserts = findRequests(result.requests, 'insertTable');
    expect(tablInserts.length).toBe(1);

    const tableData = tablInserts[0]?.insertTable as Record<string, unknown>;
    expect(tableData?.rows).toBe(2); // 1 header + 1 data row
    expect(tableData?.columns).toBe(2);
  });

  it('should populate tables array with correct cells for markdown table', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const result = parseMarkdownContent(md);
    expect(result.tables).toHaveLength(1);

    const table = result.tables[0]!;
    expect(table.rows).toBe(2);
    expect(table.cols).toBe(2);
    // 2 header cells + 2 data cells = 4 total
    expect(table.cells).toHaveLength(4);
  });

  it('should make table header cells bold', () => {
    const md = '| Header1 | Header2 |\n| --- | --- |\n| data1 | data2 |';
    const result = parseMarkdownContent(md);
    const table = result.tables[0]!;

    // First two cells are headers and should be bold
    expect(table.cells[0]![0]?.bold).toBe(true);
    expect(table.cells[1]![0]?.bold).toBe(true);

    // Data cells should not be bold (unless the markdown had bold)
    expect(table.cells[2]![0]?.bold).toBeUndefined();
    expect(table.cells[3]![0]?.bold).toBeUndefined();
  });

  it('should produce insertText for code block', () => {
    const md = '```\nconsole.log("hello");\n```';
    const result = parseMarkdownContent(md);
    const inserts = findRequests(result.requests, 'insertText');
    expect(inserts.length).toBeGreaterThanOrEqual(1);

    const codeInsert = inserts.find((r) => {
      const data = r.insertText as Record<string, unknown>;
      return (data?.text as string)?.includes('console.log');
    });
    expect(codeInsert).toBeDefined();
  });

  it('should produce insertText with newline for space/blank line', () => {
    // Two paragraphs separated by a blank line produces a 'space' token
    const md = 'paragraph one\n\nparagraph two';
    const result = parseMarkdownContent(md);
    const inserts = findRequests(result.requests, 'insertText');

    // Should have at least two paragraph inserts
    expect(inserts.length).toBeGreaterThanOrEqual(2);
  });

  it('should use custom startIndex', () => {
    const result = parseMarkdownContent('Hello', 100);
    const inserts = findRequests(result.requests, 'insertText');
    const insertData = inserts[0]?.insertText as Record<string, unknown>;
    const location = insertData?.location as Record<string, number>;
    expect(location?.index).toBe(100);
  });

  it('should handle mixed content with correct request ordering', () => {
    const md = '# Heading\n\nParagraph text.\n\n- bullet one';
    const result = parseMarkdownContent(md);

    // Should have at least: heading insert, paragraph insert, bullet insert
    const inserts = findRequests(result.requests, 'insertText');
    expect(inserts.length).toBeGreaterThanOrEqual(3);

    // Should have heading style and bullet style
    const headingStyles = findRequests(result.requests, 'updateParagraphStyle');
    expect(headingStyles.length).toBeGreaterThanOrEqual(1);

    const bulletStyles = findRequests(result.requests, 'createParagraphBullets');
    expect(bulletStyles.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty requests and tables for empty content', () => {
    const result = parseMarkdownContent('');
    expect(result.requests).toEqual([]);
    expect(result.tables).toEqual([]);
  });

  it('should always return empty styleRequests (merged into requests)', () => {
    const result = parseMarkdownContent('# Heading\n\n**Bold paragraph**');
    expect(result.styleRequests).toEqual([]);
    // But styles should exist in requests
    const textStyles = findRequests(result.requests, 'updateTextStyle');
    expect(textStyles.length).toBeGreaterThanOrEqual(1);
  });

  it('should convert emoji shortcodes in content', () => {
    const result = parseMarkdownContent(':rocket: Launch');
    const inserts = findRequests(result.requests, 'insertText');
    const insertData = inserts[0]?.insertText as Record<string, unknown>;
    const text = insertData?.text as string;
    expect(text).not.toContain(':rocket:');
    expect(text).toContain('Launch');
  });

  it('should advance indices correctly across multiple paragraphs', () => {
    const result = parseMarkdownContent('First\n\nSecond\n\nThird');
    const inserts = findRequests(result.requests, 'insertText');

    // Each insert should have a different starting index
    const indices = inserts.map((r) => {
      const data = r.insertText as Record<string, unknown>;
      const loc = data?.location as Record<string, number>;
      return loc?.index;
    });

    // All indices should be defined and in ascending order
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it('should produce both heading style and text style for heading with bold', () => {
    const result = parseMarkdownContent('## Hello **world**');
    const headingStyles = findRequests(result.requests, 'updateParagraphStyle');
    const textStyles = findRequests(result.requests, 'updateTextStyle');

    expect(headingStyles.length).toBeGreaterThanOrEqual(1);
    expect(textStyles.length).toBeGreaterThanOrEqual(1);

    const style = headingStyles[0]?.updateParagraphStyle as Record<string, unknown>;
    const paraStyle = style?.paragraphStyle as Record<string, string>;
    expect(paraStyle?.namedStyleType).toBe('HEADING_2');

    const tsData = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const ts = tsData?.textStyle as Record<string, boolean>;
    expect(ts?.bold).toBe(true);
  });

  it('should handle table with multiple rows', () => {
    const md = '| H1 | H2 | H3 |\n| --- | --- | --- |\n| a | b | c |\n| d | e | f |';
    const result = parseMarkdownContent(md);
    const table = result.tables[0]!;

    expect(table.rows).toBe(3); // 1 header + 2 data rows
    expect(table.cols).toBe(3);
    // 3 header + 6 data = 9 cells
    expect(table.cells).toHaveLength(9);
  });
});

// ==================== findTableCellIndices ====================

describe('findTableCellIndices', () => {
  it('should return empty array for document with no tables', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 50,
        // no table property
      },
    ]);
    const result = findTableCellIndices(doc);
    expect(result).toEqual([]);
  });

  it('should return cell indices from paragraph elements', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 100,
        table: {
          rows: 1,
          columns: 2,
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 5,
                      endIndex: 10,
                      paragraph: {
                        elements: [{ startIndex: 5, endIndex: 10, textRun: { content: 'A' } }],
                      },
                    },
                  ],
                },
                {
                  content: [
                    {
                      startIndex: 15,
                      endIndex: 20,
                      paragraph: {
                        elements: [{ startIndex: 15, endIndex: 20, textRun: { content: 'B' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = findTableCellIndices(doc);
    expect(result).toEqual([[5, 15]]);
  });

  it('should fall back to startIndex when cell has no paragraph', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 100,
        table: {
          rows: 1,
          columns: 1,
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 7,
                      endIndex: 12,
                      // no paragraph property
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = findTableCellIndices(doc);
    expect(result).toEqual([[7]]);
  });

  it('should return array of arrays for multiple tables', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 50,
        table: {
          rows: 1,
          columns: 1,
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 3,
                      endIndex: 8,
                      paragraph: {
                        elements: [{ startIndex: 3, endIndex: 8, textRun: { content: 'X' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        startIndex: 50,
        endIndex: 100,
        table: {
          rows: 1,
          columns: 1,
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 55,
                      endIndex: 60,
                      paragraph: {
                        elements: [{ startIndex: 55, endIndex: 60, textRun: { content: 'Y' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = findTableCellIndices(doc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([3]);
    expect(result[1]).toEqual([55]);
  });

  it('should find all cell indices in a table with multiple rows and cells', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 200,
        table: {
          rows: 2,
          columns: 2,
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 5,
                      endIndex: 10,
                      paragraph: {
                        elements: [{ startIndex: 5, endIndex: 10, textRun: { content: 'A' } }],
                      },
                    },
                  ],
                },
                {
                  content: [
                    {
                      startIndex: 15,
                      endIndex: 20,
                      paragraph: {
                        elements: [{ startIndex: 15, endIndex: 20, textRun: { content: 'B' } }],
                      },
                    },
                  ],
                },
              ],
            },
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 30,
                      endIndex: 35,
                      paragraph: {
                        elements: [{ startIndex: 30, endIndex: 35, textRun: { content: 'C' } }],
                      },
                    },
                  ],
                },
                {
                  content: [
                    {
                      startIndex: 40,
                      endIndex: 45,
                      paragraph: {
                        elements: [{ startIndex: 40, endIndex: 45, textRun: { content: 'D' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = findTableCellIndices(doc);
    expect(result).toEqual([[5, 15, 30, 40]]);
  });

  it('should handle cell with empty content gracefully', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 50,
        table: {
          rows: 1,
          columns: 2,
          tableRows: [
            {
              tableCells: [
                {
                  content: [], // empty content
                },
                {
                  content: [
                    {
                      startIndex: 10,
                      endIndex: 15,
                      paragraph: {
                        elements: [{ startIndex: 10, endIndex: 15, textRun: { content: 'OK' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = findTableCellIndices(doc);
    // Only the non-empty cell should have an index
    expect(result).toEqual([[10]]);
  });
});

// ==================== generateTableCellRequests ====================

describe('generateTableCellRequests', () => {
  it('should produce insertText request for single cell with text', () => {
    const tables: TableData[] = [{ rows: 1, cols: 1, cells: [[{ text: 'hello' }]] }];
    const indices = [[10]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');
    expect(inserts).toHaveLength(1);

    const insertData = inserts[0]?.insertText as Record<string, unknown>;
    expect(insertData?.text).toBe('hello');
    const loc = insertData?.location as Record<string, number>;
    expect(loc?.index).toBe(10);
  });

  it('should produce insertText + updateTextStyle for bold cell', () => {
    const tables: TableData[] = [{ rows: 1, cols: 1, cells: [[{ text: 'bold', bold: true }]] }];
    const indices = [[10]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');
    const textStyles = findRequests(requests, 'updateTextStyle');

    expect(inserts).toHaveLength(1);
    expect(textStyles).toHaveLength(1);

    const styleData = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const ts = styleData?.textStyle as Record<string, boolean>;
    expect(ts?.bold).toBe(true);
  });

  it('should skip cell with empty text', () => {
    const tables: TableData[] = [{ rows: 1, cols: 1, cells: [[{ text: '' }]] }];
    const indices = [[10]];

    const requests = generateTableCellRequests(tables, indices);
    expect(requests).toHaveLength(0);
  });

  it('should process multiple cells in reverse order', () => {
    const tables: TableData[] = [
      {
        rows: 1,
        cols: 2,
        cells: [[{ text: 'first' }], [{ text: 'second' }]],
      },
    ];
    const indices = [[10, 20]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');
    expect(inserts).toHaveLength(2);

    // Reverse order: second cell (index 20) first, then first cell (index 10)
    const firstInsert = inserts[0]?.insertText as Record<string, unknown>;
    const firstLoc = firstInsert?.location as Record<string, number>;
    expect(firstLoc?.index).toBe(20);

    const secondInsert = inserts[1]?.insertText as Record<string, unknown>;
    const secondLoc = secondInsert?.location as Record<string, number>;
    expect(secondLoc?.index).toBe(10);
  });

  it('should process multiple tables in reverse table order', () => {
    const tables: TableData[] = [
      { rows: 1, cols: 1, cells: [[{ text: 'table1' }]] },
      { rows: 1, cols: 1, cells: [[{ text: 'table2' }]] },
    ];
    const indices = [[10], [50]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');
    expect(inserts).toHaveLength(2);

    // Second table (index 50) processed first, then first table (index 10)
    const firstInsert = inserts[0]?.insertText as Record<string, unknown>;
    const firstLoc = firstInsert?.location as Record<string, number>;
    expect(firstLoc?.index).toBe(50);

    const secondInsert = inserts[1]?.insertText as Record<string, unknown>;
    const secondLoc = secondInsert?.location as Record<string, number>;
    expect(secondLoc?.index).toBe(10);
  });

  it('should skip table when indices length does not match cells length', () => {
    const tables: TableData[] = [
      {
        rows: 1,
        cols: 2,
        cells: [[{ text: 'a' }], [{ text: 'b' }]],
      },
    ];
    // Only one index for two cells — mismatch
    const indices = [[10]];

    const requests = generateTableCellRequests(tables, indices);
    expect(requests).toHaveLength(0);
  });

  it('should handle cell with mixed bold and italic formatting', () => {
    const tables: TableData[] = [
      {
        rows: 1,
        cols: 1,
        cells: [
          [{ text: 'bold', bold: true }, { text: ' and ' }, { text: 'italic', italic: true }],
        ],
      },
    ];
    const indices = [[10]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');
    const textStyles = findRequests(requests, 'updateTextStyle');

    expect(inserts).toHaveLength(1);
    const insertData = inserts[0]?.insertText as Record<string, unknown>;
    expect(insertData?.text).toBe('bold and italic');

    // Two style updates: one for bold, one for italic
    expect(textStyles).toHaveLength(2);

    const boldStyle = textStyles[0]?.updateTextStyle as Record<string, unknown>;
    const boldTs = boldStyle?.textStyle as Record<string, boolean>;
    expect(boldTs?.bold).toBe(true);

    const italicStyle = textStyles[1]?.updateTextStyle as Record<string, unknown>;
    const italicTs = italicStyle?.textStyle as Record<string, boolean>;
    expect(italicTs?.italic).toBe(true);
  });

  it('should handle a large 3x3 table with various content', () => {
    const tables: TableData[] = [
      {
        rows: 3,
        cols: 3,
        cells: [
          // 9 cells total
          [{ text: 'H1', bold: true }],
          [{ text: 'H2', bold: true }],
          [{ text: 'H3', bold: true }],
          [{ text: 'r1c1' }],
          [{ text: 'r1c2' }],
          [{ text: '' }], // empty cell
          [{ text: 'r2c1', italic: true }],
          [{ text: 'r2c2' }],
          [{ text: 'r2c3' }],
        ],
      },
    ];
    const indices = [[10, 20, 30, 40, 50, 60, 70, 80, 90]];

    const requests = generateTableCellRequests(tables, indices);
    const inserts = findRequests(requests, 'insertText');

    // 8 non-empty cells should produce insertText requests
    expect(inserts).toHaveLength(8);

    // First insert should be the last cell (reverse order), index 90
    const firstInsert = inserts[0]?.insertText as Record<string, unknown>;
    const firstLoc = firstInsert?.location as Record<string, number>;
    expect(firstLoc?.index).toBe(90);

    // Bold style requests: 3 header cells + italic for r2c1 = 4 style requests
    const textStyles = findRequests(requests, 'updateTextStyle');
    expect(textStyles).toHaveLength(4);
  });
});
