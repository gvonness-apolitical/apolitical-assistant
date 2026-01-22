#!/usr/bin/env npx tsx

/**
 * TODO Reset Script
 *
 * Resets the TODO system to start fresh from a specific date.
 * This clears active TODOs and collection cache while preserving archives.
 *
 * Usage:
 *   npm run todos:reset                      # Reset with today as start date
 *   npm run todos:reset -- --from=2026-01-01 # Reset with specific start date
 *   npm run todos:reset -- --dry-run         # Show what would be reset
 *   npm run todos:reset -- --keep-completed  # Preserve completed TODOs
 */

import { readdirSync, unlinkSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { ContextStore } from '../../packages/context-store/src/store.js';
import { createInterface } from 'node:readline';
import {
  DB_PATH,
  TODO_CACHE_DIR,
  TODOS_DIR,
} from '@apolitical-assistant/shared';

const CACHE_DIR = TODO_CACHE_DIR;
const CONFIG_DIR = TODOS_DIR;

interface ResetOptions {
  fromDate: string;
  dryRun: boolean;
  keepCompleted: boolean;
  force: boolean;
}

function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().split('T')[0]!;

  const options: ResetOptions = {
    fromDate: today,
    dryRun: false,
    keepCompleted: false,
    force: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--keep-completed') options.keepCompleted = true;
    else if (arg === '--force' || arg === '-f') options.force = true;
    else if (arg.startsWith('--from=')) {
      const date = arg.split('=')[1];
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        options.fromDate = date;
      } else {
        console.error(`Invalid date format: ${date}. Use YYYY-MM-DD format.`);
        process.exit(1);
      }
    }
  }

  return options;
}

async function confirmReset(options: ResetOptions): Promise<boolean> {
  if (options.force || options.dryRun) return true;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will permanently delete data!\n');
    console.log('The following will be deleted:');
    console.log('  - All active/pending TODOs');
    if (!options.keepCompleted) {
      console.log('  - All completed TODOs (not yet archived)');
    }
    console.log('  - Collection cache (will re-fetch from all sources)');
    console.log('\nArchived TODOs will be preserved.\n');

    rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

function clearCollectionCache(dryRun: boolean): number {
  if (!existsSync(CACHE_DIR)) {
    return 0;
  }

  const cacheFiles = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));

  if (dryRun) {
    return cacheFiles.length;
  }

  for (const file of cacheFiles) {
    unlinkSync(join(CACHE_DIR, file));
  }

  return cacheFiles.length;
}

function saveResetConfig(fromDate: string, dryRun: boolean): void {
  if (dryRun) return;

  // Ensure config directory exists
  mkdirSync(CONFIG_DIR, { recursive: true });

  const resetConfigPath = join(CONFIG_DIR, 'reset-state.json');
  const resetConfig = {
    resetAt: new Date().toISOString(),
    collectFromDate: fromDate,
  };

  writeFileSync(resetConfigPath, JSON.stringify(resetConfig, null, 2), 'utf-8');
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('TODO System Reset');
  console.log('=================\n');
  console.log(`Start date for collection: ${options.fromDate}`);
  if (options.keepCompleted) {
    console.log('Completed TODOs will be preserved.');
  }

  if (options.dryRun) {
    console.log('\n(Dry run - no changes will be made)\n');
  }

  // Confirm with user
  const confirmed = await confirmReset(options);
  if (!confirmed) {
    console.log('\nReset cancelled.');
    process.exit(0);
  }

  console.log('\nResetting...\n');

  const store = new ContextStore(DB_PATH);
  let deletedCount = 0;

  try {
    // Get all TODOs to delete
    const allTodos = store.listTodos({ limit: 10000 });

    const todosToDelete = options.keepCompleted
      ? allTodos.filter((t) => t.status !== 'completed')
      : allTodos;

    if (options.dryRun) {
      console.log(`Would delete ${todosToDelete.length} TODO(s)`);

      if (todosToDelete.length > 0) {
        console.log('\nTODOs to be deleted:');
        for (const todo of todosToDelete.slice(0, 10)) {
          console.log(`  - [${todo.status}] ${todo.title}`);
        }
        if (todosToDelete.length > 10) {
          console.log(`  ... and ${todosToDelete.length - 10} more`);
        }
      }
    } else {
      // Delete TODOs
      const idsToDelete = todosToDelete.map((t) => t.id);
      if (idsToDelete.length > 0) {
        deletedCount = store.bulkDeleteTodos(idsToDelete);
        console.log(`Deleted ${deletedCount} TODO(s)`);
      } else {
        console.log('No TODOs to delete');
      }
    }

    // Clear collection cache
    const cacheFilesCleared = clearCollectionCache(options.dryRun);
    if (options.dryRun) {
      console.log(`Would clear ${cacheFilesCleared} cache file(s)`);
    } else {
      console.log(`Cleared ${cacheFilesCleared} cache file(s)`);
    }

    // Save reset configuration (for collectors to use as start date)
    saveResetConfig(options.fromDate, options.dryRun);
    if (!options.dryRun) {
      console.log(`Saved reset state with collection start date: ${options.fromDate}`);
    }

    console.log('\n✓ Reset complete!\n');

    if (!options.dryRun) {
      console.log('Next steps:');
      console.log('  1. Run `npm run todos:collect` to collect TODOs from the start date');
      console.log('  2. Run `npm run todos` to view the collected TODOs\n');
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
