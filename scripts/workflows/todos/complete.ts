/**
 * TODO Completion
 *
 * Mark TODOs as complete or reopen them.
 */

import { ContextStore } from '@apolitical-assistant/context-store';
import { DB_PATH } from './config.js';

/**
 * Result of a completion operation
 */
export interface CompletionResult {
  success: boolean;
  todoId: string;
  title: string;
  action: 'completed' | 'reopened';
  error?: string;
}

/**
 * Mark a TODO as complete
 */
export function completeTodo(idOrPartial: string): CompletionResult {
  const store = new ContextStore(DB_PATH);
  try {
    const fullId = findTodoByPartialIdInternal(store, idOrPartial);

    if (!fullId) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'completed',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'completed',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const updated = store.completeTodo(fullId);

    if (updated) {
      return {
        success: true,
        todoId: fullId,
        title: todo.title,
        action: 'completed',
      };
    } else {
      return {
        success: false,
        todoId: fullId,
        title: todo.title,
        action: 'completed',
        error: 'Failed to complete TODO',
      };
    }
  } finally {
    store.close();
  }
}

/**
 * Reopen a completed TODO (mark as pending)
 */
export function reopenTodo(idOrPartial: string): CompletionResult {
  const store = new ContextStore(DB_PATH);
  try {
    const fullId = findTodoByPartialIdInternal(store, idOrPartial);

    if (!fullId) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'reopened',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'reopened',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const updated = store.updateTodo(fullId, {
      status: 'pending',
      completedAt: undefined,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      return {
        success: true,
        todoId: fullId,
        title: todo.title,
        action: 'reopened',
      };
    } else {
      return {
        success: false,
        todoId: fullId,
        title: todo.title,
        action: 'reopened',
        error: 'Failed to reopen TODO',
      };
    }
  } finally {
    store.close();
  }
}

/**
 * Mark multiple TODOs as complete
 */
export function completeTodos(idsOrPartials: string[]): CompletionResult[] {
  return idsOrPartials.map((id) => completeTodo(id));
}

/**
 * Reopen multiple TODOs
 */
export function reopenTodos(idsOrPartials: string[]): CompletionResult[] {
  return idsOrPartials.map((id) => reopenTodo(id));
}

/**
 * Set TODO status to in_progress
 */
export function startTodo(idOrPartial: string): CompletionResult {
  const store = new ContextStore(DB_PATH);
  try {
    const fullId = findTodoByPartialIdInternal(store, idOrPartial);

    if (!fullId) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'completed', // Reusing the type
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const todo = store.getTodo(fullId);
    if (!todo) {
      return {
        success: false,
        todoId: idOrPartial,
        title: '',
        action: 'completed',
        error: `TODO not found: ${idOrPartial}`,
      };
    }

    const updated = store.updateTodo(fullId, {
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      return {
        success: true,
        todoId: fullId,
        title: todo.title,
        action: 'completed', // Using as "started"
      };
    } else {
      return {
        success: false,
        todoId: fullId,
        title: todo.title,
        action: 'completed',
        error: 'Failed to start TODO',
      };
    }
  } finally {
    store.close();
  }
}

/**
 * Internal helper to find TODO by partial ID
 */
function findTodoByPartialIdInternal(store: ContextStore, partialId: string): string | null {
  // Try exact match first
  const exactTodo = store.getTodo(partialId);
  if (exactTodo) return partialId;

  // Try partial match
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
