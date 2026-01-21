import type { Todo, Meeting, CommunicationLog, BriefingData, TodoSource, TodoStatus } from '@apolitical-assistant/shared';

export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  base_priority: number | null;
  urgency: number | null;
  request_date: string | null;
  due_date: string | null;
  deadline: string | null;
  source: string | null;
  source_id: string | null;
  source_url: string | null;
  source_urls: string | null;    // JSON array
  status: string;
  snoozed_until: string | null;
  stale_notified_at: string | null;
  fingerprint: string | null;
  tags: string | null;           // JSON array
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
}

export interface MeetingRow {
  id: string;
  calendar_event_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  attendees: string | null;
  talking_points: string | null;
  context_notes: string | null;
  transcript_path: string | null;
  created_at: string;
}

export interface CommunicationLogRow {
  id: string;
  channel: string;
  summary: string;
  importance: number;
  action_required: number;
  logged_at: string;
}

export interface BriefingRow {
  id: string;
  date: string;
  file_path: string;
  data: string;
  created_at: string;
}

export interface PreferenceRow {
  key: string;
  value: string;
  updated_at: string;
}

export function todoRowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority,
    basePriority: row.base_priority ?? row.priority,
    urgency: row.urgency ?? 3,
    requestDate: row.request_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    deadline: row.deadline ?? undefined,
    source: (row.source as TodoSource) ?? undefined,
    sourceId: row.source_id ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceUrls: row.source_urls ? JSON.parse(row.source_urls) : undefined,
    status: row.status as TodoStatus,
    snoozedUntil: row.snoozed_until ?? undefined,
    staleNotifiedAt: row.stale_notified_at ?? undefined,
    fingerprint: row.fingerprint ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
  };
}

export function todoToRow(
  todo: Omit<Todo, 'createdAt' | 'updatedAt'>
): Omit<TodoRow, 'created_at' | 'updated_at' | 'completed_at' | 'archived_at'> & {
  completed_at?: string | null;
  archived_at?: string | null;
} {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ?? null,
    priority: todo.priority,
    base_priority: todo.basePriority ?? todo.priority,
    urgency: todo.urgency ?? 3,
    request_date: todo.requestDate ?? null,
    due_date: todo.dueDate ?? null,
    deadline: todo.deadline ?? null,
    source: todo.source ?? null,
    source_id: todo.sourceId ?? null,
    source_url: todo.sourceUrl ?? null,
    source_urls: todo.sourceUrls ? JSON.stringify(todo.sourceUrls) : null,
    status: todo.status,
    snoozed_until: todo.snoozedUntil ?? null,
    stale_notified_at: todo.staleNotifiedAt ?? null,
    fingerprint: todo.fingerprint ?? null,
    tags: todo.tags ? JSON.stringify(todo.tags) : null,
    completed_at: todo.completedAt ?? null,
    archived_at: todo.archivedAt ?? null,
  };
}

export function meetingRowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    calendarEventId: row.calendar_event_id ?? undefined,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    attendees: row.attendees ? JSON.parse(row.attendees) : undefined,
    talkingPoints: row.talking_points ? JSON.parse(row.talking_points) : undefined,
    contextNotes: row.context_notes ?? undefined,
    transcriptPath: row.transcript_path ?? undefined,
    createdAt: row.created_at,
  };
}

export function meetingToRow(meeting: Omit<Meeting, 'createdAt'>): Omit<MeetingRow, 'created_at'> {
  return {
    id: meeting.id,
    calendar_event_id: meeting.calendarEventId ?? null,
    title: meeting.title,
    start_time: meeting.startTime,
    end_time: meeting.endTime,
    attendees: meeting.attendees ? JSON.stringify(meeting.attendees) : null,
    talking_points: meeting.talkingPoints ? JSON.stringify(meeting.talkingPoints) : null,
    context_notes: meeting.contextNotes ?? null,
    transcript_path: meeting.transcriptPath ?? null,
  };
}

export function communicationLogRowToLog(row: CommunicationLogRow): CommunicationLog {
  return {
    id: row.id,
    channel: row.channel as CommunicationLog['channel'],
    summary: row.summary,
    importance: row.importance,
    actionRequired: row.action_required === 1,
    loggedAt: row.logged_at,
  };
}

export function logToRow(log: Omit<CommunicationLog, 'loggedAt'>): Omit<CommunicationLogRow, 'logged_at'> {
  return {
    id: log.id,
    channel: log.channel,
    summary: log.summary,
    importance: log.importance,
    action_required: log.actionRequired ? 1 : 0,
  };
}

export interface StoredBriefing {
  id: string;
  date: string;
  filePath: string;
  data: BriefingData;
  createdAt: string;
}

export function briefingRowToBriefing(row: BriefingRow): StoredBriefing {
  return {
    id: row.id,
    date: row.date,
    filePath: row.file_path,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
  };
}
