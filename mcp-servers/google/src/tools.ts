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
    {
      name: 'gmail_send_message',
      description: 'Send an email message. Requires gmail.send scope.',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of recipient email addresses',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body (plain text)',
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of CC email addresses',
          },
          bcc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of BCC email addresses',
          },
          replyToMessageId: {
            type: 'string',
            description: 'Message ID to reply to (sets In-Reply-To and References headers)',
          },
          threadId: {
            type: 'string',
            description: 'Thread ID to add the message to',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'gmail_create_draft',
      description: 'Create a draft email (not sent). Useful for composing emails that need review before sending.',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of recipient email addresses',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body (plain text)',
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of CC email addresses',
          },
          bcc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of BCC email addresses',
          },
          replyToMessageId: {
            type: 'string',
            description: 'Message ID to reply to',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'gmail_get_attachments',
      description: 'Get list of attachments for a Gmail message with their metadata',
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
    {
      name: 'calendar_list_calendars',
      description: 'List all calendars the user has access to, including meeting rooms and shared calendars',
      inputSchema: {
        type: 'object',
        properties: {
          showHidden: {
            type: 'boolean',
            default: false,
            description: 'Include hidden calendars',
          },
        },
      },
    },
    {
      name: 'calendar_get_freebusy',
      description: 'Check availability (free/busy) for multiple calendars within a time range. Useful for finding meeting slots.',
      inputSchema: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start of time range (ISO format)',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range (ISO format)',
          },
          calendarIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of calendar IDs to check (use email addresses for people, resource IDs for rooms)',
          },
        },
        required: ['timeMin', 'timeMax', 'calendarIds'],
      },
    },
    {
      name: 'calendar_create_event',
      description: 'Create a new calendar event with attendees and optional meeting room',
      inputSchema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Event title',
          },
          description: {
            type: 'string',
            description: 'Event description',
          },
          start: {
            type: 'string',
            description: 'Start time (ISO format)',
          },
          end: {
            type: 'string',
            description: 'End time (ISO format)',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of attendee email addresses',
          },
          location: {
            type: 'string',
            description: 'Event location or meeting room',
          },
          conferenceData: {
            type: 'boolean',
            default: false,
            description: 'Generate a Google Meet link',
          },
          calendarId: {
            type: 'string',
            default: 'primary',
            description: 'Calendar to create event on',
          },
          sendNotifications: {
            type: 'boolean',
            default: true,
            description: 'Send email invitations to attendees',
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
    {
      name: 'calendar_update_event',
      description: 'Update an existing calendar event',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The event ID to update',
          },
          summary: {
            type: 'string',
            description: 'New event title',
          },
          description: {
            type: 'string',
            description: 'New event description',
          },
          start: {
            type: 'string',
            description: 'New start time (ISO format)',
          },
          end: {
            type: 'string',
            description: 'New end time (ISO format)',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of attendee email addresses (replaces existing)',
          },
          location: {
            type: 'string',
            description: 'New location',
          },
          calendarId: {
            type: 'string',
            default: 'primary',
            description: 'Calendar the event is on',
          },
          sendNotifications: {
            type: 'boolean',
            default: true,
            description: 'Send update notifications to attendees',
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

      case 'gmail_send_message': {
        const { to, subject, body, cc, bcc, replyToMessageId, threadId } = args as {
          to: string[];
          subject: string;
          body: string;
          cc?: string[];
          bcc?: string[];
          replyToMessageId?: string;
          threadId?: string;
        };

        // Build RFC 2822 message
        const messageParts: string[] = [];
        messageParts.push(`To: ${to.join(', ')}`);
        if (cc && cc.length > 0) messageParts.push(`Cc: ${cc.join(', ')}`);
        if (bcc && bcc.length > 0) messageParts.push(`Bcc: ${bcc.join(', ')}`);
        messageParts.push(`Subject: ${subject}`);
        if (replyToMessageId) {
          messageParts.push(`In-Reply-To: ${replyToMessageId}`);
          messageParts.push(`References: ${replyToMessageId}`);
        }
        messageParts.push('Content-Type: text/plain; charset=utf-8');
        messageParts.push('');
        messageParts.push(body);

        const rawMessage = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const requestBody: Record<string, unknown> = { raw: encodedMessage };
        if (threadId) requestBody.threadId = threadId;

        const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
        const response = await auth.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gmail send error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as { id: string; threadId: string };
        result = {
          success: true,
          messageId: data.id,
          threadId: data.threadId,
        };
        break;
      }

      case 'gmail_create_draft': {
        const { to, subject, body, cc, bcc, replyToMessageId } = args as {
          to: string[];
          subject: string;
          body: string;
          cc?: string[];
          bcc?: string[];
          replyToMessageId?: string;
        };

        // Build RFC 2822 message
        const messageParts: string[] = [];
        messageParts.push(`To: ${to.join(', ')}`);
        if (cc && cc.length > 0) messageParts.push(`Cc: ${cc.join(', ')}`);
        if (bcc && bcc.length > 0) messageParts.push(`Bcc: ${bcc.join(', ')}`);
        messageParts.push(`Subject: ${subject}`);
        if (replyToMessageId) {
          messageParts.push(`In-Reply-To: ${replyToMessageId}`);
          messageParts.push(`References: ${replyToMessageId}`);
        }
        messageParts.push('Content-Type: text/plain; charset=utf-8');
        messageParts.push('');
        messageParts.push(body);

        const rawMessage = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(rawMessage)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const url = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
        const response = await auth.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { raw: encodedMessage } }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gmail draft error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as { id: string; message: { id: string } };
        result = {
          success: true,
          draftId: data.id,
          messageId: data.message.id,
          note: 'Draft created. Open Gmail to review and send.',
        };
        break;
      }

      case 'gmail_get_attachments': {
        const { messageId } = args as { messageId: string };
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

        const response = await auth.fetch(url);
        if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

        const data = (await response.json()) as {
          payload: {
            parts?: Array<{
              filename?: string;
              mimeType: string;
              body?: { attachmentId?: string; size?: number };
              parts?: Array<{
                filename?: string;
                mimeType: string;
                body?: { attachmentId?: string; size?: number };
              }>;
            }>;
          };
        };

        const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }> = [];

        const extractAttachments = (parts: typeof data.payload.parts) => {
          if (!parts) return;
          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size || 0,
                attachmentId: part.body.attachmentId,
              });
            }
            if (part.parts) extractAttachments(part.parts);
          }
        };

        extractAttachments(data.payload.parts);

        result = {
          messageId,
          attachmentCount: attachments.length,
          attachments,
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

      case 'calendar_list_calendars': {
        const { showHidden = false } = args as { showHidden?: boolean };

        const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
        if (showHidden) url.searchParams.set('showHidden', 'true');

        const response = await auth.fetch(url.toString());
        if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

        const data = (await response.json()) as {
          items: Array<{
            id: string;
            summary: string;
            description?: string;
            primary?: boolean;
            accessRole: string;
            backgroundColor?: string;
          }>;
        };

        result = data.items.map((cal) => ({
          id: cal.id,
          name: cal.summary,
          description: cal.description,
          primary: cal.primary || false,
          accessRole: cal.accessRole,
          isRoom: cal.id.includes('resource.calendar.google.com'),
        }));
        break;
      }

      case 'calendar_get_freebusy': {
        const { timeMin, timeMax, calendarIds } = args as {
          timeMin: string;
          timeMax: string;
          calendarIds: string[];
        };

        const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
        const response = await auth.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: calendarIds.map((id) => ({ id })),
          }),
        });

        if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

        const data = (await response.json()) as {
          calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
        };

        // Transform to more usable format
        const availability: Record<string, { busy: Array<{ start: string; end: string }>; busyCount: number }> = {};
        for (const [calId, info] of Object.entries(data.calendars)) {
          availability[calId] = {
            busy: info.busy,
            busyCount: info.busy.length,
          };
        }

        result = {
          timeRange: { start: timeMin, end: timeMax },
          calendars: availability,
        };
        break;
      }

      case 'calendar_create_event': {
        const {
          summary,
          description,
          start,
          end,
          attendees,
          location,
          conferenceData: addConference,
          calendarId = 'primary',
          sendNotifications = true,
        } = args as {
          summary: string;
          description?: string;
          start: string;
          end: string;
          attendees?: string[];
          location?: string;
          conferenceData?: boolean;
          calendarId?: string;
          sendNotifications?: boolean;
        };

        const eventBody: Record<string, unknown> = {
          summary,
          start: { dateTime: start },
          end: { dateTime: end },
        };

        if (description) eventBody.description = description;
        if (location) eventBody.location = location;
        if (attendees && attendees.length > 0) {
          eventBody.attendees = attendees.map((email) => ({ email }));
        }

        // Add Google Meet link if requested
        if (addConference) {
          eventBody.conferenceData = {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        }

        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
        );
        url.searchParams.set('sendUpdates', sendNotifications ? 'all' : 'none');
        if (addConference) url.searchParams.set('conferenceDataVersion', '1');

        const response = await auth.fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Calendar create error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as {
          id: string;
          htmlLink: string;
          hangoutLink?: string;
          summary: string;
          start: { dateTime: string };
          end: { dateTime: string };
        };

        result = {
          success: true,
          eventId: data.id,
          title: data.summary,
          start: data.start.dateTime,
          end: data.end.dateTime,
          link: data.htmlLink,
          meetLink: data.hangoutLink,
        };
        break;
      }

      case 'calendar_update_event': {
        const {
          eventId,
          summary,
          description,
          start,
          end,
          attendees,
          location,
          calendarId = 'primary',
          sendNotifications = true,
        } = args as {
          eventId: string;
          summary?: string;
          description?: string;
          start?: string;
          end?: string;
          attendees?: string[];
          location?: string;
          calendarId?: string;
          sendNotifications?: boolean;
        };

        // First get existing event to preserve fields not being updated
        const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
        const getResponse = await auth.fetch(getUrl);
        if (!getResponse.ok) throw new Error(`Calendar API error: ${getResponse.status}`);

        const existingEvent = (await getResponse.json()) as Record<string, unknown>;

        // Update only provided fields
        if (summary !== undefined) existingEvent.summary = summary;
        if (description !== undefined) existingEvent.description = description;
        if (start !== undefined) existingEvent.start = { dateTime: start };
        if (end !== undefined) existingEvent.end = { dateTime: end };
        if (location !== undefined) existingEvent.location = location;
        if (attendees !== undefined) {
          existingEvent.attendees = attendees.map((email) => ({ email }));
        }

        const url = new URL(getUrl);
        url.searchParams.set('sendUpdates', sendNotifications ? 'all' : 'none');

        const response = await auth.fetch(url.toString(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existingEvent),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Calendar update error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as {
          id: string;
          htmlLink: string;
          summary: string;
        };

        result = {
          success: true,
          eventId: data.id,
          title: data.summary,
          link: data.htmlLink,
        };
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

      case 'docs_get_comments': {
        const { documentId, includeResolved = false } = args as {
          documentId: string;
          includeResolved?: boolean;
        };

        // Use Drive API comments endpoint
        const url = new URL(`https://www.googleapis.com/drive/v3/files/${documentId}/comments`);
        url.searchParams.set('fields', 'comments(id,content,author,createdTime,resolved,replies)');
        if (!includeResolved) {
          // API doesn't have a direct filter, we'll filter client-side
        }

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
        if (!includeResolved) {
          comments = comments.filter((c) => !c.resolved);
        }

        result = {
          documentId,
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
