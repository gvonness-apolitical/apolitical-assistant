#!/usr/bin/env npx tsx

/**
 * TODO Snooze Script
 *
 * Snooze TODOs until a specified date.
 *
 * Usage:
 *   npm run todos:snooze <id> --until 2026-01-25    # Snooze until specific date
 *   npm run todos:snooze <id> --days 3              # Snooze for N days
 *   npm run todos:snooze <id> --unsnooze            # Remove snooze
 */

import { ContextStore } from '@apolitical-assistant/context-store';
import { addDays, formatDate, DB_PATH } from '@apolitical-assistant/shared';

interface SnoozeOptions {
  id: string;
  until?: string;
  days?: number;
  unsnooze: boolean;
}

function parseArgs(): SnoozeOptions {
  const args = process.argv.slice(2);
  const options: SnoozeOptions = {
    id: '',
    unsnooze: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--unsnooze') {
      options.unsnooze = true;
    } else if (arg === '--until' && args[i + 1]) {
      options.until = args[++i];
    } else if (arg === '--days' && args[i + 1]) {
      options.days = parseInt(args[++i], 10);
    } else if (arg.startsWith('--until=')) {
      options.until = arg.split('=')[1];
    } else if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10);
    } else if (!arg.startsWith('-')) {
      options.id = arg;
    }
  }

  return options;
}

function findTodoByPartialId(store: ContextStore, partialId: string): string | null {
  const exactTodo = store.getTodo(partialId);
  if (exactTodo) return partialId;

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

  if (!options.id) {
    console.error('Usage: npm run todos:snooze <id> --until <date>');
    console.error('       npm run todos:snooze <id> --days <n>');
    console.error('       npm run todos:snooze <id> --unsnooze');
    process.exit(1);
  }

  if (!options.unsnooze && !options.until && options.days === undefined) {
    console.error('Please specify --until <date>, --days <n>, or --unsnooze');
    process.exit(1);
  }

  const store = new ContextStore(DB_PATH);

  try {
    const fullId = findTodoByPartialId(store, options.id);
    if (!fullId) {
      console.error(`TODO not found: ${options.id}`);
      process.exit(1);
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      console.error(`TODO not found: ${options.id}`);
      process.exit(1);
    }

    if (options.unsnooze) {
      const updated = store.unsnoozeTodo(fullId);
      if (updated) {
        console.log(`\u{2B55} Unsnoozed: ${todo.title}`);
      } else {
        console.error('Failed to unsnooze TODO');
        process.exit(1);
      }
    } else {
      let snoozeDate: string;

      if (options.until) {
        snoozeDate = options.until;
      } else if (options.days !== undefined) {
        snoozeDate = addDays(options.days);
      } else {
        console.error('No snooze date specified');
        process.exit(1);
      }

      const updated = store.snoozeTodo(fullId, snoozeDate);
      if (updated) {
        console.log(`\u{1F4A4} Snoozed until ${formatDate(snoozeDate)}: ${todo.title}`);
      } else {
        console.error('Failed to snooze TODO');
        process.exit(1);
      }
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
