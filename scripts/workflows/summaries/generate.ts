/**
 * Summary Generation
 *
 * Core logic for generating summaries from collected data.
 */

import { randomUUID } from 'node:crypto';
import { toErrorMessage } from '@apolitical-assistant/shared';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  SummaryDocument,
  SummaryItem,
  SummaryFidelity,
  GenerateSummaryOptions,
  GenerationResult,
  CollectionStatus,
  SummaryStats,
  TodoProgress,
  SummaryCategory,
  Priority,
} from './types.js';
import {
  getSummaryFilePath,
  getSummaryJsonPath,
  summaryExists,
  loadSummary,
} from './config.js';
import { parsePeriod, getSourceFidelity, getSourcePeriods } from './periods.js';
import { getEnabledCollectors } from '../collectors/index.js';
import { generateMarkdown } from './markdown.js';
import { distillSummaries } from './distill.js';
import { analyzeTrends } from './trends.js';
import { invokeClaudeWithInput, parseClaudeJson } from '../shared/claude.js';

/**
 * Generate a summary for a given period
 */
export async function generateSummary(options: GenerateSummaryOptions): Promise<GenerationResult> {
  const { fidelity, period, force, deps, verbose, dryRun } = options;

  // Check if summary already exists
  if (!force && summaryExists(fidelity, period)) {
    if (verbose) {
      console.log(`Summary for ${fidelity} ${period} already exists, skipping`);
    }
    const existing = loadSummary(fidelity, period);
    if (existing) {
      return { document: existing, collectionStatus: [], warnings: [] };
    }
  }

  // Parse period to get date range
  const { startDate, endDate } = options.startDate && options.endDate
    ? { startDate: options.startDate, endDate: options.endDate }
    : parsePeriod(fidelity, period);

  if (verbose) {
    console.log(`\nGenerating ${fidelity} summary for ${period}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
  }

  // Check if this is a distilled summary (built from lower-level summaries)
  const sourceFidelity = getSourceFidelity(fidelity);

  let result: GenerationResult;

  if (sourceFidelity) {
    // Distilled summary - build from source summaries
    result = await generateDistilledSummary(fidelity, period, startDate, endDate, {
      verbose,
      dryRun,
      deps,
    });
  } else {
    // Direct summary - build from collected data
    result = await generateDirectSummary(fidelity, period, startDate, endDate, {
      verbose,
      dryRun,
    });
  }

  // Save the summary
  if (!dryRun) {
    saveSummary(result.document);
  }

  return result;
}

/**
 * Generate a summary directly from collected data (for daily/weekly)
 */
async function generateDirectSummary(
  fidelity: SummaryFidelity,
  period: string,
  startDate: string,
  endDate: string,
  options?: { verbose?: boolean; dryRun?: boolean }
): Promise<GenerationResult> {
  const collectionStatus: CollectionStatus[] = [];
  const warnings: string[] = [];

  // Collect from all enabled sources
  const collectors = getEnabledCollectors();
  const allItems: Array<{
    source: string;
    title: string;
    description?: string;
    url?: string;
    date: string;
    tags?: string[];
  }> = [];

  for (const collector of collectors) {
    if (options?.verbose) {
      console.log(`  Collecting from ${collector.name}...`);
    }

    try {
      const result = await collector.collect({ verbose: options?.verbose });
      collectionStatus.push({
        source: collector.source,
        status: result.errors.length > 0 ? 'partial' : 'success',
        itemsCollected: result.todos.length,
        error: result.errors[0]?.message,
      });

      // Filter items to the date range
      for (const todo of result.todos) {
        const itemDate = todo.requestDate ?? todo.createdAt?.split('T')[0];
        if (itemDate && itemDate >= startDate && itemDate <= endDate) {
          allItems.push({
            source: collector.source,
            title: todo.title,
            description: todo.description,
            url: todo.sourceUrl,
            date: itemDate,
            tags: todo.tags,
          });
        }
      }
    } catch (error) {
      collectionStatus.push({
        source: collector.source,
        status: 'failed',
        itemsCollected: 0,
        error: toErrorMessage(error),
      });
      warnings.push(`Failed to collect from ${collector.name}: ${error}`);
    }
  }

  if (options?.verbose) {
    console.log(`  Collected ${allItems.length} total items`);
  }

  // Categorize items using Claude
  const categorizedItems = await categorizeItems(allItems, options);

  // Build the summary document
  const document = buildSummaryDocument(fidelity, period, startDate, endDate, categorizedItems);

  // Analyze trends if applicable
  if (fidelity !== 'daily') {
    document.trends = await analyzeTrends(document, fidelity, period);
  }

  return { document, collectionStatus, warnings };
}

/**
 * Generate a summary by distilling lower-level summaries
 */
async function generateDistilledSummary(
  fidelity: SummaryFidelity,
  period: string,
  startDate: string,
  endDate: string,
  options?: { verbose?: boolean; dryRun?: boolean; deps?: boolean }
): Promise<GenerationResult> {
  const sourceFidelity = getSourceFidelity(fidelity)!;
  const sourcePeriods = getSourcePeriods(fidelity, period);
  const warnings: string[] = [];

  if (options?.verbose) {
    console.log(`  Building from ${sourcePeriods.length} ${sourceFidelity} summaries`);
  }

  // Load or generate source summaries
  const sourceSummaries: SummaryDocument[] = [];

  for (const sourcePeriod of sourcePeriods) {
    let summary = loadSummary(sourceFidelity, sourcePeriod);

    if (!summary && options?.deps) {
      // Generate dependency
      if (options?.verbose) {
        console.log(`  Generating missing ${sourceFidelity} summary for ${sourcePeriod}...`);
      }

      const result = await generateSummary({
        fidelity: sourceFidelity,
        period: sourcePeriod,
        deps: true,
        verbose: options?.verbose,
        dryRun: options?.dryRun,
      });
      summary = result.document;
    }

    if (summary) {
      sourceSummaries.push(summary);
    } else {
      warnings.push(`Missing ${sourceFidelity} summary for ${sourcePeriod}`);
    }
  }

  if (sourceSummaries.length === 0) {
    throw new Error(`No source summaries available for ${fidelity} ${period}`);
  }

  // Distill the summaries
  const document = await distillSummaries(fidelity, period, startDate, endDate, sourceSummaries, options);

  // Analyze trends
  document.trends = await analyzeTrends(document, fidelity, period);

  return { document, collectionStatus: [], warnings };
}

/**
 * Categorize collected items using Claude
 */
async function categorizeItems(
  items: Array<{
    source: string;
    title: string;
    description?: string;
    url?: string;
    date: string;
    tags?: string[];
  }>,
  options?: { verbose?: boolean }
): Promise<SummaryItem[]> {
  if (items.length === 0) {
    return [];
  }

  // Format items for Claude
  const itemsText = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.source}] ${item.title}${item.description ? `\n   ${item.description.slice(0, 200)}` : ''}`
    )
    .join('\n');

  const prompt = `
You are categorizing items for a Director of Engineering's summary.

For each item, determine:
1. Category: engineering (technical work, code, systems), management (people, processes, team), or business (strategy, planning, stakeholders)
2. Priority: P0 (critical), P1 (high), P2 (medium), P3 (low)
3. Whether it's an action item that needs follow-up

Items:
${itemsText}

Respond with a JSON array:
[
  {
    "index": 1,
    "category": "engineering|management|business",
    "priority": "P0|P1|P2|P3",
    "isActionItem": true|false,
    "summary": "Brief one-line summary if title needs clarification"
  },
  ...
]`;

  const response = await invokeClaudeWithInput(prompt);
  const parsed = parseClaudeJson<
    Array<{
      index: number;
      category: SummaryCategory;
      priority: Priority;
      isActionItem: boolean;
      summary?: string;
    }>
  >(response);

  if (!parsed) {
    // Fallback: default categorization
    if (options?.verbose) {
      console.log('  Failed to categorize with Claude, using defaults');
    }
    return items.map((item) => ({
      id: randomUUID(),
      title: item.title,
      description: item.description,
      category: 'engineering' as const,
      priority: 'P2' as const,
      date: item.date,
      sources: [{ type: item.source as any, url: item.url, title: item.title }],
    }));
  }

  // Map parsed results back to items
  return items.map((item, i) => {
    const classification = parsed.find((p) => p.index === i + 1) ?? {
      category: 'engineering' as const,
      priority: 'P2' as const,
      isActionItem: false,
    };

    return {
      id: randomUUID(),
      title: classification.summary ?? item.title,
      description: item.description,
      category: classification.category,
      priority: classification.priority,
      date: item.date,
      sources: [{ type: item.source as any, url: item.url, title: item.title }],
    };
  });
}

/**
 * Build a summary document from categorized items
 */
function buildSummaryDocument(
  fidelity: SummaryFidelity,
  period: string,
  startDate: string,
  endDate: string,
  items: SummaryItem[]
): SummaryDocument {
  const engineering = items.filter((i) => i.category === 'engineering');
  const management = items.filter((i) => i.category === 'management');
  const business = items.filter((i) => i.category === 'business');

  // Calculate stats
  const stats: SummaryStats = {
    totalItems: items.length,
    byCategory: {
      engineering: engineering.length,
      management: management.length,
      business: business.length,
    },
    byPriority: {
      P0: items.filter((i) => i.priority === 'P0').length,
      P1: items.filter((i) => i.priority === 'P1').length,
      P2: items.filter((i) => i.priority === 'P2').length,
      P3: items.filter((i) => i.priority === 'P3').length,
    },
    bySource: items.reduce(
      (acc, item) => {
        for (const source of item.sources) {
          acc[source.type] = (acc[source.type] ?? 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    ),
    actionItems: items.filter((i) => i.todoId).length,
    completedActionItems: items.filter((i) => i.todoStatus === 'completed').length,
  };

  // Calculate TODO progress
  const todoProgress: TodoProgress = {
    created: items.filter((i) => i.todoId).length,
    completed: items.filter((i) => i.todoStatus === 'completed').length,
    pending: items.filter((i) => i.todoId && i.todoStatus !== 'completed').length,
    todoIds: items.filter((i) => i.todoId).map((i) => i.todoId!),
  };

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
    filePath: getSummaryFilePath(fidelity, period),
    stats,
  };
}

/**
 * Save a summary document
 */
function saveSummary(document: SummaryDocument): void {
  const jsonPath = getSummaryJsonPath(document.fidelity, document.period);
  const mdPath = getSummaryFilePath(document.fidelity, document.period);

  // Ensure directory exists
  mkdirSync(dirname(jsonPath), { recursive: true });

  // Save JSON
  writeFileSync(jsonPath, JSON.stringify(document, null, 2), 'utf-8');

  // Generate and save markdown
  const markdown = generateMarkdown(document);
  writeFileSync(mdPath, markdown, 'utf-8');
}
