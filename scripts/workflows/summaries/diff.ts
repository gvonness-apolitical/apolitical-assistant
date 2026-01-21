/**
 * Summary Comparison
 *
 * Compare two summaries to highlight changes.
 */

import type { SummaryDocument, SummaryItem, SummaryDiff } from './types.js';
import { loadSummary } from './config.js';
import type { SummaryFidelity } from './types.js';

/**
 * Compare two summary periods
 */
export function compareSummaries(
  fidelity: SummaryFidelity,
  period1: string,
  period2: string
): SummaryDiff | null {
  const summary1 = loadSummary(fidelity, period1);
  const summary2 = loadSummary(fidelity, period2);

  if (!summary1 || !summary2) {
    return null;
  }

  return diffSummaryDocuments(summary1, summary2);
}

/**
 * Diff two summary documents
 */
export function diffSummaryDocuments(
  summary1: SummaryDocument,
  summary2: SummaryDocument
): SummaryDiff {
  const items1 = getAllItems(summary1);
  const items2 = getAllItems(summary2);

  // Find items only in period 1 (resolved/no longer relevant)
  const onlyInPeriod1 = items1.filter(
    (item1) => !items2.some((item2) => areSimilarItems(item1, item2))
  );

  // Find items only in period 2 (new)
  const onlyInPeriod2 = items2.filter(
    (item2) => !items1.some((item1) => areSimilarItems(item1, item2))
  );

  // Find evolved items (similar but changed)
  const evolved: SummaryDiff['evolved'] = [];
  for (const item2 of items2) {
    const matchingItem1 = items1.find((item1) => areSimilarItems(item1, item2));
    if (matchingItem1 && hasChanges(matchingItem1, item2)) {
      evolved.push({
        item: item2,
        previousState: {
          priority: matchingItem1.priority,
          todoStatus: matchingItem1.todoStatus,
        },
        changes: describeChanges(matchingItem1, item2),
      });
    }
  }

  // Calculate stats diff
  const statsDiff = {
    totalItems: {
      before: summary1.stats.totalItems,
      after: summary2.stats.totalItems,
      change: summary2.stats.totalItems - summary1.stats.totalItems,
    },
    actionItems: {
      before: summary1.stats.actionItems,
      after: summary2.stats.actionItems,
      change: summary2.stats.actionItems - summary1.stats.actionItems,
    },
    byPriority: {} as Record<string, { before: number; after: number }>,
    byCategory: {} as Record<string, { before: number; after: number }>,
  };

  // Priority diff
  for (const priority of ['P0', 'P1', 'P2', 'P3']) {
    statsDiff.byPriority[priority] = {
      before: summary1.stats.byPriority[priority] ?? 0,
      after: summary2.stats.byPriority[priority] ?? 0,
    };
  }

  // Category diff
  for (const category of ['engineering', 'management', 'business']) {
    statsDiff.byCategory[category] = {
      before: summary1.stats.byCategory[category] ?? 0,
      after: summary2.stats.byCategory[category] ?? 0,
    };
  }

  return {
    period1: summary1.period,
    period2: summary2.period,
    onlyInPeriod1,
    onlyInPeriod2,
    evolved,
    statsDiff,
  };
}

/**
 * Get all items from a summary
 */
function getAllItems(summary: SummaryDocument): SummaryItem[] {
  return [...summary.engineering, ...summary.management, ...summary.business];
}

/**
 * Check if two items are similar (same topic)
 */
function areSimilarItems(item1: SummaryItem, item2: SummaryItem): boolean {
  // Same ID
  if (item1.id === item2.id) return true;

  // Same TODO
  if (item1.todoId && item1.todoId === item2.todoId) return true;

  // Similar title (fuzzy match)
  const title1 = normalizeTitle(item1.title);
  const title2 = normalizeTitle(item2.title);

  // Check for significant overlap
  const words1 = new Set(title1.split(' '));
  const words2 = new Set(title2.split(' '));
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  const similarity = intersection.length / union.size;
  return similarity > 0.6;
}

/**
 * Normalize a title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if an item has changed
 */
function hasChanges(item1: SummaryItem, item2: SummaryItem): boolean {
  return (
    item1.priority !== item2.priority ||
    item1.todoStatus !== item2.todoStatus ||
    item1.category !== item2.category
  );
}

/**
 * Describe what changed between items
 */
function describeChanges(item1: SummaryItem, item2: SummaryItem): string[] {
  const changes: string[] = [];

  if (item1.priority !== item2.priority) {
    changes.push(`Priority: ${item1.priority} → ${item2.priority}`);
  }

  if (item1.todoStatus !== item2.todoStatus) {
    changes.push(`Status: ${item1.todoStatus ?? 'none'} → ${item2.todoStatus ?? 'none'}`);
  }

  if (item1.category !== item2.category) {
    changes.push(`Category: ${item1.category} → ${item2.category}`);
  }

  return changes;
}

/**
 * Generate markdown for a diff
 */
export function generateDiffMarkdown(diff: SummaryDiff): string {
  const lines: string[] = [];

  lines.push(`# Summary Comparison: ${diff.period1} → ${diff.period2}`);
  lines.push('');

  // New items
  if (diff.onlyInPeriod2.length > 0) {
    lines.push('## New This Period');
    lines.push('');
    for (const item of diff.onlyInPeriod2) {
      lines.push(`- [${item.priority}] ${item.title}`);
    }
    lines.push('');
  }

  // Resolved items
  if (diff.onlyInPeriod1.length > 0) {
    lines.push('## Resolved / No Longer Active');
    lines.push('');
    for (const item of diff.onlyInPeriod1) {
      lines.push(`- [${item.priority}] ${item.title}`);
    }
    lines.push('');
  }

  // Evolved items
  if (diff.evolved.length > 0) {
    lines.push('## Changed');
    lines.push('');
    for (const { item, changes } of diff.evolved) {
      lines.push(`- [${item.priority}] ${item.title}`);
      for (const change of changes) {
        lines.push(`  - ${change}`);
      }
    }
    lines.push('');
  }

  // Statistics
  lines.push('## Statistics');
  lines.push('');
  lines.push('| Metric | Before | After | Change |');
  lines.push('|--------|--------|-------|--------|');
  lines.push(
    `| Total Items | ${diff.statsDiff.totalItems.before} | ${diff.statsDiff.totalItems.after} | ${formatChange(diff.statsDiff.totalItems.change)} |`
  );
  lines.push(
    `| Action Items | ${diff.statsDiff.actionItems.before} | ${diff.statsDiff.actionItems.after} | ${formatChange(diff.statsDiff.actionItems.change)} |`
  );

  for (const [priority, { before, after }] of Object.entries(diff.statsDiff.byPriority)) {
    const change = after - before;
    if (before > 0 || after > 0) {
      lines.push(`| ${priority} | ${before} | ${after} | ${formatChange(change)} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a change number
 */
function formatChange(change: number): string {
  if (change > 0) return `+${change}`;
  if (change < 0) return String(change);
  return '0';
}
