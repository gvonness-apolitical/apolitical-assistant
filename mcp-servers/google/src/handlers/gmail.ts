/**
 * Gmail handlers - consolidated re-exports from split modules
 *
 * This file re-exports all Gmail functionality from the focused modules:
 * - gmail-read.ts: Search, get message, list labels, get attachments
 * - gmail-write.ts: Send message, create draft
 * - gmail-manage.ts: Trash, delete, archive
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from '../auth.js';

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
  gmailReadDefs,
} from './gmail-read.js';

export {
  GmailSendMessageSchema,
  GmailCreateDraftSchema,
  handleGmailSendMessage,
  handleGmailCreateDraft,
  gmailWriteDefs,
} from './gmail-write.js';

export {
  GmailTrashSchema,
  GmailDeleteSchema,
  GmailArchiveSchema,
  handleGmailTrash,
  handleGmailDelete,
  handleGmailArchive,
  gmailManageDefs,
} from './gmail-manage.js';

// Import defs to combine
import { gmailReadDefs } from './gmail-read.js';
import { gmailWriteDefs } from './gmail-write.js';
import { gmailManageDefs } from './gmail-manage.js';

// Combined tools array (maintains backwards compatibility)
export const gmailTools: Tool[] = [
  ...gmailReadDefs.tools,
  ...gmailWriteDefs.tools,
  ...gmailManageDefs.tools,
];

// Combined handler registry
export const gmailHandlers: Record<
  string,
  (args: Record<string, unknown>, auth: GoogleAuth) => Promise<unknown>
> = {
  ...gmailReadDefs.handlers,
  ...gmailWriteDefs.handlers,
  ...gmailManageDefs.handlers,
};
