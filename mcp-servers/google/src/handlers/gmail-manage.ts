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

export const GmailMarkReadSchema = z.object({
  messageIds: z.array(z.string()).describe('Array of Gmail message IDs to mark as read'),
});

export async function handleGmailMarkRead(
  args: z.infer<typeof GmailMarkReadSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const result = await executeBatchOperation(
    args.messageIds,
    {
      buildUrl: (id) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      buildBody: () => ({ removeLabelIds: ['UNREAD'] }),
    },
    auth
  );

  return {
    markedRead: result.successCount,
    failed: result.failedCount,
    details: result.details,
  };
}

// ==================== APPLY RULES ====================

const RuleConditionSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  to: z.string().optional(),
});

const RuleWithUnlessSchema = RuleConditionSchema.extend({
  unless: RuleConditionSchema.optional(),
});

export const GmailApplyRulesSchema = z.object({
  rules: z.object({
    autoDelete: z.array(RuleWithUnlessSchema).optional().default([]),
    autoArchive: z.array(RuleConditionSchema).optional().default([]),
    alwaysKeep: z.array(RuleConditionSchema).optional().default([]),
  }),
  query: z.string().optional().default('is:unread in:inbox'),
  maxResults: z.number().optional().default(50),
});

function matchesWildcard(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

function matchesCondition(
  msg: { from: string; subject: string; to: string },
  condition: z.infer<typeof RuleConditionSchema>
): boolean {
  if (condition.from && !matchesWildcard(msg.from, condition.from)) return false;
  if (condition.subject && !matchesWildcard(msg.subject, condition.subject)) return false;
  if (condition.to && !matchesWildcard(msg.to, condition.to)) return false;
  return true;
}

export async function handleGmailApplyRules(
  args: z.infer<typeof GmailApplyRulesSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Search for messages
  const searchUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  searchUrl.searchParams.set('q', args.query);
  searchUrl.searchParams.set('maxResults', args.maxResults.toString());

  const searchResponse = await auth.fetch(searchUrl.toString());
  if (!searchResponse.ok) throw new Error(`Gmail API error: ${searchResponse.status}`);

  const searchData = (await searchResponse.json()) as {
    messages?: Array<{ id: string }>;
  };

  if (!searchData.messages || searchData.messages.length === 0) {
    return {
      autoDelete: [],
      autoArchive: [],
      alwaysKeep: [],
      needsReview: [],
      stats: { total: 0, matched: 0, unmatched: 0 },
    };
  }

  // Fetch metadata for each message
  const messages = await Promise.all(
    searchData.messages.map(async (msg) => {
      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
      const msgResponse = await auth.fetch(msgUrl);
      if (!msgResponse.ok) return null;
      const msgData = (await msgResponse.json()) as {
        id: string;
        payload: { headers: Array<{ name: string; value: string }> };
      };

      const headers = msgData.payload.headers.reduce(
        (acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }),
        {} as Record<string, string>
      );

      return {
        id: msgData.id,
        from: headers['from'] || '',
        to: headers['to'] || '',
        subject: headers['subject'] || '',
        date: headers['date'] || '',
      };
    })
  );

  const validMessages = messages.filter((m): m is NonNullable<typeof m> => m !== null);

  const autoDeleteIds: string[] = [];
  const autoArchiveIds: string[] = [];
  const alwaysKeepIds: string[] = [];
  const needsReview: Array<{ id: string; from: string; subject: string; date: string }> = [];

  for (const msg of validMessages) {
    // Priority 1: alwaysKeep
    const kept = args.rules.alwaysKeep.some((rule) => matchesCondition(msg, rule));
    if (kept) {
      alwaysKeepIds.push(msg.id);
      continue;
    }

    // Priority 2: autoDelete (with unless check)
    const deleteRule = args.rules.autoDelete.find((rule) => matchesCondition(msg, rule));
    if (deleteRule) {
      if (deleteRule.unless && matchesCondition(msg, deleteRule.unless)) {
        needsReview.push({ id: msg.id, from: msg.from, subject: msg.subject, date: msg.date });
      } else {
        autoDeleteIds.push(msg.id);
      }
      continue;
    }

    // Priority 3: autoArchive
    const archived = args.rules.autoArchive.some((rule) => matchesCondition(msg, rule));
    if (archived) {
      autoArchiveIds.push(msg.id);
      continue;
    }

    // No rule matched
    needsReview.push({ id: msg.id, from: msg.from, subject: msg.subject, date: msg.date });
  }

  const matched = autoDeleteIds.length + autoArchiveIds.length + alwaysKeepIds.length;
  return {
    autoDelete: autoDeleteIds,
    autoArchive: autoArchiveIds,
    alwaysKeep: alwaysKeepIds,
    needsReview,
    stats: {
      total: validMessages.length,
      matched,
      unmatched: validMessages.length - matched,
    },
  };
}

// ==================== BATCH ARCHIVE ====================

export const GmailBatchArchiveSchema = z.object({
  query: z.string().describe('Gmail search query to find messages to archive'),
  maxResults: z.number().optional().default(100).describe('Maximum messages to archive'),
});

export async function handleGmailBatchArchive(
  args: z.infer<typeof GmailBatchArchiveSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Search for messages
  const searchUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  searchUrl.searchParams.set('q', args.query);
  searchUrl.searchParams.set('maxResults', args.maxResults.toString());

  const searchResponse = await auth.fetch(searchUrl.toString());
  if (!searchResponse.ok) throw new Error(`Gmail API error: ${searchResponse.status}`);

  const searchData = (await searchResponse.json()) as {
    messages?: Array<{ id: string }>;
  };

  if (!searchData.messages || searchData.messages.length === 0) {
    return { archived: 0, failed: 0, query: args.query };
  }

  const messageIds = searchData.messages.map((m) => m.id);

  const result = await executeBatchOperation(
    messageIds,
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
    query: args.query,
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
  gmail_mark_read: {
    description: 'Mark Gmail messages as read (remove UNREAD label). Requires gmail.modify scope.',
    schema: GmailMarkReadSchema,
    handler: handleGmailMarkRead,
  },
  gmail_apply_rules: {
    description:
      'Categorize Gmail messages by applying rules (read-only — does not trash or archive). Returns message IDs grouped by action.',
    schema: GmailApplyRulesSchema,
    handler: handleGmailApplyRules,
  },
  gmail_batch_archive: {
    description:
      'Search for Gmail messages matching a query and archive them all. Requires gmail.modify scope.',
    schema: GmailBatchArchiveSchema,
    handler: handleGmailBatchArchive,
  },
});
