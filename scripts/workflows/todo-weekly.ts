#!/usr/bin/env npx tsx

/**
 * TODO Weekly Summary Script
 *
 * Generates a weekly summary report of TODO activity.
 *
 * Usage:
 *   npm run todos:weekly                     # Display summary
 *   npm run todos:weekly -- --output file.md # Save to file
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { ContextStore } from '@apolitical-assistant/context-store';
import type { TodoSource } from '@apolitical-assistant/shared';
import {
  formatDate,
  isStale,
  getDaysUntilDate,
} from '@apolitical-assistant/shared';
import { loadTodoConfig } from './collectors/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');

interface WeeklyOptions {
  output?: string;
}

function parseArgs(): WeeklyOptions {
  const args = process.argv.slice(2);
  const options: WeeklyOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i].startsWith('--output=')) {
      options.output = args[i].split('=')[1];
    }
  }

  return options;
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Start of week (Monday)
  const start = new Date(now);
  start.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  start.setHours(0, 0, 0, 0);

  // End of week (Sunday)
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function generateReport(store: ContextStore): string {
  const config = loadTodoConfig();
  const { start, end } = getWeekBounds();
  const weekStartStr = formatDate(start.toISOString());
  const weekEndStr = formatDate(end.toISOString());

  // Get all todos for analysis
  const allTodos = store.listTodos({
    status: ['pending', 'in_progress', 'completed'],
    limit: 500,
  });

  // Completed this week
  const completedThisWeek = allTodos.filter((t) => {
    if (t.status !== 'completed' || !t.completedAt) return false;
    const completedDate = new Date(t.completedAt);
    return completedDate >= start && completedDate <= end;
  });

  // Created this week
  const createdThisWeek = allTodos.filter((t) => {
    const createdDate = new Date(t.createdAt);
    return createdDate >= start && createdDate <= end;
  });

  // Active todos
  const activeTodos = allTodos.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );

  // Overdue
  const overdue = activeTodos.filter((t) => {
    const targetDate = t.deadline || t.dueDate;
    return targetDate && getDaysUntilDate(targetDate) < 0;
  });

  // Stale
  const stale = activeTodos.filter((t) => isStale(t, config.staleDays));

  // Group by source
  const bySource = new Map<TodoSource | 'manual', { completed: number; new: number; pending: number }>();

  for (const todo of allTodos) {
    const source = todo.source || 'manual';
    if (!bySource.has(source)) {
      bySource.set(source, { completed: 0, new: 0, pending: 0 });
    }

    const stats = bySource.get(source)!;

    if (completedThisWeek.includes(todo)) stats.completed++;
    if (createdThisWeek.includes(todo)) stats.new++;
    if (activeTodos.includes(todo)) stats.pending++;
  }

  // Generate markdown report
  let report = `# Weekly TODO Summary
Week of ${weekStartStr} - ${weekEndStr}

`;

  // Completed section
  report += `## \u{2705} Completed (${completedThisWeek.length})\n`;
  if (completedThisWeek.length === 0) {
    report += '_No TODOs completed this week_\n';
  } else {
    for (const todo of completedThisWeek.slice(0, 20)) {
      const completedDate = formatDate(todo.completedAt!);
      report += `- ${todo.title} [${todo.source || 'manual'}] - Completed ${completedDate}\n`;
    }
    if (completedThisWeek.length > 20) {
      report += `_...and ${completedThisWeek.length - 20} more_\n`;
    }
  }

  report += '\n';

  // Statistics
  report += `## \u{1F4CA} Statistics
- Completed: ${completedThisWeek.length}
- New: ${createdThisWeek.length}
- Carried over: ${activeTodos.length - createdThisWeek.filter((t) => activeTodos.includes(t)).length}
- Total active: ${activeTodos.length}

`;

  // Overdue section
  if (overdue.length > 0) {
    report += `## \u{1F534} Overdue (${overdue.length})\n`;
    for (const todo of overdue) {
      const dueDate = formatDate(todo.deadline || todo.dueDate!);
      report += `- ${todo.title} [${todo.source || 'manual'}] - Due ${dueDate}\n`;
    }
    report += '\n';
  }

  // Stale section
  if (stale.length > 0) {
    report += `## \u{26A0}\u{FE0F} Stale (${stale.length})\n`;
    for (const todo of stale.slice(0, 10)) {
      const createdDate = formatDate(todo.createdAt);
      report += `- ${todo.title} [${todo.source || 'manual'}] - Created ${createdDate}\n`;
    }
    if (stale.length > 10) {
      report += `_...and ${stale.length - 10} more_\n`;
    }
    report += '\n';
  }

  // By source table
  report += `## \u{1F4C8} By Source
| Source | Completed | New | Pending |
|--------|-----------|-----|---------|
`;

  for (const [source, stats] of bySource) {
    if (stats.completed > 0 || stats.new > 0 || stats.pending > 0) {
      report += `| ${source} | ${stats.completed} | ${stats.new} | ${stats.pending} |\n`;
    }
  }

  report += '\n---\n_Generated by Apolitical Assistant_\n';

  return report;
}

async function main(): Promise<void> {
  const options = parseArgs();

  const store = new ContextStore(DB_PATH);

  try {
    const report = generateReport(store);

    if (options.output) {
      writeFileSync(options.output, report, 'utf-8');
      console.log(`Weekly summary saved to: ${options.output}`);
    } else {
      console.log(report);
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
