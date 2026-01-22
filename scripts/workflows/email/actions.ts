/**
 * Email Triage Actions
 *
 * Execute actions on emails (delete, archive, label, etc.)
 *
 * NOTE: Individual email actions require MCP Gmail integration which is not
 * yet implemented. These functions will throw NotImplementedError when called.
 * Use the batch functions for now which handle this gracefully.
 */

import type {
  TriagedEmail,
  ActionResult,
  BatchActionRequest,
} from './types.js';

/**
 * Error thrown when attempting to use unimplemented email actions
 */
export class EmailActionNotImplementedError extends Error {
  constructor(action: string) {
    super(
      `Email action "${action}" is not yet implemented. ` +
      `MCP Gmail integration required. See: scripts/workflows/email/README.md`
    );
    this.name = 'EmailActionNotImplementedError';
  }
}

/**
 * Delete an email (move to trash)
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function deleteEmail(_emailId: string): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('delete');
}

/**
 * Archive an email (remove from inbox)
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function archiveEmail(_emailId: string): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('archive');
}

/**
 * Add a label to an email
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function labelEmail(
  _emailId: string,
  _labelId: string
): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('label');
}

/**
 * Star an email
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function starEmail(_emailId: string): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('star');
}

/**
 * Mark email as read
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function markAsRead(_emailId: string): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('mark_read');
}

/**
 * Mark email as unread
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function markAsUnread(_emailId: string): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('mark_unread');
}

/**
 * Create a TODO from an email
 * @throws EmailActionNotImplementedError - TODO integration not yet implemented
 */
export async function createTodoFromEmail(
  _email: TriagedEmail
): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('create_todo');
}

/**
 * Delegate an email (forward and archive)
 * @throws EmailActionNotImplementedError - MCP Gmail integration not yet implemented
 */
export async function delegateEmail(
  _email: TriagedEmail,
  _delegateTo: string,
  _note?: string
): Promise<ActionResult> {
  throw new EmailActionNotImplementedError('delegate');
}

/**
 * Execute a batch action on multiple emails
 *
 * Note: Currently returns empty results since individual actions are not implemented.
 * Will be functional once MCP Gmail integration is complete.
 */
export async function executeBatchAction(
  request: BatchActionRequest
): Promise<ActionResult[]> {
  // Return skipped results for all emails since actions aren't implemented
  return request.emailIds.map(emailId => ({
    emailId,
    action: request.action,
    success: false,
    error: `Action "${request.action}" not implemented (MCP Gmail integration required)`,
  }));
}

/**
 * Delete all high-confidence delete emails
 *
 * Note: Currently returns empty results since delete action is not implemented.
 */
export async function deleteHighConfidenceEmails(
  emails: TriagedEmail[]
): Promise<ActionResult[]> {
  return emails
    .filter(e => e.classification.confidence === 'high')
    .map(e => ({
      emailId: e.id,
      action: 'delete' as const,
      success: false,
      error: 'Delete action not implemented (MCP Gmail integration required)',
    }));
}

/**
 * Archive all high-confidence archive emails
 *
 * Note: Currently returns empty results since archive action is not implemented.
 */
export async function archiveHighConfidenceEmails(
  emails: TriagedEmail[]
): Promise<ActionResult[]> {
  return emails
    .filter(e => e.classification.confidence === 'high')
    .map(e => ({
      emailId: e.id,
      action: 'archive' as const,
      success: false,
      error: 'Archive action not implemented (MCP Gmail integration required)',
    }));
}

/**
 * Create TODOs for all respond emails
 *
 * Note: Currently returns empty results since TODO creation is not implemented.
 */
export async function createTodosForRespondEmails(
  emails: TriagedEmail[]
): Promise<ActionResult[]> {
  return emails.map(e => ({
    emailId: e.id,
    action: 'create_todo' as const,
    success: false,
    error: 'Create TODO action not implemented',
  }));
}

/**
 * Get action summary
 */
export function getActionSummary(results: ActionResult[]): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const byAction = new Map<string, number>();
  for (const result of successful) {
    byAction.set(result.action, (byAction.get(result.action) || 0) + 1);
  }

  const lines: string[] = [];
  lines.push(`### Action Summary`);
  lines.push(``);
  lines.push(`**Total:** ${results.length}`);
  lines.push(`**Successful:** ${successful.length}`);
  lines.push(`**Failed:** ${failed.length}`);
  lines.push(``);

  if (byAction.size > 0) {
    lines.push(`**By Action:**`);
    for (const [action, count] of byAction) {
      lines.push(`- ${action}: ${count}`);
    }
  }

  if (failed.length > 0) {
    lines.push(``);
    lines.push(`**Failed:**`);
    for (const result of failed) {
      lines.push(`- ${result.emailId}: ${result.error || 'Unknown error'}`);
    }
  }

  return lines.join('\n');
}
