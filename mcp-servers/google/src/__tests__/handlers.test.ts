import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockJsonResponse } from '@apolitical-assistant/mcp-shared/testing';
import { RawResponse } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';
import {
  handleGmailSearch,
  handleGmailGetMessage,
  handleGmailListLabels,
  handleCalendarListEvents,
  handleCalendarGetFreeBusy,
  handleDriveSearch,
  handleDriveExport,
  handleDocsGetContent,
  handleDocsGetComments,
  handleDocsCreate,
  handleDocsUpdate,
  handleSheetsGetValues,
  handleSheetsCreate,
  handleSheetsUpdateValues,
  handleSlidesGetPresentation,
  handleSlidesGetThumbnail,
  handleSlidesCreate,
  handleSlidesAddSlide,
} from '../handlers/index.js';

// Create a mock GoogleAuth for testing
function createMockAuth(fetchMock: typeof fetch): GoogleAuth {
  return {
    fetch: async (url: string, options?: RequestInit) => {
      return fetchMock(url, options);
    },
    getAccessToken: async () => 'mock-token',
  } as GoogleAuth;
}

describe('Gmail Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleGmailSearch', () => {
    it('should return empty results when no messages found', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ messages: [] }));

      const result = await handleGmailSearch({ query: 'is:unread', maxResults: 10 }, auth);

      expect(result).toEqual({ messages: [], total: 0 });
    });

    it('should fetch message details for each result', async () => {
      // First call returns message list
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          messages: [{ id: 'msg1', threadId: 'thread1' }],
        })
      );

      // Second call fetches message details
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          id: 'msg1',
          snippet: 'Test snippet',
          labelIds: ['INBOX'],
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'Subject', value: 'Test Subject' },
            ],
          },
        })
      );

      const result = (await handleGmailSearch({ query: 'test', maxResults: 10 }, auth)) as {
        messages: Array<{ id: string; from: string; subject: string }>;
        total: number;
      };

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.from).toBe('sender@example.com');
      expect(result.messages[0]?.subject).toBe('Test Subject');
      expect(result.total).toBe(1);
    });

    it('should handle API errors', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 401));

      await expect(handleGmailSearch({ query: 'test', maxResults: 10 }, auth)).rejects.toThrow(
        'Gmail API error: 401'
      );
    });
  });

  describe('handleGmailGetMessage', () => {
    it('should parse message with body data', async () => {
      const base64Body = Buffer.from('Hello, World!').toString('base64');
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          id: 'msg123',
          snippet: 'Hello...',
          labelIds: ['INBOX', 'UNREAD'],
          payload: {
            headers: [
              { name: 'From', value: 'sender@test.com' },
              { name: 'Subject', value: 'Test Email' },
            ],
            body: { data: base64Body },
          },
        })
      );

      const result = (await handleGmailGetMessage({ messageId: 'msg123' }, auth)) as {
        id: string;
        body: string;
        from: string;
      };

      expect(result.id).toBe('msg123');
      expect(result.body).toBe('Hello, World!');
      expect(result.from).toBe('sender@test.com');
    });

    it('should extract body from multipart message', async () => {
      const base64Body = Buffer.from('Plain text content').toString('base64');
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          id: 'msg456',
          snippet: 'Plain...',
          labelIds: ['INBOX'],
          payload: {
            headers: [{ name: 'From', value: 'test@test.com' }],
            parts: [
              { mimeType: 'text/plain', body: { data: base64Body } },
              { mimeType: 'text/html', body: { data: 'html-content' } },
            ],
          },
        })
      );

      const result = (await handleGmailGetMessage({ messageId: 'msg456' }, auth)) as {
        body: string;
      };

      expect(result.body).toBe('Plain text content');
    });
  });

  describe('handleGmailListLabels', () => {
    it('should return formatted labels', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          labels: [
            { id: 'INBOX', name: 'INBOX', type: 'system' },
            { id: 'Label_1', name: 'My Label', type: 'user' },
          ],
        })
      );

      const result = (await handleGmailListLabels({}, auth)) as Array<{
        id: string;
        name: string;
        type: string;
      }>;

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('INBOX');
      expect(result[1]?.type).toBe('user');
    });
  });
});

