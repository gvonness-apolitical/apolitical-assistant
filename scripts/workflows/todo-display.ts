#!/usr/bin/env npx tsx

/**
 * TODO Display Script
 *
 * Displays TODOs from the context store with various filtering options.
 *
 * Usage:
 *   npm run todos              # Show active TODOs
 *   npm run todos -- --all     # Include completed TODOs
 *   npm run todos -- --json    # Output as JSON
 *   npm run todos -- --stale   # Show only stale TODOs
 *   npm run todos -- --snoozed # Show only snoozed TODOs
 *   npm run todos -- --source=github # Filter by source
 *   npm run todos -- --verbose # Show priority explanations
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContextStore } from '@apolitical-assistant/context-store';
import type { Todo, TodoSource } from '@apolitical-assistant/shared';
import {
  calculateEffectivePriority,
  formatTodoForDisplay,
  isStale,
  getDaysUntilDate,
} from '@apolitical-assistant/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');

interface DisplayOptions {
  all: boolean;
  json: boolean;
  stale: boolean;
  snoozed: boolean;
  source?: TodoSource;
  verbose: boolean;
  quiet: boolean;
  limit: number;
}

function parseArgs(): DisplayOptions {
  const args = process.argv.slice(2);
  const options: DisplayOptions = {
    all: false,
    json: false,
    stale: false,
    snoozed: false,
    verbose: false,
    quiet: false,
    limit: 50,
  };

  for (const arg of args) {
    if (arg === '--all') options.all = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--stale') options.stale = true;
    else if (arg === '--snoozed') options.snoozed = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1] as TodoSource;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

function groupTodosByStatus(todos: Todo[]): {
  overdue: Todo[];
  active: Todo[];
  snoozed: Todo[];
  stale: Todo[];
  completed: Todo[];
} {
  const now = new Date();
  const groups = {
    overdue: [] as Todo[],
    active: [] as Todo[],
    snoozed: [] as Todo[],
    stale: [] as Todo[],
    completed: [] as Todo[],
  };

  for (const todo of todos) {
    if (todo.status === 'completed' || todo.status === 'archived') {
      groups.completed.push(todo);
      continue;
    }

    // Check if snoozed
    if (todo.snoozedUntil && new Date(todo.snoozedUntil) > now) {
      groups.snoozed.push(todo);
      continue;
    }

    // Check if overdue
    const targetDate = todo.deadline || todo.dueDate;
    if (targetDate && getDaysUntilDate(targetDate) < 0) {
      groups.overdue.push(todo);
      continue;
    }

    // Check if stale
    if (isStale(todo)) {
      groups.stale.push(todo);
      continue;
    }

    groups.active.push(todo);
  }

  // Sort each group by effective priority
  for (const key of Object.keys(groups) as (keyof typeof groups)[]) {
    groups[key].sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b));
  }

  return groups;
}

function displayTextOutput(todos: Todo[], options: DisplayOptions): void {
  if (todos.length === 0) {
    if (!options.quiet) {
      console.log('No TODOs found.');
    }
    return;
  }

  const groups = groupTodosByStatus(todos);
  const totalActive = groups.overdue.length + groups.active.length + groups.stale.length;

  if (!options.quiet) {
    console.log(`\n=== TODO List (${totalActive} active, ${groups.snoozed.length} snoozed) ===\n`);
  }

  // Display overdue items first (always)
  if (groups.overdue.length > 0) {
    console.log('\u{1F6A8} OVERDUE\n');
    for (const todo of groups.overdue) {
      console.log(formatTodoForDisplay(todo, { verbose: options.verbose }));
      console.log();
    }
  }

  // Display stale items if requested or if there are any
  if (options.stale || groups.stale.length > 0) {
    if (groups.stale.length > 0) {
      console.log('\u{26A0}\u{FE0F}  STALE (no updates in 14+ days)\n');
      for (const todo of groups.stale) {
        console.log(formatTodoForDisplay(todo, { verbose: options.verbose }));
        console.log();
      }
    }
  }

  // Display active items (unless only showing stale or snoozed)
  if (!options.stale && !options.snoozed && groups.active.length > 0) {
    console.log('\u{1F4CB} ACTIVE\n');
    for (const todo of groups.active) {
      console.log(formatTodoForDisplay(todo, { verbose: options.verbose }));
      console.log();
    }
  }

  // Display snoozed items if requested
  if (options.snoozed && groups.snoozed.length > 0) {
    console.log('\u{1F4A4} SNOOZED\n');
    for (const todo of groups.snoozed) {
      console.log(formatTodoForDisplay(todo, { verbose: options.verbose }));
      console.log();
    }
  }

  // Display completed items if --all
  if (options.all && groups.completed.length > 0) {
    console.log('\u{2705} COMPLETED\n');
    for (const todo of groups.completed.slice(0, 10)) {
      console.log(formatTodoForDisplay(todo, { verbose: options.verbose }));
      console.log();
    }
    if (groups.completed.length > 10) {
      console.log(`   ... and ${groups.completed.length - 10} more completed items\n`);
    }
  }

  // Summary
  if (!options.quiet) {
    console.log('---');
    console.log(
      `Total: ${totalActive} active | ${groups.snoozed.length} snoozed | ${groups.completed.length} completed`
    );
    if (groups.overdue.length > 0) {
      console.log(`\u{26A0}\u{FE0F}  ${groups.overdue.length} overdue item${groups.overdue.length !== 1 ? 's' : ''}`);
    }
    if (groups.stale.length > 0) {
      console.log(`\u{26A0}\u{FE0F}  ${groups.stale.length} stale item${groups.stale.length !== 1 ? 's' : ''}`);
    }
  }
}

function displayJsonOutput(todos: Todo[]): void {
  const groups = groupTodosByStatus(todos);

  const output = {
    summary: {
      total: todos.length,
      overdue: groups.overdue.length,
      active: groups.active.length,
      stale: groups.stale.length,
      snoozed: groups.snoozed.length,
      completed: groups.completed.length,
    },
    todos: todos.map((todo) => ({
      ...todo,
      effectivePriority: calculateEffectivePriority(todo),
      isStale: isStale(todo),
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

async function main(): Promise<void> {
  const options = parseArgs();

  const store = new ContextStore(DB_PATH);

  try {
    // Build query options
    const queryOptions: Parameters<typeof store.listTodos>[0] = {
      limit: options.limit,
      orderBy: 'priority',
    };

    // Determine status filter
    if (options.all) {
      // Include all statuses
      queryOptions.status = ['pending', 'in_progress', 'completed', 'archived'];
    } else {
      // Only active statuses
      queryOptions.status = ['pending', 'in_progress'];
    }

    // Source filter
    if (options.source) {
      queryOptions.source = options.source;
    }

    // Stale filter
    if (options.stale) {
      queryOptions.onlyStale = true;
    }

    // Snoozed filter
    if (options.snoozed) {
      queryOptions.onlySnoozed = true;
    }

    const todos = store.listTodos(queryOptions);

    if (options.json) {
      displayJsonOutput(todos);
    } else {
      displayTextOutput(todos, options);
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
