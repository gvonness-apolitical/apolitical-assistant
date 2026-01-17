import type { Todo, Meeting, CommunicationLog, BriefingData } from '@apolitical-assistant/shared';

export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | null;
  source: string | null;
  source_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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
    dueDate: row.due_date ?? undefined,
    source: row.source ?? undefined,
    sourceId: row.source_id ?? undefined,
    status: row.status as Todo['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function todoToRow(todo: Omit<Todo, 'createdAt' | 'updatedAt'>): Omit<TodoRow, 'created_at' | 'updated_at'> {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ?? null,
    priority: todo.priority,
    due_date: todo.dueDate ?? null,
    source: todo.source ?? null,
    source_id: todo.sourceId ?? null,
    status: todo.status,
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