describe('Calendar Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleCalendarListEvents', () => {
    it('should return formatted events', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          items: [
            {
              id: 'event1',
              summary: 'Team Meeting',
              start: { dateTime: '2024-01-15T10:00:00Z' },
              end: { dateTime: '2024-01-15T11:00:00Z' },
              attendees: [{ email: 'alice@test.com', responseStatus: 'accepted' }],
            },
          ],
        })
      );

      const result = (await handleCalendarListEvents(
        { maxResults: 20, calendarId: 'primary' },
        auth
      )) as Array<{ id: string; title: string; start: string }>;

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Team Meeting');
      expect(result[0]?.start).toBe('2024-01-15T10:00:00Z');
    });

    it('should handle all-day events', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          items: [
            {
              id: 'event2',
              summary: 'Holiday',
              start: { date: '2024-12-25' },
              end: { date: '2024-12-26' },
            },
          ],
        })
      );

      const result = (await handleCalendarListEvents(
        { maxResults: 10, calendarId: 'primary' },
        auth
      )) as Array<{ start: string; end: string }>;

      expect(result[0]?.start).toBe('2024-12-25');
      expect(result[0]?.end).toBe('2024-12-26');
    });
  });

  describe('handleCalendarGetFreeBusy', () => {
    it('should return availability for calendars', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          calendars: {
            'user@test.com': {
              busy: [
                { start: '2024-01-15T10:00:00Z', end: '2024-01-15T11:00:00Z' },
                { start: '2024-01-15T14:00:00Z', end: '2024-01-15T15:00:00Z' },
              ],
            },
          },
        })
      );

      const result = (await handleCalendarGetFreeBusy(
        {
          timeMin: '2024-01-15T09:00:00Z',
          timeMax: '2024-01-15T18:00:00Z',
          calendarIds: ['user@test.com'],
        },
        auth
      )) as {
        calendars: Record<string, { busyCount: number }>;
      };

      expect(result.calendars['user@test.com']?.busyCount).toBe(2);
    });
  });
});

describe('Drive Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleDriveSearch', () => {
    it('should return search results', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          files: [
            {
              id: 'file1',
              name: 'Project Report.docx',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2024-01-10T12:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/file1',
            },
          ],
        })
      );

      const result = (await handleDriveSearch(
        { query: 'project', maxResults: 10 },
        auth
      )) as Array<{
        id: string;
        name: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Project Report.docx');
    });
  });

  describe('handleDriveExport', () => {
    it('should export a native Google file using export endpoint', async () => {
      // Metadata response - native Google Slides file
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          name: 'My Presentation',
          mimeType: 'application/vnd.google-apps.presentation',
        })
      );

      // Export response (binary content)
      const pdfContent = Buffer.from('fake-pdf-content');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          pdfContent.buffer.slice(
            pdfContent.byteOffset,
            pdfContent.byteOffset + pdfContent.byteLength
          ),
      } as Response);

      const result = (await handleDriveExport(
        { fileId: 'pres-123', mimeType: 'application/pdf', outputPath: '/tmp/test-export.pdf' },
        auth
      )) as { filePath: string; fileName: string; mimeType: string; fileSize: number };

      expect(result.filePath).toBe('/tmp/test-export.pdf');
      expect(result.fileName).toBe('My Presentation');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileSize).toBe(pdfContent.length);

      // Verify export URL was called (second call)
      const exportCall = fetchMock.mock.calls[1]![0] as string;
      expect(exportCall).toContain('/export');
      expect(exportCall).toContain('mimeType=application%2Fpdf');
    });

    it('should download a non-native file using media endpoint', async () => {
      // Metadata response - uploaded PDF
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({ name: 'uploaded.pdf', mimeType: 'application/pdf' })
      );

      // Media download response
      const fileContent = Buffer.from('raw-pdf-bytes');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          fileContent.buffer.slice(
            fileContent.byteOffset,
            fileContent.byteOffset + fileContent.byteLength
          ),
      } as Response);

      const result = (await handleDriveExport(
        { fileId: 'file-456', mimeType: 'application/pdf', outputPath: '/tmp/test-download.pdf' },
        auth
      )) as { filePath: string; mimeType: string };

      expect(result.filePath).toBe('/tmp/test-download.pdf');
      expect(result.mimeType).toBe('application/pdf');

      // Verify media URL was called (not export)
      const downloadCall = fetchMock.mock.calls[1]![0] as string;
      expect(downloadCall).toContain('alt=media');
      expect(downloadCall).not.toContain('/export');
    });

    it('should handle API errors on metadata fetch', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

      await expect(
        handleDriveExport({ fileId: 'bad-id', mimeType: 'application/pdf' }, auth)
      ).rejects.toThrow('Drive API error: 404');
    });

    it('should handle API errors on export/download', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({ name: 'file', mimeType: 'application/vnd.google-apps.document' })
      );
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 403));

      await expect(
        handleDriveExport({ fileId: 'file-123', mimeType: 'application/pdf' }, auth)
      ).rejects.toThrow('Drive export/download error: 403');
    });
  });
});

