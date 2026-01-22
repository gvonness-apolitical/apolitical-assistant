/**
 * Test Factories
 *
 * Factory functions for creating test fixtures with sensible defaults.
 */

import type { Todo, Meeting, CommunicationLog, BriefingData } from '../types.js';

let counter = 0;

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

/**
 * Create a test TODO with sensible defaults
 */
export function createTestTodo(overrides?: Partial<Todo>): Todo {
  const now = new Date().toISOString();
  return {
    id: uniqueId('todo'),
    title: 'Test TODO',
    description: undefined,
    priority: 3,
    basePriority: 3,
    urgency: 3,
    requestDate: undefined,
    dueDate: undefined,
    deadline: undefined,
    source: 'manual',
    sourceId: undefined,
    sourceUrl: undefined,
    sourceUrls: undefined,
    status: 'pending',
    snoozedUntil: undefined,
    staleNotifiedAt: undefined,
    fingerprint: undefined,
    tags: undefined,
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
    archivedAt: undefined,
    summaryId: undefined,
    summaryPeriod: undefined,
    summaryItemId: undefined,
    category: undefined,
    ...overrides,
  };
}

/**
 * Create a test Meeting with sensible defaults
 */
export function createTestMeeting(overrides?: Partial<Meeting>): Meeting {
  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour from now
  const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now

  return {
    id: uniqueId('meeting'),
    calendarEventId: undefined,
    title: 'Test Meeting',
    startTime,
    endTime,
    attendees: undefined,
    talkingPoints: undefined,
    contextNotes: undefined,
    transcriptPath: undefined,
    createdAt: now.toISOString(),
    ...overrides,
  };
}

/**
 * Create a test CommunicationLog with sensible defaults
 */
export function createTestCommunicationLog(overrides?: Partial<CommunicationLog>): CommunicationLog {
  return {
    id: uniqueId('log'),
    channel: 'email',
    summary: 'Test communication log',
    importance: 3,
    actionRequired: false,
    loggedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test BriefingData with sensible defaults
 */
export function createTestBriefingData(overrides?: Partial<BriefingData>): BriefingData {
  return {
    date: new Date().toISOString().split('T')[0]!,
    calendar: {
      meetings: [],
      focusTimeBlocks: 2,
    },
    communications: {
      urgentEmails: 0,
      slackMentions: 0,
      prReviewsNeeded: 0,
    },
    todos: [],
    incidents: {
      active: 0,
      recentlyResolved: 0,
    },
    teamUpdates: {
      outOfOffice: [],
      newHires: [],
    },
    ...overrides,
  };
}

/**
 * Create a batch of test TODOs
 */
export function createTestTodos(count: number, overrides?: Partial<Todo>): Todo[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTodo({
      title: `Test TODO ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create a TODO that is overdue
 */
export function createOverdueTodo(overrides?: Partial<Todo>): Todo {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return createTestTodo({
    dueDate: yesterday.toISOString().split('T')[0],
    ...overrides,
  });
}

/**
 * Create a TODO due today
 */
export function createTodoDueToday(overrides?: Partial<Todo>): Todo {
  const today = new Date().toISOString().split('T')[0];
  return createTestTodo({
    dueDate: today,
    ...overrides,
  });
}

/**
 * Create a high priority TODO
 */
export function createHighPriorityTodo(overrides?: Partial<Todo>): Todo {
  return createTestTodo({
    priority: 1,
    basePriority: 1,
    urgency: 1,
    ...overrides,
  });
}

/**
 * Create a snoozed TODO
 */
export function createSnoozedTodo(overrides?: Partial<Todo>): Todo {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return createTestTodo({
    snoozedUntil: tomorrow.toISOString(),
    ...overrides,
  });
}

/**
 * Create a stale TODO (not updated for a while)
 */
export function createStaleTodo(staleDays: number = 14, overrides?: Partial<Todo>): Todo {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays - 1);
  return createTestTodo({
    updatedAt: staleDate.toISOString(),
    ...overrides,
  });
}

/**
 * Create a completed TODO
 */
export function createCompletedTodo(overrides?: Partial<Todo>): Todo {
  const now = new Date().toISOString();
  return createTestTodo({
    status: 'completed',
    completedAt: now,
    ...overrides,
  });
}

/**
 * Create an archived TODO
 */
export function createArchivedTodo(overrides?: Partial<Todo>): Todo {
  const now = new Date().toISOString();
  return createTestTodo({
    status: 'archived',
    archivedAt: now,
    ...overrides,
  });
}
