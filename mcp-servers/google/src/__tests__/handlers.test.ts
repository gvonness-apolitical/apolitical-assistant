import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GoogleAuth } from '../auth.js';
import {
  handleGmailSearch,
  handleGmailGetMessage,
  handleGmailListLabels,
  handleCalendarListEvents,
  handleCalendarGetFreeBusy,
  handleDriveSearch,
  handleDocsGetContent,
  handleSheetsGetValues,
  handleSlidesGetPresentation,
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

// Helper to create mock response
function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
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
      fetchMock.mockResolvedValueOnce(mockResponse({ messages: [] }));

      const result = await handleGmailSearch({ query: 'is:unread', maxResults: 10 }, auth);

      expect(result).toEqual({ messages: [], total: 0 });
    });

    it('should fetch message details for each result', async () => {
      // First call returns message list
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          messages: [{ id: 'msg1', threadId: 'thread1' }],
        })
      );

      // Second call fetches message details
      fetchMock.mockResolvedValueOnce(
        mockResponse({
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
      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 401));

      await expect(handleGmailSearch({ query: 'test', maxResults: 10 }, auth)).rejects.toThrow(
        'Gmail API error: 401'
      );
    });
  });

  describe('handleGmailGetMessage', () => {
    it('should parse message with body data', async () => {
      const base64Body = Buffer.from('Hello, World!').toString('base64');
      fetchMock.mockResolvedValueOnce(
        mockResponse({
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
        mockResponse({
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
        mockResponse({
          labels: [
            { id: 'INBOX', name: 'INBOX', type: 'system' },
            { id: 'Label_1', name: 'My Label', type: 'user' },
          ],
        })
      );

      const result = (await handleGmailListLabels(auth)) as Array<{
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
        mockResponse({
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
        mockResponse({
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
        mockResponse({
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
        mockResponse({
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

      const result = (await handleDriveSearch({ query: 'project', maxResults: 10 }, auth)) as Array<{
        id: string;
        name: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Project Report.docx');
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
        mockResponse({
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
        mockResponse({
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
        mockResponse({
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
});
