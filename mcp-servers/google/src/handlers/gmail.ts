import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
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

export const GmailTrashSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to trash'),
});

export const GmailDeleteSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to permanently delete'),
});

export const GmailArchiveSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to archive'),
});

export const GmailSendMessageSchema = z.object({
  to: z.array(z.string()).describe('Array of recipient email addresses'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
  bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
  replyToMessageId: z
    .string()
    .optional()
    .describe('Message ID to reply to (sets In-Reply-To and References headers)'),
  threadId: z.string().optional().describe('Thread ID to add the message to'),
});

export const GmailCreateDraftSchema = z.object({
  to: z.array(z.string()).describe('Array of recipient email addresses'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
  bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
  replyToMessageId: z.string().optional().describe('Message ID to reply to'),
});

export const GmailGetAttachmentsSchema = z.object({
  messageId: z.string().describe('The Gmail message ID'),
});

// ==================== TOOL DEFINITIONS ====================

export const gmailTools: Tool[] = [
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
];

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

export async function handleGmailListLabels(auth: GoogleAuth): Promise<unknown> {
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

export async function handleGmailTrash(
  args: z.infer<typeof GmailTrashSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const messageId of args.messageIds) {
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

  return {
    trashed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    details: results,
  };
}

export async function handleGmailDelete(
  args: z.infer<typeof GmailDeleteSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const messageId of args.messageIds) {
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

  return {
    deleted: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    details: results,
  };
}

export async function handleGmailArchive(
  args: z.infer<typeof GmailArchiveSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const messageId of args.messageIds) {
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

  return {
    archived: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    details: results,
  };
}

export async function handleGmailSendMessage(
  args: z.infer<typeof GmailSendMessageSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Build RFC 2822 message
  const messageParts: string[] = [];
  messageParts.push(`To: ${args.to.join(', ')}`);
  if (args.cc && args.cc.length > 0) messageParts.push(`Cc: ${args.cc.join(', ')}`);
  if (args.bcc && args.bcc.length > 0) messageParts.push(`Bcc: ${args.bcc.join(', ')}`);
  messageParts.push(`Subject: ${args.subject}`);
  if (args.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${args.replyToMessageId}`);
    messageParts.push(`References: ${args.replyToMessageId}`);
  }
  messageParts.push('Content-Type: text/plain; charset=utf-8');
  messageParts.push('');
  messageParts.push(args.body);

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: Record<string, unknown> = { raw: encodedMessage };
  if (args.threadId) requestBody.threadId = args.threadId;

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
  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId,
  };
}

export async function handleGmailCreateDraft(
  args: z.infer<typeof GmailCreateDraftSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Build RFC 2822 message
  const messageParts: string[] = [];
  messageParts.push(`To: ${args.to.join(', ')}`);
  if (args.cc && args.cc.length > 0) messageParts.push(`Cc: ${args.cc.join(', ')}`);
  if (args.bcc && args.bcc.length > 0) messageParts.push(`Bcc: ${args.bcc.join(', ')}`);
  messageParts.push(`Subject: ${args.subject}`);
  if (args.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${args.replyToMessageId}`);
    messageParts.push(`References: ${args.replyToMessageId}`);
  }
  messageParts.push('Content-Type: text/plain; charset=utf-8');
  messageParts.push('');
  messageParts.push(args.body);

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
  return {
    success: true,
    draftId: data.id,
    messageId: data.message.id,
    note: 'Draft created. Open Gmail to review and send.',
  };
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

  return {
    messageId: args.messageId,
    attachmentCount: attachments.length,
    attachments,
  };
}