describe('Docs Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleDocsGetContent', () => {
    it('should extract text content from document', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          title: 'My Document',
          body: {
            content: [
              {
                paragraph: {
                  elements: [{ textRun: { content: 'Hello ' } }, { textRun: { content: 'World' } }],
                },
              },
              {
                paragraph: {
                  elements: [{ textRun: { content: 'Second paragraph' } }],
                },
              },
            ],
          },
        })
      );

      const result = (await handleDocsGetContent({ documentId: 'doc123' }, auth)) as {
        title: string;
        content: string;
      };

      expect(result.title).toBe('My Document');
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('Second paragraph');
    });
  });

  describe('handleDocsGetComments', () => {
    it('should return formatted comments with author and replies', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          comments: [
            {
              id: 'comment1',
              content: 'This needs revision',
              author: { displayName: 'Alice', emailAddress: 'alice@test.com' },
              createdTime: '2024-01-15T10:00:00Z',
              resolved: false,
              replies: [
                {
                  content: 'Agreed, will fix',
                  author: { displayName: 'Bob', emailAddress: 'bob@test.com' },
                  createdTime: '2024-01-15T11:00:00Z',
                },
              ],
            },
          ],
        })
      );

      const result = (await handleDocsGetComments(
        { documentId: 'doc123', includeResolved: false },
        auth
      )) as {
        documentId: string;
        commentCount: number;
        comments: Array<{
          id: string;
          content: string;
          author: string;
          authorEmail: string;
          resolved: boolean;
          replies: Array<{ content: string; author: string }>;
        }>;
      };

      expect(result.documentId).toBe('doc123');
      expect(result.commentCount).toBe(1);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.content).toBe('This needs revision');
      expect(result.comments[0]?.author).toBe('Alice');
      expect(result.comments[0]?.authorEmail).toBe('alice@test.com');
      expect(result.comments[0]?.replies).toHaveLength(1);
      expect(result.comments[0]?.replies[0]?.content).toBe('Agreed, will fix');
      expect(result.comments[0]?.replies[0]?.author).toBe('Bob');
    });

    it('should filter resolved comments when includeResolved is false', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          comments: [
            {
              id: 'c1',
              content: 'Open comment',
              author: { displayName: 'Alice' },
              createdTime: '2024-01-15T10:00:00Z',
              resolved: false,
            },
            {
              id: 'c2',
              content: 'Resolved comment',
              author: { displayName: 'Bob' },
              createdTime: '2024-01-14T10:00:00Z',
              resolved: true,
            },
          ],
        })
      );

      const result = (await handleDocsGetComments(
        { documentId: 'doc123', includeResolved: false },
        auth
      )) as {
        commentCount: number;
        comments: Array<{ id: string; resolved: boolean }>;
      };

      expect(result.commentCount).toBe(1);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.id).toBe('c1');
    });

    it('should include resolved comments when includeResolved is true', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          comments: [
            {
              id: 'c1',
              content: 'Open comment',
              author: { displayName: 'Alice' },
              createdTime: '2024-01-15T10:00:00Z',
              resolved: false,
            },
            {
              id: 'c2',
              content: 'Resolved comment',
              author: { displayName: 'Bob' },
              createdTime: '2024-01-14T10:00:00Z',
              resolved: true,
            },
          ],
        })
      );

      const result = (await handleDocsGetComments(
        { documentId: 'doc123', includeResolved: true },
        auth
      )) as {
        commentCount: number;
        comments: Array<{ id: string }>;
      };

      expect(result.commentCount).toBe(2);
      expect(result.comments).toHaveLength(2);
    });

    it('should handle API error', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 403));

      await expect(
        handleDocsGetComments({ documentId: 'bad-id', includeResolved: false }, auth)
      ).rejects.toThrow('Drive API error: 403');
    });
  });

  describe('handleDocsCreate', () => {
    it('should create doc with title only (no content)', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          documentId: 'new-doc-123',
          title: 'My New Doc',
        })
      );

      const result = (await handleDocsCreate({ title: 'My New Doc' }, auth)) as {
        documentId: string;
        title: string;
        url: string;
      };

      expect(result.documentId).toBe('new-doc-123');
      expect(result.title).toBe('My New Doc');
      expect(result.url).toBe('https://docs.google.com/document/d/new-doc-123/edit');

      // Only one fetch call (create), no batchUpdate
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should create doc with markdown content (calls create + batchUpdate)', async () => {
      // First call: create the document
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          documentId: 'new-doc-456',
          title: 'Doc With Content',
        })
      );

      // Second call: batchUpdate with parsed markdown content
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleDocsCreate(
        { title: 'Doc With Content', content: '# Heading\n\nSome body text' },
        auth
      )) as {
        documentId: string;
        title: string;
        url: string;
      };

      expect(result.documentId).toBe('new-doc-456');
      expect(result.title).toBe('Doc With Content');
      expect(result.url).toBe('https://docs.google.com/document/d/new-doc-456/edit');

      // Two fetch calls: create + batchUpdate
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify the batchUpdate URL
      const batchUpdateCall = fetchMock.mock.calls[1]![0] as string;
      expect(batchUpdateCall).toContain('new-doc-456:batchUpdate');
    });

    it('should handle create API error', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));

      await expect(handleDocsCreate({ title: 'Fail Doc' }, auth)).rejects.toThrow(
        'Docs API error creating document: 500'
      );
    });
  });

  describe('handleDocsUpdate', () => {
    it('should replace content (GET existing, delete range, insert)', async () => {
      // First call: GET the existing document
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          title: 'Existing Doc',
          body: { content: [{ endIndex: 50 }] },
        })
      );

      // Second call: batchUpdate (delete + insert)
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleDocsUpdate(
        { documentId: 'doc-789', content: 'New content here', append: false },
        auth
      )) as {
        documentId: string;
        title: string;
        url: string;
        action: string;
      };

      expect(result.documentId).toBe('doc-789');
      expect(result.title).toBe('Existing Doc');
      expect(result.action).toBe('replaced');
      expect(result.url).toBe('https://docs.google.com/document/d/doc-789/edit');

      // Verify the batchUpdate body contains a deleteContentRange request
      const batchUpdateArgs = fetchMock.mock.calls[1]!;
      const body = JSON.parse(batchUpdateArgs[1]?.body as string);
      const deleteRequest = body.requests.find(
        (r: Record<string, unknown>) => r.deleteContentRange
      );
      expect(deleteRequest).toBeDefined();
      expect(
        (deleteRequest.deleteContentRange as { range: { startIndex: number; endIndex: number } })
          .range.startIndex
      ).toBe(1);
      expect(
        (deleteRequest.deleteContentRange as { range: { startIndex: number; endIndex: number } })
          .range.endIndex
      ).toBe(49);
    });

    it('should append content (GET existing, insert at end, no delete)', async () => {
      // First call: GET the existing document
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          title: 'Existing Doc',
          body: { content: [{ endIndex: 50 }] },
        })
      );

      // Second call: batchUpdate (insert only, no delete)
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleDocsUpdate(
        { documentId: 'doc-789', content: 'Appended content', append: true },
        auth
      )) as {
        action: string;
      };

      expect(result.action).toBe('appended');

      // Verify the batchUpdate body does NOT contain a deleteContentRange request
      const batchUpdateArgs = fetchMock.mock.calls[1]!;
      const body = JSON.parse(batchUpdateArgs[1]?.body as string);
      const deleteRequest = body.requests.find(
        (r: Record<string, unknown>) => r.deleteContentRange
      );
      expect(deleteRequest).toBeUndefined();
    });

    it('should handle GET API error', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

      await expect(
        handleDocsUpdate({ documentId: 'bad-id', content: 'test', append: false }, auth)
      ).rejects.toThrow('Docs API error fetching document: 404');
    });
  });
});

