import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== ZOD SCHEMAS ====================

export const GmailSearchSchema = z.object({
  query: z.string().describe('Gmail search query (e.g., "is:unread from:boss@company.com")'),
  maxResults: z.number().optional().default(10).describe('Maximum number of messages to return'),
});

export const GmailGetMessageSchema = z.object({
  messageId: z.string().describe('The Gmail message ID'),
});

export const GmailListLabelsSchema = z.object({});

export const GmailGetAttachmentsSchema = z.object({
  messageId: z.string().describe('The Gmail message ID'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleGmailSearch(
  args: z.infer<typeof GmailSearchSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', args.query);
  url.searchParams.set('maxResults', args.maxResults.toString());

  const response = await auth.fetch(url.toString());
  if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

  const data = (await response.json()) as { messages?: Array<{ id: string; threadId: string }> };

  if (!data.messages || data.messages.length === 0) {
    return { messages: [], total: 0 };
  }

  // Fetch details for each message
  const messages = await Promise.all(
    data.messages.slice(0, args.maxResults).map(async (msg) => {
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

  return { messages: messages.filter(Boolean), total: data.messages.length };
}

export async function handleGmailGetMessage(
  args: z.infer<typeof GmailGetMessageSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.messageId}?format=full`;

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

  return {
    id: data.id,
    from: headers['from'],
    to: headers['to'],
    subject: headers['subject'],
    date: headers['date'],
    body: body.substring(0, 10000), // Limit body size
    labels: data.labelIds,
  };
}

export async function handleGmailListLabels(
  _args: z.infer<typeof GmailListLabelsSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);

  const data = (await response.json()) as {
    labels: Array<{ id: string; name: string; type: string }>;
  };

  return data.labels.map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
  }));
}

export async function handleGmailGetAttachments(
  args: z.infer<typeof GmailGetAttachmentsSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.messageId}?format=full`;

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

  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

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

  return {
    messageId: args.messageId,
    attachmentCount: attachments.length,
    attachments,
  };
}

// ==================== HANDLER BUNDLE ====================

export const gmailReadDefs = defineHandlers<GoogleAuth>()({
  gmail_search: {
    description:
      'Search Gmail messages. Use Gmail search syntax (from:, to:, subject:, is:unread, etc.)',
    schema: GmailSearchSchema,
    handler: handleGmailSearch,
  },
  gmail_get_message: {
    description: 'Get the full content of a specific Gmail message by ID',
    schema: GmailGetMessageSchema,
    handler: handleGmailGetMessage,
  },
  gmail_list_labels: {
    description: 'List all Gmail labels (folders)',
    schema: GmailListLabelsSchema,
    handler: handleGmailListLabels,
  },
  gmail_get_attachments: {
    description: 'Get list of attachments for a Gmail message with their metadata',
    schema: GmailGetAttachmentsSchema,
    handler: handleGmailGetAttachments,
  },
});
