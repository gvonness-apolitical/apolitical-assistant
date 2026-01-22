import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from './auth.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return [
    // Gmail Tools
    {
      name: 'gmail_search',
      description: 'Search Gmail messages. Use Gmail search syntax (from:, to:, subject:, is:unread, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Gmail search query (e.g., "is:unread from:boss@company.com")',
          },
          maxResults: {
            type: 'number',
            default: 10,
            description: 'Maximum number of messages to return',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'gmail_get_message',
      description: 'Get the full content of a specific Gmail message by ID',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'The Gmail message ID',
          },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'gmail_list_labels',
      description: 'List all Gmail labels (folders)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'gmail_trash',
      description: 'Move Gmail messages to trash. Requires gmail.modify scope.',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Gmail message IDs to trash',
          },
        },
        required: ['messageIds'],
      },
    },
    {
      name: 'gmail_delete',
      description: 'Permanently delete Gmail messages (cannot be undone). Requires gmail.modify scope.',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Gmail message IDs to permanently delete',
          },
        },
        required: ['messageIds'],
      },
    },
    {
      name: 'gmail_archive',
      description: 'Archive Gmail messages (remove from inbox but keep in All Mail). Requires gmail.modify scope.',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Gmail message IDs to archive',
          },
        },
        required: ['messageIds'],
      },
    },

    // Calendar Tools
    {
      name: 'calendar_list_events',
      description: 'List calendar events within a time range',
      inputSchema: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start time (ISO format, defaults to now)',
          },
          timeMax: {
            type: 'string',
            description: 'End time (ISO format, defaults to 7 days from now)',
          },
          maxResults: {
            type: 'number',
            default: 20,
            description: 'Maximum number of events to return',
          },
          calendarId: {
            type: 'string',
            default: 'primary',
            description: 'Calendar ID (defaults to primary)',
          },
        },
      },
    },
    {
      name: 'calendar_get_event',
      description: 'Get details of a specific calendar event',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The calendar event ID',
          },
          calendarId: {
            type: 'string',
            default: 'primary',
            description: 'Calendar ID (defaults to primary)',
          },
        },
        required: ['eventId'],
      },
    },

    // Drive Tools
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

    // Docs Tools
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

    // Sheets Tools
    {
      name: 'sheets_get_values',
      description: 'Get values from a Google Sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The Google Sheet ID',
          },
          range: {
            type: 'string',
            description: 'The A1 notation range (e.g., "Sheet1!A1:D10")',
          },
        },
        required: ['spreadsheetId', 'range'],
      },
    },
    {
      name: 'sheets_get_metadata',
      description: 'Get metadata about a Google Sheet (sheets, named ranges, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: {
            type: 'string',
            description: 'The Google Sheet ID',
          },
        },
        required: ['spreadsheetId'],
      },
    },

    // Slides Tools
    {
      name: 'slides_get_presentation',
      description: 'Get the content and structure of a Google Slides presentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The Google Slides presentation ID',
          },
        },
        required: ['presentationId'],
      },
    },
  ];
}

