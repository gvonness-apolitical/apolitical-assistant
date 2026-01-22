/**
 * Task Helper - TODO Selection
 *
 * Interactive TODO selection with filtering capabilities.
 */

import { ContextStore } from '@apolitical-assistant/context-store';
import {
  calculateEffectivePriority,
  formatTodoForDisplay,
  isStale,
  getDaysUntilDate,
} from '@apolitical-assistant/shared';
import type { Todo, TodoSource } from '@apolitical-assistant/shared';
import { DB_PATH } from './config.js';

/**
 * Options for selecting TODOs
 */
export interface SelectOptions {
  source?: TodoSource | TodoSource[];
  priority?: number[];
  status?: ('pending' | 'in_progress')[];
  search?: string;
  limit?: number;
  excludeSnoozed?: boolean;
  onlyStale?: boolean;
  orderBy?: 'priority' | 'due_date' | 'created_at' | 'updated_at';
}

/**
 * Grouped TODOs for display
 */
export interface GroupedTodos {
  overdue: Todo[];
  urgent: Todo[];    // P1
  high: Todo[];      // P2
  normal: Todo[];    // P3
  low: Todo[];       // P4-P5
  snoozed: Todo[];
  stale: Todo[];
}

/**
 * Get the list of selectable TODOs
 */
export function getSelectableTodos(options: SelectOptions = {}): Todo[] {
  const store = new ContextStore(DB_PATH);

  try {
    const queryOptions: Parameters<typeof store.listTodos>[0] = {
      status: options.status ?? ['pending', 'in_progress'],
      limit: options.limit ?? 100,
      orderBy: options.orderBy ?? 'priority',
      excludeSnoozed: options.excludeSnoozed ?? true,
    };

    if (options.source) {
      queryOptions.source = options.source;
    }

    if (options.onlyStale) {
      queryOptions.onlyStale = true;
    }

    let todos = store.listTodos(queryOptions);

    // Filter by priority if specified
    if (options.priority && options.priority.length > 0) {
      todos = todos.filter((todo) => {
        const effectivePriority = calculateEffectivePriority(todo);
        return options.priority!.includes(effectivePriority);
      });
    }

    // Filter by search text if specified
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      todos = todos.filter(
        (todo) =>
          todo.title.toLowerCase().includes(searchLower) ||
          (todo.description && todo.description.toLowerCase().includes(searchLower))
      );
    }

    // Sort by effective priority
    todos.sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b));

    return todos;
  } finally {
    store.close();
  }
}

/**
 * Get a single TODO by ID
 */
export function getTodoById(todoId: string): Todo | null {
  const store = new ContextStore(DB_PATH);

  try {
    return store.getTodo(todoId);
  } finally {
    store.close();
  }
}

/**
 * Group TODOs by status and priority
 */
export function groupTodos(todos: Todo[]): GroupedTodos {
  const now = new Date();
  const groups: GroupedTodos = {
    overdue: [],
    urgent: [],
    high: [],
    normal: [],
    low: [],
    snoozed: [],
    stale: [],
  };

  for (const todo of todos) {
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

    // Group by effective priority
    const effectivePriority = calculateEffectivePriority(todo);
    if (effectivePriority === 1) {
      groups.urgent.push(todo);
    } else if (effectivePriority === 2) {
      groups.high.push(todo);
    } else if (effectivePriority === 3) {
      groups.normal.push(todo);
    } else {
      groups.low.push(todo);
    }
  }

  // Sort each group by effective priority (for tie-breaking within groups)
  for (const key of Object.keys(groups) as (keyof GroupedTodos)[]) {
    groups[key].sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b));
  }

  return groups;
}

/**
 * Format a TODO for selection display (compact format)
 */
export function formatTodoForSelection(todo: Todo, index: number): string {
  const priority = calculateEffectivePriority(todo);
  const priorityIndicator = getPriorityIndicator(priority);
  const source = (todo.source ?? 'unknown').padEnd(12);

  // Truncate title if too long
  const maxTitleLength = 60;
  let title = todo.title;
  if (title.length > maxTitleLength) {
    title = title.substring(0, maxTitleLength - 3) + '...';
  }

  const indexStr = String(index + 1).padStart(2);
  return `  ${indexStr}. ${priorityIndicator} ${source} ${title}`;
}

/**
 * Get priority indicator
 */
function getPriorityIndicator(priority: number): string {
  switch (priority) {
    case 1:
      return '\u{1F534}'; // red circle
    case 2:
      return '\u{1F7E0}'; // orange circle
    case 3:
      return '\u{1F7E1}'; // yellow circle
    case 4:
      return '\u{1F7E2}'; // green circle
    default:
      return '\u{26AA}'; // white circle
  }
}

/**
 * Display grouped TODOs for selection
 */
export function displayGroupedTodos(groups: GroupedTodos, options: { quiet?: boolean } = {}): void {
  const total =
    groups.overdue.length +
    groups.urgent.length +
    groups.high.length +
    groups.normal.length +
    groups.low.length +
    groups.stale.length;

  if (!options.quiet) {
    console.log(`\n=== Select a TODO (${total} items) ===\n`);
  }

  let index = 0;

  if (groups.overdue.length > 0) {
    console.log('\u{1F6A8} OVERDUE');
    for (const todo of groups.overdue) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }

  if (groups.urgent.length > 0) {
    console.log('\u{1F534} URGENT (P1)');
    for (const todo of groups.urgent) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }

  if (groups.high.length > 0) {
    console.log('\u{1F7E0} HIGH (P2)');
    for (const todo of groups.high) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }

  if (groups.normal.length > 0) {
    console.log('\u{1F7E1} NORMAL (P3)');
    for (const todo of groups.normal) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }

  if (groups.low.length > 0) {
    console.log('\u{1F7E2} LOW (P4-P5)');
    for (const todo of groups.low) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }

  if (groups.stale.length > 0) {
    console.log('\u{26A0}\u{FE0F}  STALE');
    for (const todo of groups.stale) {
      console.log(formatTodoForSelection(todo, index++));
    }
    console.log();
  }
}

/**
 * Get a flat list of TODOs in display order
 */
export function getFlatTodoList(groups: GroupedTodos): Todo[] {
  return [
    ...groups.overdue,
    ...groups.urgent,
    ...groups.high,
    ...groups.normal,
    ...groups.low,
    ...groups.stale,
  ];
}

/**
 * Display TODOs as JSON
 */
export function displayTodosJson(todos: Todo[]): void {
  const groups = groupTodos(todos);
  const output = {
    summary: {
      total: todos.length,
      overdue: groups.overdue.length,
      urgent: groups.urgent.length,
      high: groups.high.length,
      normal: groups.normal.length,
      low: groups.low.length,
      stale: groups.stale.length,
      snoozed: groups.snoozed.length,
    },
    todos: todos.map((todo) => ({
      ...todo,
      effectivePriority: calculateEffectivePriority(todo),
      isStale: isStale(todo),
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Display detailed TODO information
 */
export function displayTodoDetails(todo: Todo): void {
  console.log('\n' + '='.repeat(60));
  console.log(formatTodoForDisplay(todo, { verbose: true }));
  console.log('='.repeat(60));
}
