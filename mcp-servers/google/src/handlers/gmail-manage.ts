import { z } from 'zod';
import { createToolDefinition } from '@apolitical-assistant/mcp-shared';
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

// ==================== TOOL DEFINITIONS ====================

export const gmailManageTools = [
  createToolDefinition(
    'gmail_trash',
    'Move Gmail messages to trash. Requires gmail.modify scope.',
    GmailTrashSchema
  ),
  createToolDefinition(
    'gmail_delete',
    'Permanently delete Gmail messages (cannot be undone). Requires gmail.modify scope.',
    GmailDeleteSchema
  ),
  createToolDefinition(
    'gmail_archive',
    'Archive Gmail messages (remove from inbox but keep in All Mail). Requires gmail.modify scope.',
    GmailArchiveSchema
  ),
];

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
