#!/usr/bin/env tsx
/**
 * TODOs CLI
 *
 * Command-line interface for the TODOs module.
 *
 * Usage:
 *   npm run todos -- list                     # List active TODOs
 *   npm run todos -- list --all               # Include completed TODOs
 *   npm run todos -- collect                  # Collect from all sources
 *   npm run todos -- complete <id>            # Mark as complete
 *   npm run todos -- archive                  # Archive old completed TODOs
 *   npm run todos -- snooze <id> --days=3     # Snooze for 3 days
 *   npm run todos -- notify                   # Send notifications
 *   npm run todos -- stats                    # Show statistics
 */

import type { TodoSource, TodoStatus } from '@apolitical-assistant/shared';
import { formatDate } from '@apolitical-assistant/shared';
import {
  collectTodos,
  listTodos,
  getTodoStats,
  formatTextOutput,
  formatJsonOutput,
  completeTodo,
  reopenTodo,
  archiveTodos,
  getTodosForArchive,
  snoozeTodoUntil,
  snoozeTodoForDays,
  unsnoozeTodo,
  checkAndNotify,
  getUpcomingDeadlines,
  getOverdueTodos,
  getStaleTodos,
} from './index.js';

interface CliOptions {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): CliOptions {
  const command = args[0] ?? 'list';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function printUsage(): void {
  console.log(`
TODOs CLI - Manage TODOs

Usage:
  npm run todos -- <command> [options]

Commands:
  list              List TODOs (default)
  collect           Collect TODOs from all sources
  complete <id>     Mark TODO as complete
  reopen <id>       Reopen a completed TODO
  archive           Archive completed TODOs
  snooze <id>       Snooze a TODO
  unsnooze <id>     Remove snooze from a TODO
  notify            Check and send notifications
  stats             Show statistics
  upcoming          Show upcoming deadlines
  overdue           Show overdue TODOs
  stale             Show stale TODOs

Options:
  --all             Include completed TODOs (list)
  --json            Output as JSON (list)
  --verbose         Show detailed output
  --quiet           Minimal output
  --source=NAME     Filter by source
  --days=N          Number of days (snooze, archive)
  --until=DATE      Snooze until date (YYYY-MM-DD)
  --dry-run         Show what would happen

Examples:
  npm run todos -- list
  npm run todos -- list --all --json
  npm run todos -- collect --verbose
  npm run todos -- complete abc123
  npm run todos -- snooze abc123 --days=7
  npm run todos -- archive --dry-run
`);
}

async function handleList(flags: Record<string, string | boolean>): Promise<void> {
  const status: TodoStatus[] = flags.all
    ? ['pending', 'in_progress', 'completed', 'archived']
    : ['pending', 'in_progress'];

  const todos = listTodos({
    status,
    source: flags.source as TodoSource | undefined,
    limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 50,
    onlyStale: flags.stale === true,
    onlySnoozed: flags.snoozed === true,
  });

  if (flags.json) {
    console.log(formatJsonOutput(todos));
  } else {
    console.log(formatTextOutput(todos, {
      verbose: flags.verbose === true,
      quiet: flags.quiet === true,
    }));
  }
}

async function handleCollect(flags: Record<string, string | boolean>): Promise<void> {
  console.log('=== TODO Collection ===\n');

  const { stats } = await collectTodos({
    verbose: flags.verbose === true,
    quiet: flags.quiet === true,
    incremental: flags.incremental === true,
    source: flags.source as TodoSource | undefined,
  });

  if (!flags.quiet) {
    console.log('\n=== Summary ===');
    console.log(`  Created: ${stats.created}`);
    console.log(`  Updated: ${stats.updated}`);
    console.log(`  Skipped: ${stats.skipped} (duplicates)`);
    if (stats.errors > 0) {
      console.log(`  Errors: ${stats.errors}`);
    }

    const totalActive = listTodos({ status: ['pending', 'in_progress'] }).length;
    console.log(`\nTotal active TODOs: ${totalActive}`);

    const staleTodos = getStaleTodos();
    if (staleTodos.length > 0) {
      console.log(`  ${staleTodos.length} stale TODO(s) need attention`);
    }
  }
}

async function handleComplete(positional: string[], _flags: Record<string, string | boolean>): Promise<void> {
  if (positional.length === 0) {
    console.error('Error: Please provide TODO ID(s) to complete');
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const id of positional) {
    const result = completeTodo(id);
    if (result.success) {
      console.log(`Completed: ${result.title}`);
      successCount++;
    } else {
      console.error(`Error: ${result.error}`);
      errorCount++;
    }
  }

  if (positional.length > 1) {
    console.log(`\nSummary: ${successCount} completed, ${errorCount} failed`);
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

async function handleReopen(positional: string[], _flags: Record<string, string | boolean>): Promise<void> {
  if (positional.length === 0) {
    console.error('Error: Please provide TODO ID(s) to reopen');
    process.exit(1);
  }

  for (const id of positional) {
    const result = reopenTodo(id);
    if (result.success) {
      console.log(`Reopened: ${result.title}`);
    } else {
      console.error(`Error: ${result.error}`);
    }
  }
}

async function handleArchive(flags: Record<string, string | boolean>): Promise<void> {
  const days = typeof flags.days === 'string' ? parseInt(flags.days, 10) : undefined;
  const dryRun = flags['dry-run'] === true;

  if (dryRun) {
    const todosToArchive = getTodosForArchive(days);
    console.log(`Would archive ${todosToArchive.length} TODO(s)`);
    if (flags.verbose) {
      for (const todo of todosToArchive) {
        console.log(`  - ${todo.title}`);
      }
    }
    return;
  }

  const result = archiveTodos({ days, dryRun });

  console.log(`Archived ${result.archivedCount} TODO(s)`);
  if (flags.verbose && result.byMonth.size > 0) {
    console.log('By month:');
    for (const [month, count] of result.byMonth) {
      console.log(`  ${month}: ${count}`);
    }
  }

  if (result.errors.length > 0) {
    console.error('Errors:');
    for (const error of result.errors) {
      console.error(`  ${error}`);
    }
  }
}

async function handleSnooze(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  if (positional.length === 0) {
    console.error('Error: Please provide TODO ID to snooze');
    process.exit(1);
  }

  const id = positional[0];
  let result;

  if (flags.until) {
    result = snoozeTodoUntil(id, flags.until as string);
  } else if (flags.days) {
    result = snoozeTodoForDays(id, parseInt(flags.days as string, 10));
  } else {
    // Default to 1 day
    result = snoozeTodoForDays(id, 1);
  }

  if (result.success) {
    console.log(`Snoozed until ${formatDate(result.snoozeUntil!)}: ${result.title}`);
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

async function handleUnsnooze(positional: string[], _flags: Record<string, string | boolean>): Promise<void> {
  if (positional.length === 0) {
    console.error('Error: Please provide TODO ID to unsnooze');
    process.exit(1);
  }

  const result = unsnoozeTodo(positional[0]);
  if (result.success) {
    console.log(`Unsnoozed: ${result.title}`);
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

async function handleNotify(flags: Record<string, string | boolean>): Promise<void> {
  console.log('Checking for notifications...\n');

  const result = await checkAndNotify({ quiet: flags.quiet === true });

  if (!flags.quiet) {
    if (result.unsnoozed.length > 0) {
      console.log(`Auto-unsnoozed: ${result.unsnoozed.length} TODO(s)`);
    }
    console.log(`Sent ${result.sentCount} notification(s)`);
    if (result.errors.length > 0) {
      console.error('\nErrors:');
      for (const error of result.errors) {
        console.error(`  ${error}`);
      }
    }
  }
}

async function handleStats(flags: Record<string, string | boolean>): Promise<void> {
  const stats = getTodoStats();

  if (flags.json) {
    console.log(JSON.stringify({
      ...stats,
      bySource: Object.fromEntries(stats.bySource),
      byCategory: Object.fromEntries(stats.byCategory),
      byPriority: Object.fromEntries(stats.byPriority),
    }, null, 2));
    return;
  }

  console.log('=== TODO Statistics ===\n');
  console.log(`Total: ${stats.total}`);
  console.log(`Active: ${stats.active}`);
  console.log(`Completed: ${stats.completed}`);
  console.log(`Overdue: ${stats.overdue}`);
  console.log(`Stale: ${stats.stale}`);
  console.log(`Snoozed: ${stats.snoozed}`);

  if (stats.bySource.size > 0) {
    console.log('\nBy Source:');
    for (const [source, count] of stats.bySource) {
      console.log(`  ${source}: ${count}`);
    }
  }

  if (stats.byCategory.size > 0) {
    console.log('\nBy Category:');
    for (const [category, count] of stats.byCategory) {
      console.log(`  ${category}: ${count}`);
    }
  }

  if (stats.byPriority.size > 0) {
    console.log('\nBy Priority:');
    for (const [priority, count] of stats.byPriority) {
      console.log(`  P${priority}: ${count}`);
    }
  }
}

async function handleUpcoming(flags: Record<string, string | boolean>): Promise<void> {
  const days = typeof flags.days === 'string' ? parseInt(flags.days, 10) : 7;
  const upcoming = getUpcomingDeadlines(days);

  if (flags.json) {
    console.log(JSON.stringify(upcoming, null, 2));
    return;
  }

  console.log(`=== Upcoming Deadlines (next ${days} days) ===\n`);

  if (upcoming.length === 0) {
    console.log('No upcoming deadlines');
    return;
  }

  for (const item of upcoming) {
    const dueText = item.daysUntil === 0 ? 'Today' :
                    item.daysUntil === 1 ? 'Tomorrow' :
                    `In ${item.daysUntil} days`;
    console.log(`[${dueText}] ${item.todo.title}`);
  }
}

async function handleOverdue(flags: Record<string, string | boolean>): Promise<void> {
  const overdue = getOverdueTodos();

  if (flags.json) {
    console.log(JSON.stringify(overdue, null, 2));
    return;
  }

  console.log('=== Overdue TODOs ===\n');

  if (overdue.length === 0) {
    console.log('No overdue TODOs');
    return;
  }

  for (const todo of overdue) {
    const dueDate = todo.deadline || todo.dueDate;
    console.log(`[${formatDate(dueDate!)}] ${todo.title}`);
  }
}

async function handleStale(flags: Record<string, string | boolean>): Promise<void> {
  const stale = getStaleTodos();

  if (flags.json) {
    console.log(JSON.stringify(stale, null, 2));
    return;
  }

  console.log('=== Stale TODOs ===\n');

  if (stale.length === 0) {
    console.log('No stale TODOs');
    return;
  }

  for (const todo of stale) {
    console.log(`[${formatDate(todo.createdAt)}] ${todo.title}`);
  }
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || flags.h || command === 'help') {
    printUsage();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'list':
        await handleList(flags);
        break;
      case 'collect':
        await handleCollect(flags);
        break;
      case 'complete':
        await handleComplete(positional, flags);
        break;
      case 'reopen':
      case 'undo':
        await handleReopen(positional, flags);
        break;
      case 'archive':
        await handleArchive(flags);
        break;
      case 'snooze':
        await handleSnooze(positional, flags);
        break;
      case 'unsnooze':
        await handleUnsnooze(positional, flags);
        break;
      case 'notify':
        await handleNotify(flags);
        break;
      case 'stats':
        await handleStats(flags);
        break;
      case 'upcoming':
        await handleUpcoming(flags);
        break;
      case 'overdue':
        await handleOverdue(flags);
        break;
      case 'stale':
        await handleStale(flags);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
