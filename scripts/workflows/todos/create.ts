/**
 * TODO Creation
 *
 * Create TODOs from various sources including summaries.
 */

import { randomUUID } from 'node:crypto';
import type { Todo, TodoCategory } from '@apolitical-assistant/shared';
import { ContextStore } from '@apolitical-assistant/context-store';
import { DB_PATH, loadTodoConfig } from './config.js';
import type { CreateFromSummaryOptions } from './types.js';

/**
 * Priority mapping from P0-P3 to numeric priority (1-4)
 */
const PRIORITY_MAP: Record<string, number> = {
  P0: 1,
  P1: 2,
  P2: 3,
  P3: 4,
};

/**
 * Create a TODO from a summary action item
 */
export function createTodoFromSummary(
  options: CreateFromSummaryOptions,
  store?: ContextStore
): Todo {
  const config = loadTodoConfig();

  // Skip if auto-create is disabled
  if (!config.autoCreateFromSummaries) {
    throw new Error('Auto-create from summaries is disabled in config');
  }

  const now = new Date().toISOString();
  const priority = PRIORITY_MAP[options.priority] || 3;

  const todo: Todo = {
    id: randomUUID(),
    title: options.title,
    description: options.description,
    priority,
    basePriority: priority,
    urgency: priority, // Default urgency to same as priority
    source: 'summary',
    sourceId: options.itemId,
    sourceUrl: options.sourceUrl,
    sourceUrls: options.sourceUrls,
    status: 'pending',
    category: options.category,
    dueDate: options.dueDate,
    createdAt: now,
    updatedAt: now,
    summaryId: options.summaryId,
    summaryPeriod: options.summaryPeriod,
    summaryItemId: options.itemId,
  };

  // If store is provided, persist the todo
  if (store) {
    // Check if already exists
    const existing = store.getTodoBySourceId('summary', options.itemId);
    if (existing) {
      // Update existing instead of creating new
      store.updateTodo(existing.id, {
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        category: todo.category,
        updatedAt: now,
      });
      return { ...existing, ...todo, id: existing.id };
    }

    store.createTodo(todo);
  }

  return todo;
}

/**
 * Create multiple TODOs from summary action items
 */
export function createTodosFromSummary(
  items: CreateFromSummaryOptions[],
  store?: ContextStore
): { created: Todo[]; updated: Todo[]; skipped: Todo[] } {
  const shouldCloseStore = !store;
  const actualStore = store || new ContextStore(DB_PATH);

  try {
    const created: Todo[] = [];
    const updated: Todo[] = [];
    const skipped: Todo[] = [];

    for (const item of items) {
      // Check if already exists
      const existing = actualStore.getTodoBySourceId('summary', item.itemId);

      if (existing) {
        // Check if the existing todo is already completed
        if (existing.status === 'completed' || existing.status === 'archived') {
          skipped.push(existing);
          continue;
        }

        // Update existing
        const now = new Date().toISOString();
        actualStore.updateTodo(existing.id, {
          title: item.title,
          description: item.description,
          priority: PRIORITY_MAP[item.priority] || 3,
          category: item.category,
          updatedAt: now,
        });
        updated.push({ ...existing, title: item.title });
      } else {
        // Create new
        const todo = createTodoFromSummary(item, actualStore);
        created.push(todo);
      }
    }

    return { created, updated, skipped };
  } finally {
    if (shouldCloseStore) {
      actualStore.close();
    }
  }
}

/**
 * Create a manual TODO
 */
export function createManualTodo(options: {
  title: string;
  description?: string;
  priority?: number;
  category?: TodoCategory;
  dueDate?: string;
  deadline?: string;
  tags?: string[];
}): Todo {
  const now = new Date().toISOString();
  const priority = options.priority || 3;

  const todo: Todo = {
    id: randomUUID(),
    title: options.title,
    description: options.description,
    priority,
    basePriority: priority,
    urgency: 3,
    source: 'manual',
    status: 'pending',
    category: options.category,
    dueDate: options.dueDate,
    deadline: options.deadline,
    tags: options.tags,
    createdAt: now,
    updatedAt: now,
  };

  const store = new ContextStore(DB_PATH);
  try {
    store.createTodo(todo);
    return todo;
  } finally {
    store.close();
  }
}

/**
 * Link an existing TODO to a summary
 */
export function linkTodoToSummary(
  todoId: string,
  summaryId: string,
  summaryPeriod: string,
  summaryItemId: string
): boolean {
  const store = new ContextStore(DB_PATH);
  try {
    const todo = store.getTodo(todoId);
    if (!todo) {
      return false;
    }

    store.updateTodo(todoId, {
      summaryId,
      summaryPeriod,
      summaryItemId,
      updatedAt: new Date().toISOString(),
    });

    return true;
  } finally {
    store.close();
  }
}

/**
 * Get TODOs linked to a specific summary
 */
export function getTodosForSummary(summaryId: string): Todo[] {
  const store = new ContextStore(DB_PATH);
  try {
    // Note: This requires a custom query method in ContextStore
    // For now, we'll filter in memory
    const allTodos = store.listTodos({ limit: 1000 });
    return allTodos.filter((t) => t.summaryId === summaryId);
  } finally {
    store.close();
  }
}

/**
 * Get TODOs linked to a specific summary period
 */
export function getTodosForSummaryPeriod(summaryPeriod: string): Todo[] {
  const store = new ContextStore(DB_PATH);
  try {
    const allTodos = store.listTodos({ limit: 1000 });
    return allTodos.filter((t) => t.summaryPeriod === summaryPeriod);
  } finally {
    store.close();
  }
}

/**
 * Get summary progress for a period (for inclusion in summaries)
 */
export function getSummaryTodoProgress(summaryPeriod: string): {
  created: number;
  completed: number;
  pending: number;
  todoIds: string[];
} {
  const store = new ContextStore(DB_PATH);
  try {
    const todos = store.listTodos({ limit: 1000 });
    const periodTodos = todos.filter((t) => t.summaryPeriod === summaryPeriod);

    const completed = periodTodos.filter((t) => t.status === 'completed').length;
    const pending = periodTodos.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;

    return {
      created: periodTodos.length,
      completed,
      pending,
      todoIds: periodTodos.map((t) => t.id),
    };
  } finally {
    store.close();
  }
}
