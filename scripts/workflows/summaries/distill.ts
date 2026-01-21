/**
 * Summary Distillation
 *
 * Logic for distilling higher-level summaries from lower-level ones.
 */

import { randomUUID } from 'node:crypto';
import type {
  SummaryDocument,
  SummaryItem,
  SummaryFidelity,
  SummaryStats,
  TodoProgress,
} from './types.js';
import { getSummaryFilePath } from './config.js';
import { invokeClaudeWithInput, parseClaudeJson } from '../shared/claude.js';

/**
 * Distill multiple source summaries into a higher-level summary
 */
export async function distillSummaries(
  fidelity: SummaryFidelity,
  period: string,
  startDate: string,
  endDate: string,
  sourceSummaries: SummaryDocument[],
  options?: { verbose?: boolean }
): Promise<SummaryDocument> {
  if (options?.verbose) {
    console.log(`  Distilling ${sourceSummaries.length} summaries...`);
  }

  // Collect all items from source summaries
  const allEngineering: SummaryItem[] = [];
  const allManagement: SummaryItem[] = [];
  const allBusiness: SummaryItem[] = [];

  for (const summary of sourceSummaries) {
    allEngineering.push(...summary.engineering);
    allManagement.push(...summary.management);
    allBusiness.push(...summary.business);
  }

  // Distill each category
  const engineering = await distillCategory('engineering', allEngineering, fidelity, options);
  const management = await distillCategory('management', allManagement, fidelity, options);
  const business = await distillCategory('business', allBusiness, fidelity, options);

  const allItems = [...engineering, ...management, ...business];

  // Calculate aggregated stats
  const stats: SummaryStats = {
    totalItems: allItems.length,
    byCategory: {
      engineering: engineering.length,
      management: management.length,
      business: business.length,
    },
    byPriority: {
      P0: allItems.filter((i) => i.priority === 'P0').length,
      P1: allItems.filter((i) => i.priority === 'P1').length,
      P2: allItems.filter((i) => i.priority === 'P2').length,
      P3: allItems.filter((i) => i.priority === 'P3').length,
    },
    bySource: allItems.reduce(
      (acc, item) => {
        for (const source of item.sources) {
          acc[source.type] = (acc[source.type] ?? 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    ),
    actionItems: allItems.filter((i) => i.todoId).length,
    completedActionItems: allItems.filter((i) => i.todoStatus === 'completed').length,
  };

  // Aggregate TODO progress
  const todoProgress: TodoProgress = aggregateTodoProgress(sourceSummaries);

  return {
    id: randomUUID(),
    fidelity,
    period,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    engineering,
    management,
    business,
    todoProgress,
    sourceSummaries: sourceSummaries.map((s) => s.id),
    filePath: getSummaryFilePath(fidelity, period),
    stats,
  };
}

/**
 * Distill items within a category
 */
async function distillCategory(
  category: string,
  items: SummaryItem[],
  fidelity: SummaryFidelity,
  options?: { verbose?: boolean }
): Promise<SummaryItem[]> {
  if (items.length === 0) {
    return [];
  }

  // For higher fidelities (quarterly+), use more aggressive consolidation
  const consolidationLevel = getConsolidationLevel(fidelity);

  if (items.length <= consolidationLevel * 2) {
    // Not enough items to warrant consolidation
    return items;
  }

  // Format items for Claude
  const itemsText = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.priority}] ${item.title}${item.description ? `: ${item.description.slice(0, 100)}` : ''}`
    )
    .join('\n');

  const prompt = `
You are distilling a ${category} summary for a Director of Engineering.
The target fidelity is ${fidelity}, so consolidate related items and keep only the most significant.

Original items (${items.length}):
${itemsText}

Instructions:
1. Group related items into themes
2. Keep only the most important items (aim for ~${consolidationLevel} items)
3. Elevate priority if multiple high-priority items relate to the same theme
4. Preserve links between items

Respond with a JSON array:
[
  {
    "title": "Consolidated title or kept original",
    "description": "Brief description",
    "priority": "P0|P1|P2|P3",
    "sourceIndices": [1, 2, 3],
    "isConsolidated": true|false
  },
  ...
]`;

  const response = await invokeClaudeWithInput(prompt);
  const parsed = parseClaudeJson<
    Array<{
      title: string;
      description: string;
      priority: 'P0' | 'P1' | 'P2' | 'P3';
      sourceIndices: number[];
      isConsolidated: boolean;
    }>
  >(response);

  if (!parsed) {
    // Fallback: return top items by priority
    if (options?.verbose) {
      console.log(`  Failed to distill ${category}, using top items`);
    }
    return items
      .sort((a, b) => {
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, consolidationLevel);
  }

  // Build distilled items
  return parsed.map((p) => {
    const sourceItems = p.sourceIndices.map((i) => items[i - 1]).filter(Boolean);
    const firstSource = sourceItems[0] ?? items[0];

    // Merge sources from all consolidated items
    const allSources = sourceItems.flatMap((item) => item.sources);

    return {
      id: randomUUID(),
      title: p.title,
      description: p.description,
      category: firstSource.category,
      priority: p.priority,
      date: firstSource.date,
      sources: allSources,
      // Preserve TODO links from source items
      todoId: sourceItems.find((i) => i.todoId)?.todoId,
      todoStatus: sourceItems.find((i) => i.todoId)?.todoStatus,
    };
  });
}

/**
 * Get the target number of items per category for a fidelity
 */
function getConsolidationLevel(fidelity: SummaryFidelity): number {
  switch (fidelity) {
    case 'daily':
      return 20;
    case 'weekly':
      return 15;
    case 'monthly':
      return 10;
    case 'quarterly':
      return 8;
    case 'h1-h2':
      return 6;
    case 'yearly':
      return 5;
    default:
      return 10;
  }
}

/**
 * Aggregate TODO progress from multiple summaries
 */
function aggregateTodoProgress(summaries: SummaryDocument[]): TodoProgress {
  const allTodoIds = new Set<string>();
  let totalCreated = 0;
  let totalCompleted = 0;

  for (const summary of summaries) {
    totalCreated += summary.todoProgress.created;
    totalCompleted += summary.todoProgress.completed;

    for (const todoId of summary.todoProgress.todoIds) {
      allTodoIds.add(todoId);
    }
  }

  return {
    created: totalCreated,
    completed: totalCompleted,
    pending: totalCreated - totalCompleted,
    todoIds: [...allTodoIds],
  };
}
