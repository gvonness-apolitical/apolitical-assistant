/**
 * TODO Collection
 *
 * Collects TODOs from all enabled sources using the shared collectors layer.
 */

import type { Todo, TodoSource } from '@apolitical-assistant/shared';
import {
  findDuplicates,
  mergeDuplicates,
  calculateEffectivePriority,
} from '@apolitical-assistant/shared';
import { ContextStore } from '@apolitical-assistant/context-store';
import {
  getEnabledCollectors,
  getAllCollectors,
  type CollectionResult,
} from '../collectors/index.js';
import { loadTodoConfig, DB_PATH, ensureDirectories } from './config.js';
import type { CollectOptions, ProcessingStats } from './types.js';

/**
 * Collect TODOs from all enabled sources
 */
export async function collectFromAllSources(
  options: CollectOptions = {}
): Promise<CollectionResult[]> {
  const collectors = options.source
    ? getAllCollectors().filter((c) => c.source === options.source)
    : getEnabledCollectors();

  if (collectors.length === 0) {
    if (!options.quiet) {
      console.log('No collectors enabled or found.');
    }
    return [];
  }

  if (!options.quiet) {
    console.log(`Collecting from ${collectors.length} source(s)...`);
  }

  // Collect from all sources in parallel
  const results = await Promise.allSettled(
    collectors.map(async (collector) => {
      if (options.verbose) {
        console.log(`\nCollecting from ${collector.name}...`);
      }
      return collector.collect({
        verbose: options.verbose,
        quiet: options.quiet,
        incremental: options.incremental,
      });
    })
  );

  // Process results
  const collectionResults: CollectionResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const collector = collectors[i];

    if (result.status === 'fulfilled') {
      collectionResults.push(result.value);

      const r = result.value;
      if (!options.quiet) {
        const errorInfo = r.errors.length > 0 ? ` (${r.errors.length} errors)` : '';
        console.log(
          `  [${collector.name}] ${r.todos.length} items in ${r.durationMs}ms${errorInfo}`
        );
      }
    } else {
      if (!options.quiet) {
        console.error(`  [${collector.name}] Failed: ${result.reason}`);
      }
    }
  }

  return collectionResults;
}

/**
 * Process and store collected TODOs
 */
export async function processTodos(
  collectedTodos: Todo[],
  store: ContextStore,
  options: CollectOptions = {}
): Promise<ProcessingStats> {
  const config = loadTodoConfig();
  const stats: ProcessingStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

  // Get existing active todos for deduplication
  const existingTodos = store.listTodos({
    status: ['pending', 'in_progress'],
    limit: 500,
  });

  if (options.verbose) {
    console.log(`\nProcessing ${collectedTodos.length} collected items...`);
  }

  for (const todo of collectedTodos) {
    try {
      // Check for existing todo by source ID
      if (todo.source && todo.sourceId) {
        const existing = store.getTodoBySourceId(todo.source, todo.sourceId);
        if (existing) {
          // Update if the todo has changed
          if (existing.title !== todo.title || existing.sourceUrl !== todo.sourceUrl) {
            store.updateTodo(existing.id, {
              title: todo.title,
              sourceUrl: todo.sourceUrl,
            });
            stats.updated++;
            if (options.verbose) {
              console.log(`  Updated: ${todo.title.slice(0, 50)}`);
            }
          } else {
            stats.skipped++;
          }
          continue;
        }
      }

      // Check for duplicates using fingerprint and fuzzy matching
      if (config.deduplication.enabled) {
        const duplicates = findDuplicates(todo, existingTodos, config.deduplication.fuzzyThreshold);

        if (duplicates.length > 0) {
          // Merge with primary duplicate
          const primary = duplicates[0];
          const mergedData = mergeDuplicates(primary, [todo]);

          store.updateTodo(primary.id, mergedData);
          stats.updated++;
          if (options.verbose) {
            console.log(`  Merged: ${todo.title.slice(0, 50)} -> ${primary.id.slice(0, 8)}`);
          }
          continue;
        }
      }

      // Calculate effective priority
      todo.priority = calculateEffectivePriority(todo);

      // Create new todo
      store.createTodo(todo);
      stats.created++;
      if (options.verbose) {
        console.log(`  Created: ${todo.title.slice(0, 50)}`);
      }
    } catch (error) {
      stats.errors++;
      if (!options.quiet) {
        console.error(`  Error processing todo: ${error}`);
      }
    }
  }

  return stats;
}

/**
 * Main collection function - collect and process TODOs
 */
export async function collectTodos(
  options: CollectOptions = {}
): Promise<{
  results: CollectionResult[];
  stats: ProcessingStats;
}> {
  // Ensure directories exist
  ensureDirectories();

  // Collect from all sources
  const results = await collectFromAllSources(options);

  // Flatten all todos
  const allTodos = results.flatMap((r) => r.todos);

  if (allTodos.length === 0) {
    if (!options.quiet) {
      console.log('\nNo TODOs collected.');
    }
    return {
      results,
      stats: { created: 0, updated: 0, skipped: 0, errors: 0 },
    };
  }

  if (!options.quiet) {
    console.log(`\nTotal collected: ${allTodos.length} items`);
  }

  // Process and store todos
  const store = new ContextStore(DB_PATH);

  try {
    const stats = await processTodos(allTodos, store, options);
    return { results, stats };
  } finally {
    store.close();
  }
}

/**
 * Get collection status summary
 */
export function getCollectionStatusSummary(results: CollectionResult[]): {
  totalSources: number;
  successfulSources: number;
  totalItems: number;
  totalErrors: number;
  bySource: Map<TodoSource, { items: number; errors: number; durationMs: number }>;
} {
  const bySource = new Map<TodoSource, { items: number; errors: number; durationMs: number }>();
  let totalItems = 0;
  let totalErrors = 0;

  for (const result of results) {
    bySource.set(result.source, {
      items: result.todos.length,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });
    totalItems += result.todos.length;
    totalErrors += result.errors.length;
  }

  return {
    totalSources: results.length,
    successfulSources: results.filter((r) => r.errors.length === 0).length,
    totalItems,
    totalErrors,
    bySource,
  };
}