describe('Sheets Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleSheetsGetValues', () => {
    it('should return sheet values', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          range: 'Sheet1!A1:B3',
          values: [
            ['Name', 'Value'],
            ['Item 1', '100'],
            ['Item 2', '200'],
          ],
        })
      );

      const result = (await handleSheetsGetValues(
        { spreadsheetId: 'sheet123', range: 'Sheet1!A1:B3' },
        auth
      )) as { values: string[][] };

      expect(result.values).toHaveLength(3);
      expect(result.values[0]).toEqual(['Name', 'Value']);
    });
  });

  describe('handleSheetsCreate', () => {
    it('should create a spreadsheet with default sheet', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          spreadsheetId: 'new-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-sheet-id',
          properties: { title: 'My Spreadsheet' },
          sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }],
        })
      );

      const result = (await handleSheetsCreate({ title: 'My Spreadsheet' }, auth)) as {
        spreadsheetId: string;
        spreadsheetUrl: string;
        title: string;
        sheets: Array<{ title: string; sheetId: number }>;
      };

      expect(result.spreadsheetId).toBe('new-sheet-id');
      expect(result.title).toBe('My Spreadsheet');
      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0]?.title).toBe('Sheet1');
    });

    it('should create a spreadsheet with named sheets', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          spreadsheetId: 'new-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-sheet-id',
          properties: { title: 'OKR Tracker' },
          sheets: [
            { properties: { title: 'Summary', sheetId: 0 } },
            { properties: { title: 'Initiatives', sheetId: 1 } },
          ],
        })
      );

      const result = (await handleSheetsCreate(
        { title: 'OKR Tracker', sheetNames: ['Summary', 'Initiatives'] },
        auth
      )) as {
        sheets: Array<{ title: string }>;
      };

      expect(result.sheets).toHaveLength(2);
      expect(result.sheets[0]?.title).toBe('Summary');
      expect(result.sheets[1]?.title).toBe('Initiatives');

      // Verify the POST body
      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.properties.title).toBe('OKR Tracker');
      expect(body.sheets).toHaveLength(2);
    });

    it('should handle API errors', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 403));

      await expect(handleSheetsCreate({ title: 'Test' }, auth)).rejects.toThrow(
        'Sheets API error: 403'
      );
    });
  });

  describe('handleSheetsUpdateValues', () => {
    it('should update values in a range', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          spreadsheetId: 'sheet123',
          updatedRange: 'Sheet1!A1:B2',
          updatedRows: 2,
          updatedColumns: 2,
          updatedCells: 4,
        })
      );

      const result = (await handleSheetsUpdateValues(
        {
          spreadsheetId: 'sheet123',
          range: 'Sheet1!A1:B2',
          values: [
            ['Name', 'Value'],
            ['Item 1', '100'],
          ],
        },
        auth
      )) as { updatedCells: number };

      expect(result.updatedCells).toBe(4);

      // Verify the PUT body
      const callArgs = fetchMock.mock.calls[0]!;
      expect(callArgs[1]?.method).toBe('PUT');
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.values).toHaveLength(2);
      expect(body.majorDimension).toBe('ROWS');
    });

    it('should handle API errors', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

      await expect(
        handleSheetsUpdateValues(
          { spreadsheetId: 'bad-id', range: 'Sheet1!A1', values: [['test']] },
          auth
        )
      ).rejects.toThrow('Sheets API error: 404');
    });
  });
});

