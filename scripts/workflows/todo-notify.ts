#!/usr/bin/env npx tsx

/**
 * TODO Notification Script
 *
 * Sends macOS notifications for approaching deadlines.
 * Designed to run via cron/launchd.
 *
 * Usage:
 *   npm run todos:notify              # Check and send notifications
 *   npm run todos:notify -- --quiet   # Silent mode (for cron)
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContextStore } from '@apolitical-assistant/context-store';
import { sendNotification } from '@apolitical-assistant/shared';
import {
  getDaysUntilDate,
  formatDate,
} from '@apolitical-assistant/shared';
import { loadTodoConfig } from './collectors/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');

interface NotifyOptions {
  quiet: boolean;
}

function parseArgs(): NotifyOptions {
  const args = process.argv.slice(2);
  return {
    quiet: args.includes('--quiet'),
  };
}

function log(message: string, options: NotifyOptions): void {
  if (!options.quiet) {
    console.log(message);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const config = loadTodoConfig();

  log('Checking for deadline notifications...', options);

  const store = new ContextStore(DB_PATH);

  try {
    const todos = store.listTodos({
      status: ['pending', 'in_progress'],
      excludeSnoozed: true,
    });

    let notificationCount = 0;

    for (const todo of todos) {
      const targetDate = todo.deadline || todo.dueDate;
      if (!targetDate) continue;

      const daysUntil = getDaysUntilDate(targetDate);

      // Day before notification
      if (daysUntil === 1 && config.notifications.dayBefore) {
        await sendNotification(
          'TODO Due Tomorrow',
          todo.title,
          todo.sourceUrl
        );
        log(`  Notified: "${todo.title}" due tomorrow`, options);
        notificationCount++;
      }

      // Day of notification
      if (daysUntil === 0 && config.notifications.dayOf) {
        await sendNotification(
          'TODO Due Today',
          todo.title,
          todo.sourceUrl
        );
        log(`  Notified: "${todo.title}" due today`, options);
        notificationCount++;
      }

      // Overdue notification
      if (daysUntil < 0 && config.notifications.overdue) {
        await sendNotification(
          'TODO Overdue',
          `${todo.title} (was due ${formatDate(targetDate)})`,
          todo.sourceUrl
        );
        log(`  Notified: "${todo.title}" overdue`, options);
        notificationCount++;
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
        await sendNotification(
          'Stale TODO',
          `"${todo.title}" hasn't been updated in ${config.staleDays}+ days`,
          todo.sourceUrl
        );

        store.updateTodo(todo.id, {
          staleNotifiedAt: new Date().toISOString(),
        });

        log(`  Notified: "${todo.title}" is stale`, options);
        notificationCount++;
      }
    }

    log(`\nSent ${notificationCount} notification(s)`, options);
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
