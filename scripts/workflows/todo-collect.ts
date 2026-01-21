#!/usr/bin/env npx tsx

/**
 * TODO Collection Orchestrator
 *
 * Collects TODOs from all enabled sources, handles deduplication,
 * and stores them in the context store.
 *
 * Usage:
 *   npm run todos:collect              # Collect from all sources
 *   npm run todos:collect -- --verbose # Verbose output
 *   npm run todos:collect -- --source=github # Collect from specific source
 *   npm run todos:collect -- --incremental   # Only fetch since last run
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { ContextStore } from '@apolitical-assistant/context-store';
import type { Todo, TodoSource } from '@apolitical-assistant/shared';
import {
  findDuplicates,
  mergeDuplicates,
  calculateEffectivePriority,
} from '@apolitical-assistant/shared';
import {
  getEnabledCollectors,
  getAllCollectors,
  loadTodoConfig,
  getCachePath,
  type CollectionResult,
  type CollectOptions,
} from './collectors/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');

interface CollectScriptOptions extends CollectOptions {
  source?: TodoSource;
}

function parseArgs(): CollectScriptOptions {
  const args = process.argv.slice(2);
  const options: CollectScriptOptions = {
    verbose: false,
    quiet: false,
    incremental: false,
  };

  for (const arg of args) {
    if (arg === '--verbose') options.verbose = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--incremental') options.incremental = true;
    else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1] as TodoSource;
    }
  }

  return options;
}

function log(message: string, options: CollectScriptOptions): void {
  if (!options.quiet) {
    console.log(message);
  }
}

function verboseLog(message: string, options: CollectScriptOptions): void {
  if (options.verbose && !options.quiet) {
    console.log(message);
  }
}

async function collectFromAllSources(
  options: CollectScriptOptions
): Promise<CollectionResult[]> {
  const collectors = options.source
    ? getAllCollectors().filter((c) => c.source === options.source)
    : getEnabledCollectors();

  if (collectors.length === 0) {
    log('No collectors enabled or found.', options);
    return [];
  }

  log(`Collecting from ${collectors.length} source(s)...`, options);

  // Collect from all sources in parallel
  const results = await Promise.allSettled(
    collectors.map(async (collector) => {
      verboseLog(`\nCollecting from ${collector.name}...`, options);
      return collector.collect(options);
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

async function processTodos(
  collectedTodos: Todo[],
  store: ContextStore,
  options: CollectScriptOptions
): Promise<{ created: number; updated: number; skipped: number }> {
  const config = loadTodoConfig();
  const stats = { created: 0, updated: 0, skipped: 0 };

  // Get existing active todos for deduplication
  const existingTodos = store.listTodos({
    status: ['pending', 'in_progress'],
    limit: 500,
  });

  verboseLog(`\nProcessing ${collectedTodos.length} collected items...`, options);

  for (const todo of collectedTodos) {
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
          verboseLog(`  Updated: ${todo.title.slice(0, 50)}`, options);
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
        verboseLog(`  Merged: ${todo.title.slice(0, 50)} -> ${primary.id.slice(0, 8)}`, options);
        continue;
      }
    }

    // Calculate effective priority
    todo.priority = calculateEffectivePriority(todo);

    // Create new todo
    store.createTodo(todo);
    stats.created++;
    verboseLog(`  Created: ${todo.title.slice(0, 50)}`, options);
  }

  return stats;
}

async function main(): Promise<void> {
  const options = parseArgs();

  log('=== TODO Collection ===\n', options);

  // Ensure cache directory exists
  mkdirSync(getCachePath(), { recursive: true });

  // Collect from all sources
  const results = await collectFromAllSources(options);

  // Flatten all todos
  const allTodos = results.flatMap((r) => r.todos);

  if (allTodos.length === 0) {
    log('\nNo TODOs collected.', options);
    return;
  }

  log(`\nTotal collected: ${allTodos.length} items`, options);

  // Process and store todos
  const store = new ContextStore(DB_PATH);

  try {
    const stats = await processTodos(allTodos, store, options);

    log('\n=== Summary ===', options);
    log(`  Created: ${stats.created}`, options);
    log(`  Updated: ${stats.updated}`, options);
    log(`  Skipped: ${stats.skipped} (duplicates)`, options);

    // Show total active todos
    const activeTodos = store.listTodos({ status: ['pending', 'in_progress'] });
    log(`\nTotal active TODOs: ${activeTodos.length}`, options);

    // Show stale todos warning
    const staleTodos = store.getStaleTodos();
    if (staleTodos.length > 0) {
      log(`\u{26A0}\u{FE0F}  ${staleTodos.length} stale TODO(s) need attention`, options);
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
