/**
 * Models Transformation Tests
 *
 * Tests for row-to-model and model-to-row conversion functions.
 * These are pure transformation functions with no external dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  todoRowToTodo,
  todoToRow,
  meetingRowToMeeting,
  meetingToRow,
  communicationLogRowToLog,
  logToRow,
  briefingRowToBriefing,
  summaryRowToSummary,
  summaryToRow,
  summaryTodoRowToLink,
  type TodoRow,
  type MeetingRow,
  type CommunicationLogRow,
  type BriefingRow,
  type SummaryRow,
  type SummaryTodoRow,
  type StoredSummary,
} from '../models.js';

// ==================== todoRowToTodo ====================

describe('todoRowToTodo', () => {
  it('converts a minimal todo row with required fields only', () => {
    const row: TodoRow = {
      id: 'todo-1',
      title: 'Test Todo',
      description: null,
      priority: 3,
      base_priority: null,
      urgency: null,
      request_date: null,
      due_date: null,
      deadline: null,
      source: null,
      source_id: null,
      source_url: null,
      source_urls: null,
      status: 'pending',
      snoozed_until: null,
      stale_notified_at: null,
      fingerprint: null,
      tags: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      completed_at: null,
      archived_at: null,
      summary_id: null,
      summary_period: null,
      summary_item_id: null,
      category: null,
    };

    const todo = todoRowToTodo(row);

    expect(todo.id).toBe('todo-1');
    expect(todo.title).toBe('Test Todo');
    expect(todo.priority).toBe(3);
    expect(todo.basePriority).toBe(3); // defaults to priority when null
    expect(todo.urgency).toBe(3); // defaults to 3 when null
    expect(todo.status).toBe('pending');
    expect(todo.description).toBeUndefined();
    expect(todo.source).toBeUndefined();
    expect(todo.tags).toBeUndefined();
  });

  it('converts a fully populated todo row', () => {
    const row: TodoRow = {
      id: 'todo-2',
      title: 'Full Todo',
      description: 'A detailed description',
      priority: 1,
      base_priority: 2,
      urgency: 1,
      request_date: '2024-01-01',
      due_date: '2024-01-15',
      deadline: '2024-01-20',
      source: 'linear',
      source_id: 'LIN-123',
      source_url: 'https://linear.app/issue/LIN-123',
      source_urls: '["https://linear.app/issue/LIN-123", "https://github.com/pr/456"]',
      status: 'in_progress',
      snoozed_until: '2024-01-10T00:00:00Z',
      stale_notified_at: '2024-01-05T00:00:00Z',
      fingerprint: 'abc123',
      tags: '["urgent", "bug"]',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      completed_at: null,
      archived_at: null,
      summary_id: 'summary-1',
      summary_period: '2024-W01',
      summary_item_id: 'item-1',
      category: 'engineering',
    };

    const todo = todoRowToTodo(row);

    expect(todo.id).toBe('todo-2');
    expect(todo.title).toBe('Full Todo');
    expect(todo.description).toBe('A detailed description');
    expect(todo.priority).toBe(1);
    expect(todo.basePriority).toBe(2);
    expect(todo.urgency).toBe(1);
    expect(todo.requestDate).toBe('2024-01-01');
    expect(todo.dueDate).toBe('2024-01-15');
    expect(todo.deadline).toBe('2024-01-20');
    expect(todo.source).toBe('linear');
    expect(todo.sourceId).toBe('LIN-123');
    expect(todo.sourceUrl).toBe('https://linear.app/issue/LIN-123');
    expect(todo.sourceUrls).toEqual(['https://linear.app/issue/LIN-123', 'https://github.com/pr/456']);
    expect(todo.status).toBe('in_progress');
    expect(todo.snoozedUntil).toBe('2024-01-10T00:00:00Z');
    expect(todo.staleNotifiedAt).toBe('2024-01-05T00:00:00Z');
    expect(todo.fingerprint).toBe('abc123');
    expect(todo.tags).toEqual(['urgent', 'bug']);
    expect(todo.summaryId).toBe('summary-1');
    expect(todo.summaryPeriod).toBe('2024-W01');
    expect(todo.summaryItemId).toBe('item-1');
    expect(todo.category).toBe('engineering');
  });

  it('converts completed todo row with completedAt', () => {
    const row: TodoRow = {
      id: 'todo-3',
      title: 'Completed Todo',
      description: null,
      priority: 3,
      base_priority: null,
      urgency: null,
      request_date: null,
      due_date: null,
      deadline: null,
      source: null,
      source_id: null,
      source_url: null,
      source_urls: null,
      status: 'completed',
      snoozed_until: null,
      stale_notified_at: null,
      fingerprint: null,
      tags: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
      completed_at: '2024-01-05T00:00:00Z',
      archived_at: null,
      summary_id: null,
      summary_period: null,
      summary_item_id: null,
      category: null,
    };

    const todo = todoRowToTodo(row);

    expect(todo.status).toBe('completed');
    expect(todo.completedAt).toBe('2024-01-05T00:00:00Z');
  });

  it('converts archived todo row with archivedAt', () => {
    const row: TodoRow = {
      id: 'todo-4',
      title: 'Archived Todo',
      description: null,
      priority: 3,
      base_priority: null,
      urgency: null,
      request_date: null,
      due_date: null,
      deadline: null,
      source: null,
      source_id: null,
      source_url: null,
      source_urls: null,
      status: 'archived',
      snoozed_until: null,
      stale_notified_at: null,
      fingerprint: null,
      tags: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-10T00:00:00Z',
      completed_at: null,
      archived_at: '2024-01-10T00:00:00Z',
      summary_id: null,
      summary_period: null,
      summary_item_id: null,
      category: null,
    };

    const todo = todoRowToTodo(row);

    expect(todo.status).toBe('archived');
    expect(todo.archivedAt).toBe('2024-01-10T00:00:00Z');
  });

  it('parses empty JSON arrays correctly', () => {
    const row: TodoRow = {
      id: 'todo-5',
      title: 'Empty Arrays Todo',
      description: null,
      priority: 3,
      base_priority: null,
      urgency: null,
      request_date: null,
      due_date: null,
      deadline: null,
      source: null,
      source_id: null,
      source_url: null,
      source_urls: '[]',
      status: 'pending',
      snoozed_until: null,
      stale_notified_at: null,
      fingerprint: null,
      tags: '[]',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      completed_at: null,
      archived_at: null,
      summary_id: null,
      summary_period: null,
      summary_item_id: null,
      category: null,
    };

    const todo = todoRowToTodo(row);

    expect(todo.sourceUrls).toEqual([]);
    expect(todo.tags).toEqual([]);
  });

  it('handles different todo sources', () => {
    const sources = ['linear', 'github', 'email', 'slack', 'manual', 'notion'] as const;

    for (const source of sources) {
      const row: TodoRow = {
        id: `todo-${source}`,
        title: `${source} Todo`,
        description: null,
        priority: 3,
        base_priority: null,
        urgency: null,
        request_date: null,
        due_date: null,
        deadline: null,
        source,
        source_id: null,
        source_url: null,
        source_urls: null,
        status: 'pending',
        snoozed_until: null,
        stale_notified_at: null,
        fingerprint: null,
        tags: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        archived_at: null,
        summary_id: null,
        summary_period: null,
        summary_item_id: null,
        category: null,
      };

      const todo = todoRowToTodo(row);
      expect(todo.source).toBe(source);
    }
  });

  it('handles different todo statuses', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'archived'] as const;

    for (const status of statuses) {
      const row: TodoRow = {
        id: `todo-${status}`,
        title: `${status} Todo`,
        description: null,
        priority: 3,
        base_priority: null,
        urgency: null,
        request_date: null,
        due_date: null,
        deadline: null,
        source: null,
        source_id: null,
        source_url: null,
        source_urls: null,
        status,
        snoozed_until: null,
        stale_notified_at: null,
        fingerprint: null,
        tags: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        archived_at: null,
        summary_id: null,
        summary_period: null,
        summary_item_id: null,
        category: null,
      };

      const todo = todoRowToTodo(row);
      expect(todo.status).toBe(status);
    }
  });

  it('handles different todo categories', () => {
    const categories = ['engineering', 'management', 'communication', 'admin'] as const;

    for (const category of categories) {
      const row: TodoRow = {
        id: `todo-${category}`,
        title: `${category} Todo`,
        description: null,
        priority: 3,
        base_priority: null,
        urgency: null,
        request_date: null,
        due_date: null,
        deadline: null,
        source: null,
        source_id: null,
        source_url: null,
        source_urls: null,
        status: 'pending',
        snoozed_until: null,
        stale_notified_at: null,
        fingerprint: null,
        tags: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        archived_at: null,
        summary_id: null,
        summary_period: null,
        summary_item_id: null,
        category,
      };

      const todo = todoRowToTodo(row);
      expect(todo.category).toBe(category);
    }
  });
});

// ==================== todoToRow ====================

describe('todoToRow', () => {
  it('converts a minimal todo to row', () => {
    const todo = {
      id: 'todo-1',
      title: 'Test Todo',
      priority: 3,
      basePriority: 3,
      urgency: 3,
      status: 'pending' as const,
    };

    const row = todoToRow(todo);

    expect(row.id).toBe('todo-1');
    expect(row.title).toBe('Test Todo');
    expect(row.priority).toBe(3);
    expect(row.base_priority).toBe(3); // defaults to priority
    expect(row.urgency).toBe(3); // defaults to 3
    expect(row.status).toBe('pending');
    expect(row.description).toBeNull();
    expect(row.source).toBeNull();
    expect(row.tags).toBeNull();
  });

  it('converts a fully populated todo to row', () => {
    const todo = {
      id: 'todo-2',
      title: 'Full Todo',
      description: 'A detailed description',
      priority: 1,
      basePriority: 2,
      urgency: 1,
      requestDate: '2024-01-01',
      dueDate: '2024-01-15',
      deadline: '2024-01-20',
      source: 'linear' as const,
      sourceId: 'LIN-123',
      sourceUrl: 'https://linear.app/issue/LIN-123',
      sourceUrls: ['https://linear.app/issue/LIN-123', 'https://github.com/pr/456'],
      status: 'in_progress' as const,
      snoozedUntil: '2024-01-10T00:00:00Z',
      staleNotifiedAt: '2024-01-05T00:00:00Z',
      fingerprint: 'abc123',
      tags: ['urgent', 'bug'],
      completedAt: undefined,
      archivedAt: undefined,
      summaryId: 'summary-1',
      summaryPeriod: '2024-W01',
      summaryItemId: 'item-1',
      category: 'engineering' as const,
    };

    const row = todoToRow(todo);

    expect(row.id).toBe('todo-2');
    expect(row.title).toBe('Full Todo');
    expect(row.description).toBe('A detailed description');
    expect(row.priority).toBe(1);
    expect(row.base_priority).toBe(2);
    expect(row.urgency).toBe(1);
    expect(row.request_date).toBe('2024-01-01');
    expect(row.due_date).toBe('2024-01-15');
    expect(row.deadline).toBe('2024-01-20');
    expect(row.source).toBe('linear');
    expect(row.source_id).toBe('LIN-123');
    expect(row.source_url).toBe('https://linear.app/issue/LIN-123');
    expect(row.source_urls).toBe('["https://linear.app/issue/LIN-123","https://github.com/pr/456"]');
    expect(row.status).toBe('in_progress');
    expect(row.snoozed_until).toBe('2024-01-10T00:00:00Z');
    expect(row.stale_notified_at).toBe('2024-01-05T00:00:00Z');
    expect(row.fingerprint).toBe('abc123');
    expect(row.tags).toBe('["urgent","bug"]');
    expect(row.summary_id).toBe('summary-1');
    expect(row.summary_period).toBe('2024-W01');
    expect(row.summary_item_id).toBe('item-1');
    expect(row.category).toBe('engineering');
  });

  it('converts completed todo with completedAt', () => {
    const todo = {
      id: 'todo-3',
      title: 'Completed Todo',
      priority: 3,
      basePriority: 3,
      urgency: 3,
      status: 'completed' as const,
      completedAt: '2024-01-05T00:00:00Z',
    };

    const row = todoToRow(todo);

    expect(row.status).toBe('completed');
    expect(row.completed_at).toBe('2024-01-05T00:00:00Z');
  });

  it('converts archived todo with archivedAt', () => {
    const todo = {
      id: 'todo-4',
      title: 'Archived Todo',
      priority: 3,
      basePriority: 3,
      urgency: 3,
      status: 'archived' as const,
      archivedAt: '2024-01-10T00:00:00Z',
    };

    const row = todoToRow(todo);

    expect(row.status).toBe('archived');
    expect(row.archived_at).toBe('2024-01-10T00:00:00Z');
  });

  it('serializes empty arrays to JSON', () => {
    const todo = {
      id: 'todo-5',
      title: 'Empty Arrays Todo',
      priority: 3,
      basePriority: 3,
      urgency: 3,
      status: 'pending' as const,
      sourceUrls: [],
      tags: [],
    };

    const row = todoToRow(todo);

    expect(row.source_urls).toBe('[]');
    expect(row.tags).toBe('[]');
  });

  it('converts undefined to null', () => {
    const todo = {
      id: 'todo-6',
      title: 'Undefined Fields Todo',
      priority: 3,
      basePriority: 3,
      urgency: 3,
      status: 'pending' as const,
      description: undefined,
      source: undefined,
      sourceId: undefined,
      tags: undefined,
    };

    const row = todoToRow(todo);

    expect(row.description).toBeNull();
    expect(row.source).toBeNull();
    expect(row.source_id).toBeNull();
    expect(row.tags).toBeNull();
  });

  it('round-trips correctly with todoRowToTodo', () => {
    const originalTodo = {
      id: 'todo-roundtrip',
      title: 'Round Trip Todo',
      description: 'Testing round trip',
      priority: 2,
      basePriority: 3,
      urgency: 1,
      requestDate: '2024-01-01',
      dueDate: '2024-01-15',
      source: 'github' as const,
      sourceId: 'PR-123',
      sourceUrl: 'https://github.com/repo/pull/123',
      sourceUrls: ['https://github.com/repo/pull/123'],
      status: 'in_progress' as const,
      fingerprint: 'xyz789',
      tags: ['review', 'pr'],
      summaryId: 'sum-1',
      summaryPeriod: '2024-W01',
      summaryItemId: 'item-1',
      category: 'engineering' as const,
    };

    const row = todoToRow(originalTodo);
    const fullRow: TodoRow = {
      ...row,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      completed_at: row.completed_at ?? null,
      archived_at: row.archived_at ?? null,
    };

    const convertedTodo = todoRowToTodo(fullRow);

    expect(convertedTodo.id).toBe(originalTodo.id);
    expect(convertedTodo.title).toBe(originalTodo.title);
    expect(convertedTodo.description).toBe(originalTodo.description);
    expect(convertedTodo.priority).toBe(originalTodo.priority);
    expect(convertedTodo.basePriority).toBe(originalTodo.basePriority);
    expect(convertedTodo.urgency).toBe(originalTodo.urgency);
    expect(convertedTodo.source).toBe(originalTodo.source);
    expect(convertedTodo.sourceId).toBe(originalTodo.sourceId);
    expect(convertedTodo.sourceUrl).toBe(originalTodo.sourceUrl);
    expect(convertedTodo.sourceUrls).toEqual(originalTodo.sourceUrls);
    expect(convertedTodo.status).toBe(originalTodo.status);
    expect(convertedTodo.tags).toEqual(originalTodo.tags);
  });
});

// ==================== meetingRowToMeeting ====================

describe('meetingRowToMeeting', () => {
  it('converts a minimal meeting row', () => {
    const row: MeetingRow = {
      id: 'meeting-1',
      calendar_event_id: null,
      title: 'Team Standup',
      start_time: '2024-01-01T09:00:00Z',
      end_time: '2024-01-01T09:30:00Z',
      attendees: null,
      talking_points: null,
      context_notes: null,
      transcript_path: null,
      created_at: '2024-01-01T00:00:00Z',
    };

    const meeting = meetingRowToMeeting(row);

    expect(meeting.id).toBe('meeting-1');
    expect(meeting.title).toBe('Team Standup');
    expect(meeting.startTime).toBe('2024-01-01T09:00:00Z');
    expect(meeting.endTime).toBe('2024-01-01T09:30:00Z');
    expect(meeting.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(meeting.calendarEventId).toBeUndefined();
    expect(meeting.attendees).toBeUndefined();
    expect(meeting.talkingPoints).toBeUndefined();
    expect(meeting.contextNotes).toBeUndefined();
    expect(meeting.transcriptPath).toBeUndefined();
  });

  it('converts a fully populated meeting row', () => {
    const row: MeetingRow = {
      id: 'meeting-2',
      calendar_event_id: 'cal-123',
      title: '1:1 with John',
      start_time: '2024-01-01T14:00:00Z',
      end_time: '2024-01-01T14:30:00Z',
      attendees: '["john@example.com", "jane@example.com"]',
      talking_points: '["Q4 review", "2024 goals"]',
      context_notes: 'Follow up from last week',
      transcript_path: '/meetings/2024-01-01/1-1-john.md',
      created_at: '2024-01-01T00:00:00Z',
    };

    const meeting = meetingRowToMeeting(row);

    expect(meeting.id).toBe('meeting-2');
    expect(meeting.calendarEventId).toBe('cal-123');
    expect(meeting.title).toBe('1:1 with John');
    expect(meeting.startTime).toBe('2024-01-01T14:00:00Z');
    expect(meeting.endTime).toBe('2024-01-01T14:30:00Z');
    expect(meeting.attendees).toEqual(['john@example.com', 'jane@example.com']);
    expect(meeting.talkingPoints).toEqual(['Q4 review', '2024 goals']);
    expect(meeting.contextNotes).toBe('Follow up from last week');
    expect(meeting.transcriptPath).toBe('/meetings/2024-01-01/1-1-john.md');
  });

  it('parses empty arrays for attendees and talking points', () => {
    const row: MeetingRow = {
      id: 'meeting-3',
      calendar_event_id: null,
      title: 'Solo Focus Time',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T12:00:00Z',
      attendees: '[]',
      talking_points: '[]',
      context_notes: null,
      transcript_path: null,
      created_at: '2024-01-01T00:00:00Z',
    };

    const meeting = meetingRowToMeeting(row);

    expect(meeting.attendees).toEqual([]);
    expect(meeting.talkingPoints).toEqual([]);
  });
});

// ==================== meetingToRow ====================

describe('meetingToRow', () => {
  it('converts a minimal meeting to row', () => {
    const meeting = {
      id: 'meeting-1',
      title: 'Team Standup',
      startTime: '2024-01-01T09:00:00Z',
      endTime: '2024-01-01T09:30:00Z',
    };

    const row = meetingToRow(meeting);

    expect(row.id).toBe('meeting-1');
    expect(row.title).toBe('Team Standup');
    expect(row.start_time).toBe('2024-01-01T09:00:00Z');
    expect(row.end_time).toBe('2024-01-01T09:30:00Z');
    expect(row.calendar_event_id).toBeNull();
    expect(row.attendees).toBeNull();
    expect(row.talking_points).toBeNull();
    expect(row.context_notes).toBeNull();
    expect(row.transcript_path).toBeNull();
  });

  it('converts a fully populated meeting to row', () => {
    const meeting = {
      id: 'meeting-2',
      calendarEventId: 'cal-123',
      title: '1:1 with John',
      startTime: '2024-01-01T14:00:00Z',
      endTime: '2024-01-01T14:30:00Z',
      attendees: ['john@example.com', 'jane@example.com'],
      talkingPoints: ['Q4 review', '2024 goals'],
      contextNotes: 'Follow up from last week',
      transcriptPath: '/meetings/2024-01-01/1-1-john.md',
    };

    const row = meetingToRow(meeting);

    expect(row.id).toBe('meeting-2');
    expect(row.calendar_event_id).toBe('cal-123');
    expect(row.title).toBe('1:1 with John');
    expect(row.start_time).toBe('2024-01-01T14:00:00Z');
    expect(row.end_time).toBe('2024-01-01T14:30:00Z');
    expect(row.attendees).toBe('["john@example.com","jane@example.com"]');
    expect(row.talking_points).toBe('["Q4 review","2024 goals"]');
    expect(row.context_notes).toBe('Follow up from last week');
    expect(row.transcript_path).toBe('/meetings/2024-01-01/1-1-john.md');
  });

  it('serializes empty arrays to JSON', () => {
    const meeting = {
      id: 'meeting-3',
      title: 'Solo Focus Time',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T12:00:00Z',
      attendees: [],
      talkingPoints: [],
    };

    const row = meetingToRow(meeting);

    expect(row.attendees).toBe('[]');
    expect(row.talking_points).toBe('[]');
  });

  it('round-trips correctly with meetingRowToMeeting', () => {
    const originalMeeting = {
      id: 'meeting-roundtrip',
      calendarEventId: 'cal-456',
      title: 'Round Trip Meeting',
      startTime: '2024-01-01T15:00:00Z',
      endTime: '2024-01-01T16:00:00Z',
      attendees: ['alice@example.com', 'bob@example.com'],
      talkingPoints: ['Agenda item 1', 'Agenda item 2'],
      contextNotes: 'Important meeting',
      transcriptPath: '/meetings/roundtrip.md',
    };

    const row = meetingToRow(originalMeeting);
    const fullRow: MeetingRow = {
      ...row,
      created_at: '2024-01-01T00:00:00Z',
    };

    const convertedMeeting = meetingRowToMeeting(fullRow);

    expect(convertedMeeting.id).toBe(originalMeeting.id);
    expect(convertedMeeting.calendarEventId).toBe(originalMeeting.calendarEventId);
    expect(convertedMeeting.title).toBe(originalMeeting.title);
    expect(convertedMeeting.startTime).toBe(originalMeeting.startTime);
    expect(convertedMeeting.endTime).toBe(originalMeeting.endTime);
    expect(convertedMeeting.attendees).toEqual(originalMeeting.attendees);
    expect(convertedMeeting.talkingPoints).toEqual(originalMeeting.talkingPoints);
    expect(convertedMeeting.contextNotes).toBe(originalMeeting.contextNotes);
    expect(convertedMeeting.transcriptPath).toBe(originalMeeting.transcriptPath);
  });
});

// ==================== communicationLogRowToLog ====================

describe('communicationLogRowToLog', () => {
  it('converts a communication log row with action_required = 0', () => {
    const row: CommunicationLogRow = {
      id: 'log-1',
      channel: 'email',
      summary: 'Received status update from vendor',
      importance: 2,
      action_required: 0,
      logged_at: '2024-01-01T10:00:00Z',
    };

    const log = communicationLogRowToLog(row);

    expect(log.id).toBe('log-1');
    expect(log.channel).toBe('email');
    expect(log.summary).toBe('Received status update from vendor');
    expect(log.importance).toBe(2);
    expect(log.actionRequired).toBe(false);
    expect(log.loggedAt).toBe('2024-01-01T10:00:00Z');
  });

  it('converts a communication log row with action_required = 1', () => {
    const row: CommunicationLogRow = {
      id: 'log-2',
      channel: 'slack',
      summary: 'Urgent request from CEO',
      importance: 1,
      action_required: 1,
      logged_at: '2024-01-01T11:00:00Z',
    };

    const log = communicationLogRowToLog(row);

    expect(log.id).toBe('log-2');
    expect(log.channel).toBe('slack');
    expect(log.summary).toBe('Urgent request from CEO');
    expect(log.importance).toBe(1);
    expect(log.actionRequired).toBe(true);
    expect(log.loggedAt).toBe('2024-01-01T11:00:00Z');
  });

  it('handles different channels', () => {
    const channels = ['email', 'slack', 'teams', 'meeting'] as const;

    for (const channel of channels) {
      const row: CommunicationLogRow = {
        id: `log-${channel}`,
        channel,
        summary: `${channel} communication`,
        importance: 3,
        action_required: 0,
        logged_at: '2024-01-01T12:00:00Z',
      };

      const log = communicationLogRowToLog(row);
      expect(log.channel).toBe(channel);
    }
  });
});

// ==================== logToRow ====================

describe('logToRow', () => {
  it('converts a communication log with actionRequired = false', () => {
    const log = {
      id: 'log-1',
      channel: 'email' as const,
      summary: 'Weekly digest',
      importance: 4,
      actionRequired: false,
    };

    const row = logToRow(log);

    expect(row.id).toBe('log-1');
    expect(row.channel).toBe('email');
    expect(row.summary).toBe('Weekly digest');
    expect(row.importance).toBe(4);
    expect(row.action_required).toBe(0);
  });

  it('converts a communication log with actionRequired = true', () => {
    const log = {
      id: 'log-2',
      channel: 'slack' as const,
      summary: 'Incident alert',
      importance: 1,
      actionRequired: true,
    };

    const row = logToRow(log);

    expect(row.id).toBe('log-2');
    expect(row.channel).toBe('slack');
    expect(row.summary).toBe('Incident alert');
    expect(row.importance).toBe(1);
    expect(row.action_required).toBe(1);
  });

  it('round-trips correctly with communicationLogRowToLog', () => {
    const originalLog = {
      id: 'log-roundtrip',
      channel: 'slack' as const,
      summary: 'Round trip test',
      importance: 2,
      actionRequired: true,
    };

    const row = logToRow(originalLog);
    const fullRow: CommunicationLogRow = {
      ...row,
      logged_at: '2024-01-01T00:00:00Z',
    };

    const convertedLog = communicationLogRowToLog(fullRow);

    expect(convertedLog.id).toBe(originalLog.id);
    expect(convertedLog.channel).toBe(originalLog.channel);
    expect(convertedLog.summary).toBe(originalLog.summary);
    expect(convertedLog.importance).toBe(originalLog.importance);
    expect(convertedLog.actionRequired).toBe(originalLog.actionRequired);
  });
});

// ==================== briefingRowToBriefing ====================

describe('briefingRowToBriefing', () => {
  it('converts a briefing row with minimal data', () => {
    const row: BriefingRow = {
      id: 'briefing-1',
      date: '2024-01-01',
      file_path: '/briefings/2024-01-01.md',
      data: JSON.stringify({
        date: '2024-01-01',
        calendar: { meetings: [], focusTimeBlocks: 2 },
        communications: { urgentEmails: 0, slackMentions: 0, prReviewsNeeded: 0 },
        todos: [],
        incidents: { active: 0, recentlyResolved: 0 },
        teamUpdates: { outOfOffice: [], newHires: [] },
      }),
      created_at: '2024-01-01T06:00:00Z',
    };

    const briefing = briefingRowToBriefing(row);

    expect(briefing.id).toBe('briefing-1');
    expect(briefing.date).toBe('2024-01-01');
    expect(briefing.filePath).toBe('/briefings/2024-01-01.md');
    expect(briefing.createdAt).toBe('2024-01-01T06:00:00Z');
    expect(briefing.data.date).toBe('2024-01-01');
    expect(briefing.data.calendar.meetings).toEqual([]);
    expect(briefing.data.todos).toEqual([]);
  });

  it('converts a briefing row with populated data', () => {
    const briefingData = {
      date: '2024-01-02',
      calendar: {
        meetings: [
          { title: 'Standup', time: '09:00' },
          { title: '1:1', time: '14:00' },
        ],
        focusTimeBlocks: 3,
      },
      communications: {
        urgentEmails: 2,
        slackMentions: 5,
        prReviewsNeeded: 3,
      },
      todos: [
        { id: 'todo-1', title: 'Review PR' },
        { id: 'todo-2', title: 'Write docs' },
      ],
      incidents: {
        active: 1,
        recentlyResolved: 2,
      },
      teamUpdates: {
        outOfOffice: ['Alice'],
        newHires: ['Bob'],
      },
    };

    const row: BriefingRow = {
      id: 'briefing-2',
      date: '2024-01-02',
      file_path: '/briefings/2024-01-02.md',
      data: JSON.stringify(briefingData),
      created_at: '2024-01-02T06:00:00Z',
    };

    const briefing = briefingRowToBriefing(row);

    expect(briefing.data.calendar.meetings).toHaveLength(2);
    expect(briefing.data.communications.urgentEmails).toBe(2);
    expect(briefing.data.todos).toHaveLength(2);
    expect(briefing.data.incidents.active).toBe(1);
    expect(briefing.data.teamUpdates.outOfOffice).toContain('Alice');
  });
});

// ==================== summaryRowToSummary ====================

describe('summaryRowToSummary', () => {
  it('converts a minimal summary row', () => {
    const row: SummaryRow = {
      id: 'summary-1',
      fidelity: 'daily',
      period: '2024-01-01',
      start_date: '2024-01-01',
      end_date: '2024-01-01',
      file_path: '/summaries/daily/2024-01-01.md',
      source_summaries: null,
      stats: '{"completed": 5, "created": 3}',
      generated_at: '2024-01-01T23:59:00Z',
    };

    const summary = summaryRowToSummary(row);

    expect(summary.id).toBe('summary-1');
    expect(summary.fidelity).toBe('daily');
    expect(summary.period).toBe('2024-01-01');
    expect(summary.startDate).toBe('2024-01-01');
    expect(summary.endDate).toBe('2024-01-01');
    expect(summary.filePath).toBe('/summaries/daily/2024-01-01.md');
    expect(summary.sourceSummaries).toBeUndefined();
    expect(summary.stats).toEqual({ completed: 5, created: 3 });
    expect(summary.generatedAt).toBe('2024-01-01T23:59:00Z');
  });

  it('converts a weekly summary row with source summaries', () => {
    const row: SummaryRow = {
      id: 'summary-2',
      fidelity: 'weekly',
      period: '2024-W01',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      file_path: '/summaries/weekly/2024-W01.md',
      source_summaries: '["summary-daily-1", "summary-daily-2"]',
      stats: '{"completed": 25, "created": 20, "carryOver": 5}',
      generated_at: '2024-01-07T23:59:00Z',
    };

    const summary = summaryRowToSummary(row);

    expect(summary.fidelity).toBe('weekly');
    expect(summary.period).toBe('2024-W01');
    expect(summary.startDate).toBe('2024-01-01');
    expect(summary.endDate).toBe('2024-01-07');
    expect(summary.sourceSummaries).toEqual(['summary-daily-1', 'summary-daily-2']);
    expect(summary.stats).toEqual({ completed: 25, created: 20, carryOver: 5 });
  });

  it('handles all fidelity levels', () => {
    const fidelities = ['daily', 'weekly', 'monthly', 'quarterly', 'h1-h2', 'yearly'] as const;

    for (const fidelity of fidelities) {
      const row: SummaryRow = {
        id: `summary-${fidelity}`,
        fidelity,
        period: '2024',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        file_path: `/summaries/${fidelity}/2024.md`,
        source_summaries: null,
        stats: '{}',
        generated_at: '2024-12-31T23:59:00Z',
      };

      const summary = summaryRowToSummary(row);
      expect(summary.fidelity).toBe(fidelity);
    }
  });

  it('parses complex stats objects', () => {
    const stats = {
      completed: 100,
      created: 80,
      carryOver: 20,
      byCategory: {
        engineering: 50,
        management: 30,
        admin: 20,
      },
      averageCompletionTime: 2.5,
    };

    const row: SummaryRow = {
      id: 'summary-complex',
      fidelity: 'monthly',
      period: '2024-01',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      file_path: '/summaries/monthly/2024-01.md',
      source_summaries: null,
      stats: JSON.stringify(stats),
      generated_at: '2024-01-31T23:59:00Z',
    };

    const summary = summaryRowToSummary(row);

    expect(summary.stats).toEqual(stats);
    expect((summary.stats as typeof stats).byCategory.engineering).toBe(50);
  });
});

// ==================== summaryToRow ====================

describe('summaryToRow', () => {
  it('converts a minimal summary to row', () => {
    const summary: Omit<StoredSummary, 'generatedAt'> = {
      id: 'summary-1',
      fidelity: 'daily',
      period: '2024-01-01',
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      filePath: '/summaries/daily/2024-01-01.md',
      stats: { completed: 5 },
    };

    const row = summaryToRow(summary);

    expect(row.id).toBe('summary-1');
    expect(row.fidelity).toBe('daily');
    expect(row.period).toBe('2024-01-01');
    expect(row.start_date).toBe('2024-01-01');
    expect(row.end_date).toBe('2024-01-01');
    expect(row.file_path).toBe('/summaries/daily/2024-01-01.md');
    expect(row.source_summaries).toBeNull();
    expect(row.stats).toBe('{"completed":5}');
    expect(row.generated_at).toBeDefined(); // auto-generated
  });

  it('converts a summary with source summaries', () => {
    const summary: StoredSummary = {
      id: 'summary-2',
      fidelity: 'weekly',
      period: '2024-W01',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      filePath: '/summaries/weekly/2024-W01.md',
      sourceSummaries: ['daily-1', 'daily-2', 'daily-3'],
      stats: { completed: 20, created: 15 },
      generatedAt: '2024-01-07T23:59:00Z',
    };

    const row = summaryToRow(summary);

    expect(row.source_summaries).toBe('["daily-1","daily-2","daily-3"]');
    expect(row.generated_at).toBe('2024-01-07T23:59:00Z');
  });

  it('uses provided generatedAt when present', () => {
    const summary: StoredSummary = {
      id: 'summary-3',
      fidelity: 'daily',
      period: '2024-01-01',
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      filePath: '/summaries/daily/2024-01-01.md',
      stats: {},
      generatedAt: '2024-01-01T12:00:00Z',
    };

    const row = summaryToRow(summary);

    expect(row.generated_at).toBe('2024-01-01T12:00:00Z');
  });

  it('generates current timestamp when generatedAt is undefined', () => {
    const summary: Omit<StoredSummary, 'generatedAt'> = {
      id: 'summary-4',
      fidelity: 'daily',
      period: '2024-01-01',
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      filePath: '/summaries/daily/2024-01-01.md',
      stats: {},
    };

    const before = new Date().toISOString();
    const row = summaryToRow(summary);
    const after = new Date().toISOString();

    expect(row.generated_at >= before).toBe(true);
    expect(row.generated_at <= after).toBe(true);
  });

  it('round-trips correctly with summaryRowToSummary', () => {
    const originalSummary: StoredSummary = {
      id: 'summary-roundtrip',
      fidelity: 'monthly',
      period: '2024-01',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      filePath: '/summaries/monthly/2024-01.md',
      sourceSummaries: ['w1', 'w2', 'w3', 'w4'],
      stats: { completed: 100, created: 80 },
      generatedAt: '2024-01-31T23:59:00Z',
    };

    const row = summaryToRow(originalSummary);
    const convertedSummary = summaryRowToSummary(row);

    expect(convertedSummary.id).toBe(originalSummary.id);
    expect(convertedSummary.fidelity).toBe(originalSummary.fidelity);
    expect(convertedSummary.period).toBe(originalSummary.period);
    expect(convertedSummary.startDate).toBe(originalSummary.startDate);
    expect(convertedSummary.endDate).toBe(originalSummary.endDate);
    expect(convertedSummary.filePath).toBe(originalSummary.filePath);
    expect(convertedSummary.sourceSummaries).toEqual(originalSummary.sourceSummaries);
    expect(convertedSummary.stats).toEqual(originalSummary.stats);
    expect(convertedSummary.generatedAt).toBe(originalSummary.generatedAt);
  });
});

// ==================== summaryTodoRowToLink ====================

describe('summaryTodoRowToLink', () => {
  it('converts a link row with createdBySummary = 0', () => {
    const row: SummaryTodoRow = {
      summary_id: 'summary-1',
      todo_id: 'todo-1',
      created_by_summary: 0,
    };

    const link = summaryTodoRowToLink(row);

    expect(link.summaryId).toBe('summary-1');
    expect(link.todoId).toBe('todo-1');
    expect(link.createdBySummary).toBe(false);
  });

  it('converts a link row with createdBySummary = 1', () => {
    const row: SummaryTodoRow = {
      summary_id: 'summary-2',
      todo_id: 'todo-2',
      created_by_summary: 1,
    };

    const link = summaryTodoRowToLink(row);

    expect(link.summaryId).toBe('summary-2');
    expect(link.todoId).toBe('todo-2');
    expect(link.createdBySummary).toBe(true);
  });

  it('handles multiple links for the same summary', () => {
    const rows: SummaryTodoRow[] = [
      { summary_id: 'summary-3', todo_id: 'todo-a', created_by_summary: 0 },
      { summary_id: 'summary-3', todo_id: 'todo-b', created_by_summary: 1 },
      { summary_id: 'summary-3', todo_id: 'todo-c', created_by_summary: 0 },
    ];

    const links = rows.map(summaryTodoRowToLink);

    expect(links).toHaveLength(3);
    expect(links.every(l => l.summaryId === 'summary-3')).toBe(true);
    expect(links[0]!.createdBySummary).toBe(false);
    expect(links[1]!.createdBySummary).toBe(true);
    expect(links[2]!.createdBySummary).toBe(false);
  });
});
