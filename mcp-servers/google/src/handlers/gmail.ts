/**
 * Gmail handlers - consolidated re-exports from split modules
 *
 * This file re-exports all Gmail functionality from the focused modules:
 * - gmail-read.ts: Search, get message, list labels, get attachments
 * - gmail-write.ts: Send message, create draft
 * - gmail-manage.ts: Trash, delete, archive
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Re-export schemas from all Gmail modules
export {
  GmailSearchSchema,
  GmailGetMessageSchema,
  GmailListLabelsSchema,
  GmailGetAttachmentsSchema,
  handleGmailSearch,
  handleGmailGetMessage,
  handleGmailListLabels,
  handleGmailGetAttachments,
  gmailReadTools,
} from './gmail-read.js';

export {
  GmailSendMessageSchema,
  GmailCreateDraftSchema,
  handleGmailSendMessage,
  handleGmailCreateDraft,
  gmailWriteTools,
} from './gmail-write.js';

export {
  GmailTrashSchema,
  GmailDeleteSchema,
  GmailArchiveSchema,
  handleGmailTrash,
  handleGmailDelete,
  handleGmailArchive,
  gmailManageTools,
} from './gmail-manage.js';

// Import tool arrays to combine
import { gmailReadTools } from './gmail-read.js';
import { gmailWriteTools } from './gmail-write.js';
import { gmailManageTools } from './gmail-manage.js';

// Combined tools array (maintains backwards compatibility)
export const gmailTools: Tool[] = [...gmailReadTools, ...gmailWriteTools, ...gmailManageTools];
