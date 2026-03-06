import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';
import { buildRfc2822Message, encodeForGmail } from '../utils/email-builder.js';

// ==================== ZOD SCHEMAS ====================

export const GmailCreateDraftSchema = z.object({
  to: z.array(z.string()).describe('Array of recipient email addresses'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
  bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
  replyToMessageId: z.string().optional().describe('Message ID to reply to'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleGmailCreateDraft(
  args: z.infer<typeof GmailCreateDraftSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const rawMessage = buildRfc2822Message({
    to: args.to,
    subject: args.subject,
    body: args.body,
    cc: args.cc,
    bcc: args.bcc,
    replyToMessageId: args.replyToMessageId,
  });
  const encodedMessage = encodeForGmail(rawMessage);

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

export const GmailSendDraftSchema = z.object({
  draftId: z.string().describe('The draft ID to send (created by gmail_create_draft)'),
});

export async function handleGmailSendDraft(
  args: z.infer<typeof GmailSendDraftSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send';
  const response = await auth.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: args.draftId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail send draft error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { id: string; threadId: string; labelIds: string[] };
  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId,
    labels: data.labelIds,
  };
}

// ==================== HANDLER BUNDLE ====================

export const gmailWriteDefs = defineHandlers<GoogleAuth>()({
  gmail_create_draft: {
    description:
      'Create a draft email (not sent). Useful for composing emails that need review before sending.',
    schema: GmailCreateDraftSchema,
    handler: handleGmailCreateDraft,
  },
  gmail_send_draft: {
    description:
      'Send a previously created draft email. The draft must exist (created by gmail_create_draft). This sends the email immediately.',
    schema: GmailSendDraftSchema,
    handler: handleGmailSendDraft,
  },
});