describe('Slides Handlers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  describe('handleSlidesGetPresentation', () => {
    it('should extract text from slides', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          title: 'My Presentation',
          slides: [
            {
              objectId: 'slide1',
              pageElements: [
                {
                  shape: {
                    text: {
                      textElements: [{ textRun: { content: 'Slide 1 Title' } }],
                    },
                  },
                },
              ],
            },
            {
              objectId: 'slide2',
              pageElements: [
                {
                  shape: {
                    text: {
                      textElements: [{ textRun: { content: 'Slide 2 Content' } }],
                    },
                  },
                },
              ],
            },
          ],
        })
      );

      const result = (await handleSlidesGetPresentation({ presentationId: 'pres123' }, auth)) as {
        title: string;
        slideCount: number;
        slides: Array<{ slideNumber: number; content: string }>;
      };

      expect(result.title).toBe('My Presentation');
      expect(result.slideCount).toBe(2);
      expect(result.slides[0]?.content).toContain('Slide 1 Title');
      expect(result.slides[1]?.slideNumber).toBe(2);
    });
  });

  describe('handleSlidesGetThumbnail', () => {
    it('should return a RawResponse with image content', async () => {
      // Thumbnail API response
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          contentUrl: 'https://lh3.googleusercontent.com/thumb-image-url',
          width: 1600,
          height: 900,
        })
      );

      // Image download response
      const imageBytes = Buffer.from('fake-png-image-data');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          imageBytes.buffer.slice(
            imageBytes.byteOffset,
            imageBytes.byteOffset + imageBytes.byteLength
          ),
      } as Response);

      const result = await handleSlidesGetThumbnail(
        { presentationId: 'pres-123', pageObjectId: 'slide-1', thumbnailSize: 'LARGE' },
        auth
      );

      expect(result).toBeInstanceOf(RawResponse);
      const response = result.response;
      expect(response.content).toHaveLength(2);
      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'Slide thumbnail (1600x900)',
      });
      expect(response.content[1]!.type).toBe('image');
      const imageItem = response.content[1] as { type: 'image'; data: string; mimeType: string };
      expect(imageItem.mimeType).toBe('image/png');
      expect(imageItem.data).toBe(imageBytes.toString('base64'));

      // Verify thumbnail URL was correct
      const thumbCall = fetchMock.mock.calls[0]![0] as string;
      expect(thumbCall).toContain('/pages/slide-1/thumbnail');
      expect(thumbCall).toContain('thumbnailSize=LARGE');
    });

    it('should handle thumbnail API errors', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

      await expect(
        handleSlidesGetThumbnail(
          { presentationId: 'pres-123', pageObjectId: 'bad-id', thumbnailSize: 'LARGE' },
          auth
        )
      ).rejects.toThrow('Slides thumbnail API error: 404');
    });

    it('should handle image download errors', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          contentUrl: 'https://lh3.googleusercontent.com/thumb-url',
          width: 800,
          height: 450,
        })
      );
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));

      await expect(
        handleSlidesGetThumbnail(
          { presentationId: 'pres-123', pageObjectId: 'slide-1', thumbnailSize: 'MEDIUM' },
          auth
        )
      ).rejects.toThrow('Failed to download thumbnail: 500');
    });
  });

  describe('handleSlidesCreate', () => {
    it('should create presentation with title only', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          presentationId: 'pres-new-1',
          title: 'My Presentation',
          slides: [{ objectId: 'default-slide' }],
        })
      );

      const result = (await handleSlidesCreate({ title: 'My Presentation' }, auth)) as {
        presentationId: string;
        title: string;
        url: string;
        slideCount: number;
      };

      expect(result.presentationId).toBe('pres-new-1');
      expect(result.title).toBe('My Presentation');
      expect(result.url).toBe('https://docs.google.com/presentation/d/pres-new-1/edit');
      expect(result.slideCount).toBe(1);

      // Only one fetch call (create), no batchUpdate since no slides provided
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should create presentation with slides including title, body, and bullet points', async () => {
      // First call: create the presentation
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          presentationId: 'pres-new-2',
          title: 'Full Presentation',
          slides: [{ objectId: 'default-slide' }],
        })
      );

      // Second call: batchUpdate to add slides
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleSlidesCreate(
        {
          title: 'Full Presentation',
          slides: [
            {
              title: 'Introduction',
              body: '- Point one\n- Point two\n- Point three',
              layout: 'TITLE_AND_BODY',
            },
            {
              title: 'Summary',
              body: 'Final thoughts on the topic',
              layout: 'TITLE_AND_BODY',
            },
          ],
        },
        auth
      )) as {
        presentationId: string;
        title: string;
        slideCount: number;
      };

      expect(result.presentationId).toBe('pres-new-2');
      expect(result.title).toBe('Full Presentation');
      expect(result.slideCount).toBe(2);

      // Two fetch calls: create + batchUpdate
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify the batchUpdate URL
      const batchUpdateCall = fetchMock.mock.calls[1]![0] as string;
      expect(batchUpdateCall).toContain('pres-new-2:batchUpdate');

      // Verify the batchUpdate body contains deleteObject (for default slide) and createSlide requests
      const body = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
      const deleteRequest = body.requests.find((r: Record<string, unknown>) => r.deleteObject);
      expect(deleteRequest).toBeDefined();
      const createSlideRequests = body.requests.filter(
        (r: Record<string, unknown>) => r.createSlide
      );
      expect(createSlideRequests).toHaveLength(2);
    });

    it('should handle API error', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 403));

      await expect(handleSlidesCreate({ title: 'Fail Presentation' }, auth)).rejects.toThrow(
        'Slides API error creating presentation: 403'
      );
    });
  });

  describe('handleSlidesAddSlide', () => {
    it('should add slide with title and body', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleSlidesAddSlide(
        {
          presentationId: 'pres-existing',
          title: 'New Slide Title',
          body: 'Slide body content',
          layout: 'TITLE_AND_BODY',
        },
        auth
      )) as {
        presentationId: string;
        slideId: string;
        url: string;
      };

      expect(result.presentationId).toBe('pres-existing');
      expect(result.slideId).toBeDefined();
      expect(result.url).toBe('https://docs.google.com/presentation/d/pres-existing/edit');

      // Verify the batchUpdate body contains createSlide and insertText requests
      const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
      const createSlide = body.requests.find((r: Record<string, unknown>) => r.createSlide);
      expect(createSlide).toBeDefined();
      const insertTexts = body.requests.filter((r: Record<string, unknown>) => r.insertText);
      expect(insertTexts.length).toBeGreaterThanOrEqual(2); // title + body
    });

    it('should add slide at specific insertion index', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      const result = (await handleSlidesAddSlide(
        {
          presentationId: 'pres-existing',
          title: 'Inserted Slide',
          layout: 'TITLE_AND_BODY',
          insertionIndex: 2,
        },
        auth
      )) as {
        presentationId: string;
        slideId: string;
      };

      expect(result.presentationId).toBe('pres-existing');
      expect(result.slideId).toBeDefined();

      // Verify the createSlide request includes insertionIndex
      const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
      const createSlide = body.requests.find((r: Record<string, unknown>) => r.createSlide);
      expect((createSlide.createSlide as { insertionIndex: number }).insertionIndex).toBe(2);
    });

    it('should handle API error', async () => {
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));

      await expect(
        handleSlidesAddSlide(
          {
            presentationId: 'pres-bad',
            title: 'Fail Slide',
            layout: 'TITLE_AND_BODY',
          },
          auth
        )
      ).rejects.toThrow('Slides API error adding slide: 500');
    });
  });
});
