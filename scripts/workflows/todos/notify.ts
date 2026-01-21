/**
 * TODO Notifications
 *
 * Send notifications for approaching deadlines and stale items.
 */

import { ContextStore } from '@apolitical-assistant/context-store';
import {
  sendNotification,
  getDaysUntilDate,
  formatDate,
} from '@apolitical-assistant/shared';
import { DB_PATH, loadTodoConfig } from './config.js';
import { autoUnsnooze } from './snooze.js';

/**
 * Notification result
 */
export interface NotificationResult {
  sentCount: number;
  notifications: Array<{
    todoId: string;
    title: string;
    type: 'tomorrow' | 'today' | 'overdue' | 'stale';
  }>;
  unsnoozed: string[];
  errors: string[];
}

/**
 * Check and send notifications for TODOs
 */
export async function checkAndNotify(options: { quiet?: boolean } = {}): Promise<NotificationResult> {
  const config = loadTodoConfig();
  const result: NotificationResult = {
    sentCount: 0,
    notifications: [],
    unsnoozed: [],
    errors: [],
  };

  // First, auto-unsnooze any expired snoozes
  const unsnoozeResult = autoUnsnooze();
  result.unsnoozed = unsnoozeResult.unsnoozed;
  result.errors.push(...unsnoozeResult.errors);

  const store = new ContextStore(DB_PATH);
  try {
    const todos = store.listTodos({
      status: ['pending', 'in_progress'],
      excludeSnoozed: true,
    });

    for (const todo of todos) {
      const targetDate = todo.deadline || todo.dueDate;
      if (!targetDate) continue;

      const daysUntil = getDaysUntilDate(targetDate);

      // Day before notification
      if (daysUntil === 1 && config.notifications.dayBefore) {
        try {
          await sendNotification(
            'TODO Due Tomorrow',
            todo.title,
            todo.sourceUrl
          );
          result.notifications.push({
            todoId: todo.id,
            title: todo.title,
            type: 'tomorrow',
          });
          result.sentCount++;
          if (!options.quiet) {
            console.log(`  Notified: "${todo.title}" due tomorrow`);
          }
        } catch (error) {
          result.errors.push(`Failed to notify for ${todo.id}: ${error}`);
        }
      }

      // Day of notification
      if (daysUntil === 0 && config.notifications.dayOf) {
        try {
          await sendNotification(
            'TODO Due Today',
            todo.title,
            todo.sourceUrl
          );
          result.notifications.push({
            todoId: todo.id,
            title: todo.title,
            type: 'today',
          });
          result.sentCount++;
          if (!options.quiet) {
            console.log(`  Notified: "${todo.title}" due today`);
          }
        } catch (error) {
          result.errors.push(`Failed to notify for ${todo.id}: ${error}`);
        }
      }

      // Overdue notification
      if (daysUntil < 0 && config.notifications.overdue) {
        try {
          await sendNotification(
            'TODO Overdue',
            `${todo.title} (was due ${formatDate(targetDate)})`,
            todo.sourceUrl
          );
          result.notifications.push({
            todoId: todo.id,
            title: todo.title,
            type: 'overdue',
          });
          result.sentCount++;
          if (!options.quiet) {
            console.log(`  Notified: "${todo.title}" overdue`);
          }
        } catch (error) {
          result.errors.push(`Failed to notify for ${todo.id}: ${error}`);
        }
      }
    }

    // Check for stale todos
    const staleTodos = store.getStaleTodos(config.staleDays);
    for (const todo of staleTodos.slice(0, 3)) {
      // Limit stale notifications
      // Only notify if we haven't notified about this one recently
      if (
        !todo.staleNotifiedAt ||
        Date.now() - new Date(todo.staleNotifiedAt).getTime() > 7 * 24 * 60 * 60 * 1000
      ) {
        try {
          await sendNotification(
            'Stale TODO',
            `"${todo.title}" hasn't been updated in ${config.staleDays}+ days`,
            todo.sourceUrl
          );

          store.updateTodo(todo.id, {
            staleNotifiedAt: new Date().toISOString(),
          });

          result.notifications.push({
            todoId: todo.id,
            title: todo.title,
            type: 'stale',
          });
          result.sentCount++;
          if (!options.quiet) {
            console.log(`  Notified: "${todo.title}" is stale`);
          }
        } catch (error) {
          result.errors.push(`Failed to notify for ${todo.id}: ${error}`);
        }
      }
    }

    return result;
  } finally {
    store.close();
  }
}

/**
 * Get upcoming deadlines
 */
export function getUpcomingDeadlines(withinDays: number = 7): Array<{
  todo: { id: string; title: string; sourceUrl?: string };
  daysUntil: number;
  deadline: string;
}> {
  const store = new ContextStore(DB_PATH);
  try {
    const todos = store.listTodos({
      status: ['pending', 'in_progress'],
      excludeSnoozed: true,
    });

    const upcoming: Array<{
      todo: { id: string; title: string; sourceUrl?: string };
      daysUntil: number;
      deadline: string;
    }> = [];

    for (const todo of todos) {
      const targetDate = todo.deadline || todo.dueDate;
      if (!targetDate) continue;

      const daysUntil = getDaysUntilDate(targetDate);
      if (daysUntil >= 0 && daysUntil <= withinDays) {
        upcoming.push({
          todo: { id: todo.id, title: todo.title, sourceUrl: todo.sourceUrl },
          daysUntil,
          deadline: targetDate,
        });
      }
    }

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  } finally {
    store.close();
  }
}

/**
 * Get overdue TODOs
 */
export function getOverdueTodos() {
  const store = new ContextStore(DB_PATH);
  try {
    const todos = store.listTodos({
      status: ['pending', 'in_progress'],
      excludeSnoozed: true,
    });

    return todos.filter((todo) => {
      const targetDate = todo.deadline || todo.dueDate;
      if (!targetDate) return false;
      return getDaysUntilDate(targetDate) < 0;
    });
  } finally {
    store.close();
  }
}

/**
 * Get stale TODOs
 */
export function getStaleTodos() {
  const config = loadTodoConfig();
  const store = new ContextStore(DB_PATH);
  try {
    return store.getStaleTodos(config.staleDays);
  } finally {
    store.close();
  }
}