// ==================== TOOL HANDLERS ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  auth: GoogleAuth
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    let result: unknown;

    switch (name) {
      // Gmail handlers
      case 'gmail_search': {
        const { query, maxResults = 10 } = args as { query: string; maxResults?: number };
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('q', query);
        url.searchParams.set('maxResults', maxResults.toString());

        const response = await auth.fetch(url.toString());
        if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

        const data = (await response.json()) as { messages?: Array<{ id: string; threadId: string }> };

        if (!data.messages || data.messages.length === 0) {
          result = { messages: [], total: 0 };
          break;
        }

        // Fetch details for each message
        const messages = await Promise.all(
          data.messages.slice(0, maxResults).map(async (msg) => {
            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
            const msgResponse = await auth.fetch(msgUrl);
            if (!msgResponse.ok) return null;
            const msgData = (await msgResponse.json()) as {
              id: string;
              snippet: string;
              labelIds: string[];
              payload: { headers: Array<{ name: string; value: string }> };
            };

            const headers = msgData.payload.headers.reduce(
              (acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }),
              {} as Record<string, string>
            );

            return {
              id: msgData.id,
              from: headers['from'],
              to: headers['to'],
              subject: headers['subject'],
              date: headers['date'],
              snippet: msgData.snippet,
              labels: msgData.labelIds,
            };
          })
        );

        result = { messages: messages.filter(Boolean), total: data.messages.length };
        break;
      }

      case 'gmail_get_message': {
        const { messageId } = args as { messageId: string };
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

        const data = (await response.json()) as {
          id: string;
          snippet: string;
          labelIds: string[];
          payload: {
            headers: Array<{ name: string; value: string }>;
            body?: { data?: string };
            parts?: Array<{ mimeType: string; body?: { data?: string } }>;
          };
        };

        const headers = data.payload.headers.reduce(
          (acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }),
          {} as Record<string, string>
        );

        // Extract body content
        let body = '';
        if (data.payload.body?.data) {
          body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
        } else if (data.payload.parts) {
          const textPart = data.payload.parts.find(
            (p) => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        result = {
          id: data.id,
          from: headers['from'],
          to: headers['to'],
          subject: headers['subject'],
          date: headers['date'],
          body: body.substring(0, 10000), // Limit body size
          labels: data.labelIds,
        };
        break;
      }

      case 'gmail_list_labels': {
        const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

        const data = (await response.json()) as {
          labels: Array<{ id: string; name: string; type: string }>;
        };

        result = data.labels.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
        }));
        break;
      }

      case 'gmail_trash': {
        const { messageIds } = args as { messageIds: string[] };
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const messageId of messageIds) {
          try {
            const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
            const response = await auth.fetch(url, { method: 'POST' });
            if (!response.ok) {
              results.push({ id: messageId, success: false, error: `HTTP ${response.status}` });
            } else {
              results.push({ id: messageId, success: true });
            }
          } catch (err) {
            results.push({ id: messageId, success: false, error: String(err) });
          }
        }

        result = {
          trashed: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          details: results,
        };
        break;
      }

      case 'gmail_delete': {
        const { messageIds } = args as { messageIds: string[] };
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const messageId of messageIds) {
          try {
            const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
            const response = await auth.fetch(url, { method: 'DELETE' });
            if (!response.ok) {
              results.push({ id: messageId, success: false, error: `HTTP ${response.status}` });
            } else {
              results.push({ id: messageId, success: true });
            }
          } catch (err) {
            results.push({ id: messageId, success: false, error: String(err) });
          }
        }

        result = {
          deleted: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          details: results,
        };
        break;
      }

      case 'gmail_archive': {
        const { messageIds } = args as { messageIds: string[] };
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const messageId of messageIds) {
          try {
            const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
            const response = await auth.fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
            });
            if (!response.ok) {
              results.push({ id: messageId, success: false, error: `HTTP ${response.status}` });
            } else {
              results.push({ id: messageId, success: true });
            }
          } catch (err) {
            results.push({ id: messageId, success: false, error: String(err) });
          }
        }

        result = {
          archived: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          details: results,
        };
        break;
      }

      // Calendar handlers
      case 'calendar_list_events': {
        const {
          timeMin = new Date().toISOString(),
          timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults = 20,
          calendarId = 'primary',
        } = args as {
          timeMin?: string;
          timeMax?: string;
          maxResults?: number;
          calendarId?: string;
        };

        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
        );
        url.searchParams.set('timeMin', timeMin);
        url.searchParams.set('timeMax', timeMax);
        url.searchParams.set('maxResults', maxResults.toString());
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');

        const response = await auth.fetch(url.toString());
        if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

        const data = (await response.json()) as {
          items: Array<{
            id: string;
            summary: string;
            description?: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
            attendees?: Array<{ email: string; displayName?: string; responseStatus: string }>;
            location?: string;
            hangoutLink?: string;
          }>;
        };

        result = data.items.map((event) => ({
          id: event.id,
          title: event.summary,
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          location: event.location,
          meetLink: event.hangoutLink,
          attendees: event.attendees?.map((a) => ({
            email: a.email,
            name: a.displayName,
            status: a.responseStatus,
          })),
        }));
        break;
      }

      case 'calendar_get_event': {
        const { eventId, calendarId = 'primary' } = args as {
          eventId: string;
          calendarId?: string;
        };

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

        result = await response.json();
        break;
      }

      // Drive handlers
      case 'drive_search': {
        const { query, mimeType, maxResults = 10 } = args as {
          query: string;
          mimeType?: string;
          maxResults?: number;
        };

        let driveQuery = `name contains '${query}' or fullText contains '${query}'`;
        if (mimeType) {
          driveQuery += ` and mimeType='${mimeType}'`;
        }

        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', driveQuery);
        url.searchParams.set('pageSize', maxResults.toString());
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

        result = data.files;
        break;
      }

      case 'drive_get_file': {
        const { fileId } = args as { fileId: string };

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,createdTime,size,webViewLink,owners,permissions`;
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Drive API error: ${response.status}`);

        result = await response.json();
        break;
      }

      // Docs handlers
      case 'docs_get_content': {
        const { documentId } = args as { documentId: string };

        const url = `https://docs.googleapis.com/v1/documents/${documentId}`;
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
          .map((block) =>
            block.paragraph!.elements
              .map((el) => el.textRun?.content || '')
              .join('')
          )
          .join('');

        result = {
          title: doc.title,
          content: textContent,
        };
        break;
      }

      // Sheets handlers
      case 'sheets_get_values': {
        const { spreadsheetId, range } = args as { spreadsheetId: string; range: string };

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

        result = await response.json();
        break;
      }

      case 'sheets_get_metadata': {
        const { spreadsheetId } = args as { spreadsheetId: string };

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties,sheets.properties,namedRanges`;
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Sheets API error: ${response.status}`);

        result = await response.json();
        break;
      }

      // Slides handlers
      case 'slides_get_presentation': {
        const { presentationId } = args as { presentationId: string };

        const url = `https://slides.googleapis.com/v1/presentations/${presentationId}`;
        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Slides API error: ${response.status}`);

        const presentation = (await response.json()) as {
          title: string;
          slides: Array<{
            objectId: string;
            pageElements?: Array<{
              shape?: {
                text?: {
                  textElements?: Array<{
                    textRun?: { content: string };
                  }>;
                };
              };
            }>;
          }>;
        };

        // Extract text from slides
        const slides = presentation.slides.map((slide, index) => {
          const textContent = slide.pageElements
            ?.filter((el) => el.shape?.text)
            .map((el) =>
              el.shape!.text!.textElements
                ?.map((te) => te.textRun?.content || '')
                .join('') || ''
            )
            .join('\n') || '';

          return {
            slideNumber: index + 1,
            id: slide.objectId,
            content: textContent,
          };
        });

        result = {
          title: presentation.title,
          slideCount: slides.length,
          slides,
        };
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
