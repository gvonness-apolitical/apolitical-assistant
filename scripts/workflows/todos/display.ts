/**
 * TODO Display
 *
 * Display and format TODOs for output.
 */

import type { Todo } from '@apolitical-assistant/shared';
import {
  calculateEffectivePriority,
  formatTodoForDisplay,
  isStale,
  getDaysUntilDate,
} from '@apolitical-assistant/shared';
import { ContextStore } from '@apolitical-assistant/context-store';
import { DB_PATH, loadTodoConfig } from './config.js';
import type { ListOptions, TodoWithComputed, GroupedTodos } from './types.js';

/**
 * Enhance a TODO with computed fields
 */
export function computeTodoFields(todo: Todo): TodoWithComputed {
  const now = new Date();
  const targetDate = todo.deadline || todo.dueDate;
  const config = loadTodoConfig();

  let daysUntilDue: number | undefined;
  let isOverdue = false;

  if (targetDate) {
    daysUntilDue = getDaysUntilDate(targetDate);
    isOverdue = daysUntilDue < 0;
  }

  return {
    ...todo,
    effectivePriority: calculateEffectivePriority(todo),
    isStale: isStale(todo, config.staleDays),
    isSnoozed: todo.snoozedUntil ? new Date(todo.snoozedUntil) > now : false,
    isOverdue,
    daysUntilDue,
  };
}

/**
 * Group TODOs by status
 */
export function groupTodosByStatus(todos: Todo[]): GroupedTodos {
  const groups: GroupedTodos = {
    overdue: [],
    active: [],
    snoozed: [],
    stale: [],
    completed: [],
  };

  for (const todo of todos) {
    const computed = computeTodoFields(todo);

    if (todo.status === 'completed' || todo.status === 'archived') {
      groups.completed.push(computed);
      continue;
    }

    // Check if snoozed
    if (computed.isSnoozed) {
      groups.snoozed.push(computed);
      continue;
    }

    // Check if overdue
    if (computed.isOverdue) {
      groups.overdue.push(computed);
      continue;
    }

    // Check if stale
    if (computed.isStale) {
      groups.stale.push(computed);
      continue;
    }

    groups.active.push(computed);
  }

  // Sort each group by effective priority
  for (const key of Object.keys(groups) as (keyof GroupedTodos)[]) {
    groups[key].sort((a, b) => a.effectivePriority - b.effectivePriority);
  }

  return groups;
}

/**
 * List TODOs with filtering options
 */
export function listTodos(options: ListOptions = {}): Todo[] {
  const store = new ContextStore(DB_PATH);
  try {
    return store.listTodos({
      status: options.status || ['pending', 'in_progress'],
      source: options.source,
      limit: options.limit || 50,
      orderBy: options.orderBy || 'priority',
      onlyStale: options.onlyStale,
      onlySnoozed: options.onlySnoozed,
      excludeSnoozed: options.excludeSnoozed,
    });
  } finally {
    store.close();
  }
}

/**
 * Get a single TODO by ID
 */
export function getTodo(id: string): Todo | null {
  const store = new ContextStore(DB_PATH);
  try {
    return store.getTodo(id);
  } finally {
    store.close();
  }
}

/**
 * Find TODO by partial ID
 */
export function findTodoByPartialId(partialId: string): string | null {
  const store = new ContextStore(DB_PATH);
  try {
    // Try exact match first
    const exactTodo = store.getTodo(partialId);
    if (exactTodo) return partialId;

    // Try partial match (first 8 characters)
    const todos = store.listTodos({ limit: 500 });
    const matches = todos.filter((t) => t.id.startsWith(partialId));

    if (matches.length === 1) {
      return matches[0].id;
    }

    return null;
  } finally {
    store.close();
  }
}

/**
 * Format TODOs for text output
 */
export function formatTextOutput(
  todos: Todo[],
  options: { verbose?: boolean; quiet?: boolean } = {}
): string {
  if (todos.length === 0) {
    return options.quiet ? '' : 'No TODOs found.';
  }

  const groups = groupTodosByStatus(todos);
  const totalActive = groups.overdue.length + groups.active.length + groups.stale.length;
  const lines: string[] = [];

  if (!options.quiet) {
    lines.push(`\n=== TODO List (${totalActive} active, ${groups.snoozed.length} snoozed) ===\n`);
  }

  // Display overdue items first
  if (groups.overdue.length > 0) {
    lines.push('OVERDUE\n');
    for (const todo of groups.overdue) {
      lines.push(formatTodoForDisplay(todo, { verbose: options.verbose }));
      lines.push('');
    }
  }

  // Display stale items
  if (groups.stale.length > 0) {
    lines.push('STALE (no updates in 14+ days)\n');
    for (const todo of groups.stale) {
      lines.push(formatTodoForDisplay(todo, { verbose: options.verbose }));
      lines.push('');
    }
  }

  // Display active items
  if (groups.active.length > 0) {
    lines.push('ACTIVE\n');
    for (const todo of groups.active) {
      lines.push(formatTodoForDisplay(todo, { verbose: options.verbose }));
      lines.push('');
    }
  }

  // Display snoozed items
  if (groups.snoozed.length > 0) {
    lines.push('SNOOZED\n');
    for (const todo of groups.snoozed) {
      lines.push(formatTodoForDisplay(todo, { verbose: options.verbose }));
      lines.push('');
    }
  }

  // Summary
  if (!options.quiet) {
    lines.push('---');
    lines.push(
      `Total: ${totalActive} active | ${groups.snoozed.length} snoozed | ${groups.completed.length} completed`
    );
    if (groups.overdue.length > 0) {
      lines.push(`${groups.overdue.length} overdue item${groups.overdue.length !== 1 ? 's' : ''}`);
    }
    if (groups.stale.length > 0) {
      lines.push(`${groups.stale.length} stale item${groups.stale.length !== 1 ? 's' : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format TODOs for JSON output
 */
export function formatJsonOutput(todos: Todo[]): string {
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

  return JSON.stringify(output, null, 2);
}

/**
 * Get statistics for TODOs
 */
export function getTodoStats(): {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  stale: number;
  snoozed: number;
  bySource: Map<string, number>;
  byCategory: Map<string, number>;
  byPriority: Map<number, number>;
} {
  const store = new ContextStore(DB_PATH);
  try {
    const todos = store.listTodos({ limit: 1000 });
    const groups = groupTodosByStatus(todos);

    const bySource = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byPriority = new Map<number, number>();

    for (const todo of todos) {
      const source = todo.source || 'manual';
      bySource.set(source, (bySource.get(source) || 0) + 1);

      if (todo.category) {
        byCategory.set(todo.category, (byCategory.get(todo.category) || 0) + 1);
      }

      byPriority.set(todo.priority, (byPriority.get(todo.priority) || 0) + 1);
    }

    return {
      total: todos.length,
      active: groups.overdue.length + groups.active.length + groups.stale.length,
      completed: groups.completed.length,
      overdue: groups.overdue.length,
      stale: groups.stale.length,
      snoozed: groups.snoozed.length,
      bySource,
      byCategory,
      byPriority,
    };
  } finally {
    store.close();
  }
}
