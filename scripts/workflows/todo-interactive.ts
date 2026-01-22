#!/usr/bin/env npx tsx

/**
 * TODO Interactive Mode
 *
 * Interactive terminal UI for managing TODOs.
 *
 * Usage:
 *   npm run todos:interactive
 */

import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';
import { ContextStore } from '@apolitical-assistant/context-store';
import type { Todo } from '@apolitical-assistant/shared';
import {
  calculateEffectivePriority,
  getPriorityIndicator,
  getStatusIndicator,
  formatDate,
  addDays,
  DB_PATH,
} from '@apolitical-assistant/shared';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function clearScreen(): void {
  process.stdout.write('\x1B[2J\x1B[0f');
}

function formatTodoLine(todo: Todo, index: number): string {
  const priority = calculateEffectivePriority(todo);
  const indicator = getPriorityIndicator(priority);
  const statusIndicator = getStatusIndicator(todo);

  let info = '';
  const targetDate = todo.deadline || todo.dueDate;
  if (targetDate) {
    const days = Math.ceil(
      (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days < 0) info = ' (OVERDUE)';
    else if (days === 0) info = ' (Today)';
    else if (days === 1) info = ' (Tomorrow)';
  }

  if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) {
    info = ` (Snoozed until ${formatDate(todo.snoozedUntil)})`;
  }

  return `  ${index}. ${statusIndicator} ${indicator} ${todo.title.slice(0, 60)}${info}`;
}

async function displayTodos(store: ContextStore): Promise<Todo[]> {
  const todos = store.listTodos({
    status: ['pending', 'in_progress'],
    limit: 20,
  });

  // Sort by effective priority
  todos.sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b));

  console.log('\n=== Interactive TODO Manager ===\n');

  if (todos.length === 0) {
    console.log('  No active TODOs.\n');
    return [];
  }

  for (let i = 0; i < todos.length; i++) {
    console.log(formatTodoLine(todos[i], i + 1));
  }

  console.log();

  return todos;
}

async function handleTodoAction(store: ContextStore, todo: Todo): Promise<void> {
  console.log(`\nSelected: ${todo.title}\n`);
  console.log(`  [c]omplete    [s]nooze    [o]pen link    [d]elete    [b]ack\n`);

  const action = await prompt('> ');

  switch (action.toLowerCase()) {
    case 'c': {
      store.completeTodo(todo.id);
      console.log(`\u{2705} Marked complete: ${todo.title}`);
      await sleep(1000);
      break;
    }

    case 's': {
      console.log('\nSnooze for:');
      console.log('  [1] 1 day');
      console.log('  [3] 3 days');
      console.log('  [7] 1 week');
      console.log('  [m] Next Monday');
      console.log('  [d] Custom date');
      console.log();

      const snoozeChoice = await prompt('> ');

      let snoozeDate: string | null = null;

      switch (snoozeChoice.toLowerCase()) {
        case '1':
          snoozeDate = addDays(1);
          break;
        case '3':
          snoozeDate = addDays(3);
          break;
        case '7':
          snoozeDate = addDays(7);
          break;
        case 'm': {
          // Calculate next Monday
          const now = new Date();
          const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
          snoozeDate = addDays(daysUntilMonday);
          break;
        }
        case 'd': {
          const dateInput = await prompt('Enter date (YYYY-MM-DD): ');
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            snoozeDate = dateInput;
          } else {
            console.log('Invalid date format');
          }
          break;
        }
      }

      if (snoozeDate) {
        store.snoozeTodo(todo.id, snoozeDate);
        console.log(`\u{1F4A4} Snoozed until ${formatDate(snoozeDate)}`);
        await sleep(1000);
      }
      break;
    }

    case 'o': {
      if (todo.sourceUrl) {
        console.log(`Opening: ${todo.sourceUrl}`);
        try {
          execSync(`open "${todo.sourceUrl}"`, { stdio: 'ignore' });
        } catch {
          console.log('Failed to open URL');
        }
        await sleep(500);
      } else {
        console.log('No source URL available');
        await sleep(1000);
      }
      break;
    }

    case 'd': {
      const confirm = await prompt('Are you sure? (y/n): ');
      if (confirm.toLowerCase() === 'y') {
        store.deleteTodo(todo.id);
        console.log('\u{1F5D1}\u{FE0F}  Deleted');
        await sleep(1000);
      }
      break;
    }

    case 'b':
    default:
      break;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const store = new ContextStore(DB_PATH);

  try {
    let running = true;

    while (running) {
      clearScreen();
      const todos = await displayTodos(store);

      console.log('Select TODO (1-20), or:');
      console.log('  [c]ollect new TODOs');
      console.log('  [a]rchive completed');
      console.log('  [r]efresh');
      console.log('  [q]uit\n');

      const input = await prompt('> ');

      const num = parseInt(input, 10);

      if (!isNaN(num) && num >= 1 && num <= todos.length) {
        const selected = todos[num - 1];
        await handleTodoAction(store, selected);
      } else {
        switch (input.toLowerCase()) {
          case 'c':
            console.log('\nCollecting TODOs...');
            try {
              execSync('npm run todos:collect', {
                cwd: PROJECT_ROOT,
                stdio: 'inherit',
              });
            } catch {
              console.log('Collection failed');
            }
            await sleep(2000);
            break;

          case 'a':
            console.log('\nArchiving completed TODOs...');
            try {
              execSync('npm run todos:archive', {
                cwd: PROJECT_ROOT,
                stdio: 'inherit',
              });
            } catch {
              console.log('Archive failed');
            }
            await sleep(2000);
            break;

          case 'r':
            // Just refresh the display
            break;

          case 'q':
            running = false;
            break;
        }
      }
    }
  } finally {
    store.close();
    rl.close();
  }

  console.log('\nGoodbye!');
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  rl.close();
  process.exit(1);
});
