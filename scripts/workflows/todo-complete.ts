#!/usr/bin/env npx tsx

/**
 * TODO Complete Script
 *
 * Mark one or more TODOs as complete.
 *
 * Usage:
 *   npm run todos:complete <id>              # Complete a single TODO
 *   npm run todos:complete <id1> <id2> ...   # Complete multiple TODOs
 *   npm run todos:complete -- --undo <id>    # Mark as pending (undo complete)
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContextStore } from '@apolitical-assistant/context-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');

interface CompleteOptions {
  ids: string[];
  undo: boolean;
}

function parseArgs(): CompleteOptions {
  const args = process.argv.slice(2);
  const options: CompleteOptions = {
    ids: [],
    undo: false,
  };

  for (const arg of args) {
    if (arg === '--undo') {
      options.undo = true;
    } else if (!arg.startsWith('-')) {
      options.ids.push(arg);
    }
  }

  return options;
}

function findTodoByPartialId(store: ContextStore, partialId: string): string | null {
  // Try exact match first
  const exactTodo = store.getTodo(partialId);
  if (exactTodo) return partialId;

  // Try partial match (first 8 characters)
  const todos = store.listTodos({ limit: 500 });
  const matches = todos.filter((t) => t.id.startsWith(partialId));

  if (matches.length === 1) {
    return matches[0].id;
  } else if (matches.length > 1) {
    console.error(`Ambiguous ID "${partialId}" matches ${matches.length} TODOs:`);
    for (const match of matches.slice(0, 5)) {
      console.error(`  - ${match.id.slice(0, 8)}: ${match.title}`);
    }
    return null;
  }

  return null;
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.ids.length === 0) {
    console.error('Usage: npm run todos:complete <id> [<id2> ...]');
    console.error('       npm run todos:complete -- --undo <id>');
    process.exit(1);
  }

  const store = new ContextStore(DB_PATH);

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const partialId of options.ids) {
      const fullId = findTodoByPartialId(store, partialId);

      if (!fullId) {
        console.error(`TODO not found: ${partialId}`);
        errorCount++;
        continue;
      }

      const todo = store.getTodo(fullId);
      if (!todo) {
        console.error(`TODO not found: ${partialId}`);
        errorCount++;
        continue;
      }

      if (options.undo) {
        // Undo completion - mark as pending
        const updated = store.updateTodo(fullId, {
          status: 'pending',
          completedAt: undefined,
        });

        if (updated) {
          console.log(`\u{2B55} Marked as pending: ${todo.title}`);
          successCount++;
        } else {
          console.error(`Failed to update TODO: ${partialId}`);
          errorCount++;
        }
      } else {
        // Mark as complete
        const updated = store.completeTodo(fullId);

        if (updated) {
          console.log(`\u{2705} Completed: ${todo.title}`);
          successCount++;
        } else {
          console.error(`Failed to complete TODO: ${partialId}`);
          errorCount++;
        }
      }
    }

    // Summary
    if (options.ids.length > 1) {
      console.log(`\nSummary: ${successCount} ${options.undo ? 'reopened' : 'completed'}, ${errorCount} failed`);
    }

    if (errorCount > 0) {
      process.exit(1);
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
