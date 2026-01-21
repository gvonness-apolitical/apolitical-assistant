/**
 * Action Item Lifecycle Tracking
 *
 * Track action items from 1:1s through completion.
 */

import { randomUUID } from 'node:crypto';
import type { ActionItemTracking } from './types.js';
import { loadMeetingConfig } from './config.js';
import { findPrevious121Notes } from './history.js';

/**
 * Get action items for a specific attendee from previous 1:1s
 */
export async function get121ActionItems(attendeeEmail: string): Promise<ActionItemTracking[]> {
  const config = loadMeetingConfig();
  const staleDays = config.oneOnOneSettings.actionItemStaleDays;

  // Get action items from previous 1:1 notes
  const previousNotes = await findPrevious121Notes(attendeeEmail);
  const allActionItems: ActionItemTracking[] = [];

  for (const note of previousNotes) {
    for (const item of note.actionItems) {
      // Check if item is stale
      const ageInDays = daysSince(item.createdAt);
      if (item.status === 'open' && ageInDays > staleDays) {
        item.status = 'stale';
      }
      allActionItems.push(item);
    }
  }

  // Sort by status (open first, then stale, then completed) and date
  return allActionItems.sort((a, b) => {
    const statusOrder = { open: 0, stale: 1, completed: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Create a new action item
 */
export function createActionItem(
  text: string,
  attendeeEmail: string,
  sourceUrl: string
): ActionItemTracking {
  const config = loadMeetingConfig();

  return {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    createdIn121With: attendeeEmail,
    source: sourceUrl,
    status: 'open',
    staleAfterDays: config.oneOnOneSettings.actionItemStaleDays,
  };
}

/**
 * Mark an action item as completed
 */
export function completeActionItem(item: ActionItemTracking): ActionItemTracking {
  return {
    ...item,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };
}

/**
 * Link an action item to a TODO
 */
export function linkActionItemToTodo(
  item: ActionItemTracking,
  todoId: string
): ActionItemTracking {
  return {
    ...item,
    linkedTodoId: todoId,
  };
}

/**
 * Calculate days since a date
 */
function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Filter action items by status
 */
export function filterActionItems(
  items: ActionItemTracking[],
  status: 'open' | 'completed' | 'stale' | 'all'
): ActionItemTracking[] {
  if (status === 'all') {
    return items;
  }
  return items.filter(item => item.status === status);
}

/**
 * Get action item statistics for an attendee
 */
export async function getActionItemStats(attendeeEmail: string): Promise<{
  total: number;
  open: number;
  stale: number;
  completed: number;
  averageCompletionDays: number | null;
}> {
  const items = await get121ActionItems(attendeeEmail);

  const open = items.filter(i => i.status === 'open').length;
  const stale = items.filter(i => i.status === 'stale').length;
  const completed = items.filter(i => i.status === 'completed').length;

  // Calculate average completion time
  let totalCompletionDays = 0;
  let completedCount = 0;

  for (const item of items) {
    if (item.status === 'completed' && item.completedAt) {
      const created = new Date(item.createdAt);
      const completed = new Date(item.completedAt);
      const days = Math.floor(
        (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalCompletionDays += days;
      completedCount++;
    }
  }

  return {
    total: items.length,
    open,
    stale,
    completed,
    averageCompletionDays: completedCount > 0
      ? Math.round(totalCompletionDays / completedCount)
      : null,
  };
}

/**
 * Format action items for display
 */
export function formatActionItems(items: ActionItemTracking[]): string {
  const lines: string[] = [];

  const openItems = items.filter(i => i.status === 'open');
  const staleItems = items.filter(i => i.status === 'stale');
  const completedItems = items.filter(i => i.status === 'completed');

  if (openItems.length > 0) {
    lines.push('**Open:**');
    for (const item of openItems) {
      lines.push(`- [ ] ${item.text}`);
    }
  }

  if (staleItems.length > 0) {
    lines.push('\n**Stale (needs discussion):**');
    for (const item of staleItems) {
      const days = daysSince(item.createdAt);
      lines.push(`- [ ] ${item.text} *(${days} days old)*`);
    }
  }

  if (completedItems.length > 0) {
    lines.push('\n**Recently Completed:**');
    for (const item of completedItems.slice(0, 3)) {
      lines.push(`- [x] ${item.text}`);
    }
  }

  return lines.join('\n');
}
