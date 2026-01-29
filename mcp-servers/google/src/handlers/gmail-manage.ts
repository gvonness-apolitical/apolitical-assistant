import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';
import { executeBatchOperation } from '../utils/batch-operation.js';

// ==================== ZOD SCHEMAS ====================

export const GmailTrashSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to trash'),
});

export const GmailDeleteSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to permanently delete'),
});

export const GmailArchiveSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to archive'),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleGmailTrash(
  args: z.infer<typeof GmailTrashSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const result = await executeBatchOperation(
    args.messageIds,
    {
      buildUrl: (id) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`,
      method: 'POST',
    },
    auth
  );

  return {
    trashed: result.successCount,
    failed: result.failedCount,
    details: result.details,
  };
}

export async function handleGmailDelete(
  args: z.infer<typeof GmailDeleteSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const result = await executeBatchOperation(
    args.messageIds,
    {
      buildUrl: (id) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
      method: 'DELETE',
    },
    auth
  );

  return {
    deleted: result.successCount,
    failed: result.failedCount,
    details: result.details,
  };
}

export async function handleGmailArchive(
  args: z.infer<typeof GmailArchiveSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const result = await executeBatchOperation(
    args.messageIds,
    {
      buildUrl: (id) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      buildBody: () => ({ removeLabelIds: ['INBOX'] }),
    },
    auth
  );

  return {
    archived: result.successCount,
    failed: result.failedCount,
    details: result.details,
  };
}

// ==================== HANDLER BUNDLE ====================

export const gmailManageDefs = defineHandlers<GoogleAuth>()({
  gmail_trash: {
    description: 'Move Gmail messages to trash. Requires gmail.modify scope.',
    schema: GmailTrashSchema,
    handler: handleGmailTrash,
  },
  gmail_delete: {
    description:
      'Permanently delete Gmail messages (cannot be undone). Requires gmail.modify scope.',
    schema: GmailDeleteSchema,
    handler: handleGmailDelete,
  },
  gmail_archive: {
    description:
      'Archive Gmail messages (remove from inbox but keep in All Mail). Requires gmail.modify scope.',
    schema: GmailArchiveSchema,
    handler: handleGmailArchive,
  },
});
