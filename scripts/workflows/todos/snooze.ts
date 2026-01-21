/**
 * TODO Snooze
 *
 * Snooze and unsnooze TODOs.
 */

import { ContextStore } from '@apolitical-assistant/context-store';
import { addDays } from '@apolitical-assistant/shared';
import { DB_PATH } from './config.js';

/**
 * Result of a snooze operation
 */
export interface SnoozeResult {
  success: boolean;
  todoId: string;
  title: string;
  snoozeUntil?: string;
  error?: string;
}

/**
 * Find TODO by partial ID
 */
function findTodoByPartialIdInternal(store: ContextStore, partialId: string): string | null {
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

/**
 * Snooze a TODO until a specific date
 */
export function snoozeTodoUntil(idOrPartial: string, untilDate: string): SnoozeResult {
  const store = new ContextStore(DB_PATH);
  try {
    const fullId = findTodoByPartialIdInternal(store, idOrPartial);

    if (!fullId) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const updated = store.snoozeTodo(fullId, untilDate);

    if (updated) {
      return {
        success: true,
        todoId: fullId,
        title: todo.title,
        snoozeUntil: untilDate,
      };
    } else {
      return {
        success: false,
        todoId: fullId,
        title: todo.title,
        error: 'Failed to snooze TODO',
      };
    }
  } finally {
    store.close();
  }
}

/**
 * Snooze a TODO for a number of days
 */
export function snoozeTodoForDays(idOrPartial: string, days: number): SnoozeResult {
  const untilDate = addDays(days);
  return snoozeTodoUntil(idOrPartial, untilDate);
}

/**
 * Snooze shortcuts
 */
export function snoozeTodoUntilTomorrow(idOrPartial: string): SnoozeResult {
  return snoozeTodoForDays(idOrPartial, 1);
}

export function snoozeTodoUntilNextWeek(idOrPartial: string): SnoozeResult {
  return snoozeTodoForDays(idOrPartial, 7);
}

export function snoozeTodoUntilNextMonth(idOrPartial: string): SnoozeResult {
  return snoozeTodoForDays(idOrPartial, 30);
}

/**
 * Unsnooze a TODO
 */
export function unsnoozeTodo(idOrPartial: string): SnoozeResult {
  const store = new ContextStore(DB_PATH);
  try {
    const fullId = findTodoByPartialIdInternal(store, idOrPartial);

    if (!fullId) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const updated = store.unsnoozeTodo(fullId);

    if (updated) {
      return {
        success: true,
        todoId: fullId,
        title: todo.title,
      };
    } else {
      return {
        success: false,
        todoId: fullId,
        title: todo.title,
        error: 'Failed to unsnooze TODO',
      };
    }
  } finally {
    store.close();
  }
}

/**
 * Get all snoozed TODOs
 */
export function getSnoozedTodos() {
  const store = new ContextStore(DB_PATH);
  try {
    return store.listTodos({
      status: ['pending', 'in_progress'],
      onlySnoozed: true,
      limit: 100,
    });
  } finally {
    store.close();
  }
}

/**
 * Get TODOs with snooze expiring soon (within N days)
 */
export function getTodosWithSnoozeExpiringSoon(withinDays: number = 1) {
  const snoozed = getSnoozedTodos();
  const now = new Date();
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  return snoozed.filter((todo) => {
    if (!todo.snoozedUntil) return false;
    const snoozeDate = new Date(todo.snoozedUntil);
    return snoozeDate <= threshold;
  });
}

/**
 * Auto-unsnooze TODOs where snooze period has passed
 */
export function autoUnsnooze(): { unsnoozed: string[]; errors: string[] } {
  const store = new ContextStore(DB_PATH);
  const result = { unsnoozed: [] as string[], errors: [] as string[] };

  try {
    const snoozed = store.listTodos({
      status: ['pending', 'in_progress'],
      onlySnoozed: true,
      limit: 100,
    });

    const now = new Date();

    for (const todo of snoozed) {
      if (!todo.snoozedUntil) continue;

      const snoozeDate = new Date(todo.snoozedUntil);
      if (snoozeDate <= now) {
        const success = store.unsnoozeTodo(todo.id);
        if (success) {
          result.unsnoozed.push(todo.id);
        } else {
          result.errors.push(`Failed to unsnooze: ${todo.id}`);
        }
      }
    }

    return result;
  } finally {
    store.close();
  }
}
