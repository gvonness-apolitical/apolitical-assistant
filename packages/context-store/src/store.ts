import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Todo, Meeting, CommunicationLog, BriefingData } from '@apolitical-assistant/shared';
import {
  type TodoRow,
  type MeetingRow,
  type CommunicationLogRow,
  type BriefingRow,
  type PreferenceRow,
  type StoredBriefing,
  todoRowToTodo,
  todoToRow,
  meetingRowToMeeting,
  meetingToRow,
  communicationLogRowToLog,
  logToRow,
  briefingRowToBriefing,
} from './models.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ContextStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.runMigrations();
  }

  private runMigrations(): void {
    const migrationPath = join(__dirname, 'migrations', '001_initial.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    this.db.exec(migration);
  }

  close(): void {
    this.db.close();
  }

  // ==================== TODOS ====================

  createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Todo {
    const id = randomUUID();
    const row = todoToRow({ ...todo, id });

    this.db.prepare(`
      INSERT INTO todos (id, title, description, priority, due_date, source, source_id, status)
      VALUES (@id, @title, @description, @priority, @due_date, @source, @source_id, @status)
    `).run(row);

    return this.getTodo(id)!;
  }

  getTodo(id: string): Todo | null {
    const row = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    return row ? todoRowToTodo(row) : null;
  }

  listTodos(options: {
    status?: Todo['status'];
    source?: string;
    limit?: number;
    orderBy?: 'priority' | 'due_date' | 'created_at';
  } = {}): Todo[] {
    const { status, source, limit = 100, orderBy = 'priority' } = options;

    let query = 'SELECT * FROM todos WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (status) {
      query += ' AND status = @status';
      params.status = status;
    }

    if (source) {
      query += ' AND source = @source';
      params.source = source;
    }

    query += ` ORDER BY ${orderBy} ${orderBy === 'priority' ? 'ASC' : 'DESC'}`;
    query += ' LIMIT @limit';
    params.limit = limit;

    const rows = this.db.prepare(query).all(params) as TodoRow[];
    return rows.map(todoRowToTodo);
  }

  updateTodo(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>): Todo | null {
    const existing = this.getTodo(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.title !== undefined) {
      fields.push('title = @title');
      params.title = updates.title;
    }
    if (updates.description !== undefined) {
      fields.push('description = @description');
      params.description = updates.description;
    }
    if (updates.priority !== undefined) {
      fields.push('priority = @priority');
      params.priority = updates.priority;
    }
    if (updates.dueDate !== undefined) {
      fields.push('due_date = @due_date');
      params.due_date = updates.dueDate;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      params.status = updates.status;
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }

    return this.getTodo(id);
  }

  deleteTodo(id: string): boolean {
    const result = this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==================== MEETINGS ====================

  createMeeting(meeting: Omit<Meeting, 'id' | 'createdAt'>): Meeting {
    const id = randomUUID();
    const row = meetingToRow({ ...meeting, id });

    this.db.prepare(`
      INSERT INTO meetings (id, calendar_event_id, title, start_time, end_time, attendees, talking_points, context_notes, transcript_path)
      VALUES (@id, @calendar_event_id, @title, @start_time, @end_time, @attendees, @talking_points, @context_notes, @transcript_path)
    `).run(row);

    return this.getMeeting(id)!;
  }

  getMeeting(id: string): Meeting | null {
    const row = this.db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
    return row ? meetingRowToMeeting(row) : null;
  }

  getMeetingByCalendarId(calendarEventId: string): Meeting | null {
    const row = this.db.prepare('SELECT * FROM meetings WHERE calendar_event_id = ?').get(calendarEventId) as MeetingRow | undefined;
    return row ? meetingRowToMeeting(row) : null;
  }

  listMeetings(options: {
    startAfter?: string;
    startBefore?: string;
    limit?: number;
  } = {}): Meeting[] {
    const { startAfter, startBefore, limit = 50 } = options;

    let query = 'SELECT * FROM meetings WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (startAfter) {
      query += ' AND start_time >= @startAfter';
      params.startAfter = startAfter;
    }

    if (startBefore) {
      query += ' AND start_time <= @startBefore';
      params.startBefore = startBefore;
    }

    query += ' ORDER BY start_time ASC LIMIT @limit';
    params.limit = limit;

    const rows = this.db.prepare(query).all(params) as MeetingRow[];
    return rows.map(meetingRowToMeeting);
  }

  updateMeeting(id: string, updates: Partial<Omit<Meeting, 'id' | 'createdAt'>>): Meeting | null {
    const existing = this.getMeeting(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.title !== undefined) {
      fields.push('title = @title');
      params.title = updates.title;
    }
    if (updates.talkingPoints !== undefined) {
      fields.push('talking_points = @talking_points');
      params.talking_points = JSON.stringify(updates.talkingPoints);
    }
    if (updates.contextNotes !== undefined) {
      fields.push('context_notes = @context_notes');
      params.context_notes = updates.contextNotes;
    }
    if (updates.transcriptPath !== undefined) {
      fields.push('transcript_path = @transcript_path');
      params.transcript_path = updates.transcriptPath;
    }

    if (fields.length > 0) {
      this.db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }

    return this.getMeeting(id);
  }

  deleteMeeting(id: string): boolean {
    const result = this.db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==================== COMMUNICATION LOGS ====================

  createCommunicationLog(log: Omit<CommunicationLog, 'id' | 'loggedAt'>): CommunicationLog {
    const id = randomUUID();
    const row = logToRow({ ...log, id });

    this.db.prepare(`
      INSERT INTO communication_logs (id, channel, summary, importance, action_required)
      VALUES (@id, @channel, @summary, @importance, @action_required)
    `).run(row);

    return this.getCommunicationLog(id)!;
  }

  getCommunicationLog(id: string): CommunicationLog | null {
    const row = this.db.prepare('SELECT * FROM communication_logs WHERE id = ?').get(id) as CommunicationLogRow | undefined;
    return row ? communicationLogRowToLog(row) : null;
  }

  listCommunicationLogs(options: {
    channel?: CommunicationLog['channel'];
    actionRequired?: boolean;
    since?: string;
    limit?: number;
  } = {}): CommunicationLog[] {
    const { channel, actionRequired, since, limit = 100 } = options;

    let query = 'SELECT * FROM communication_logs WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (channel) {
      query += ' AND channel = @channel';
      params.channel = channel;
    }

    if (actionRequired !== undefined) {
      query += ' AND action_required = @actionRequired';
      params.actionRequired = actionRequired ? 1 : 0;
    }

    if (since) {
      query += ' AND logged_at >= @since';
      params.since = since;
    }

    query += ' ORDER BY logged_at DESC LIMIT @limit';
    params.limit = limit;

    const rows = this.db.prepare(query).all(params) as CommunicationLogRow[];
    return rows.map(communicationLogRowToLog);
  }

  // ==================== BRIEFINGS ====================

  saveBriefing(date: string, filePath: string, data: BriefingData): StoredBriefing {
    const id = randomUUID();

    this.db.prepare(`
      INSERT OR REPLACE INTO briefings (id, date, file_path, data)
      VALUES (@id, @date, @file_path, @data)
    `).run({
      id,
      date,
      file_path: filePath,
      data: JSON.stringify(data),
    });

    return this.getBriefingByDate(date)!;
  }

  getBriefingByDate(date: string): StoredBriefing | null {
    const row = this.db.prepare('SELECT * FROM briefings WHERE date = ?').get(date) as BriefingRow | undefined;
    return row ? briefingRowToBriefing(row) : null;
  }

  listBriefings(limit: number = 30): StoredBriefing[] {
    const rows = this.db.prepare('SELECT * FROM briefings ORDER BY date DESC LIMIT ?').all(limit) as BriefingRow[];
    return rows.map(briefingRowToBriefing);
  }

  // ==================== PREFERENCES ====================

  setPreference(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO preferences (key, value, updated_at)
      VALUES (@key, @value, datetime('now'))
    `).run({ key, value });
  }

  getPreference(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getAllPreferences(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM preferences').all() as PreferenceRow[];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  deletePreference(key: string): boolean {
    const result = this.db.prepare('DELETE FROM preferences WHERE key = ?').run(key);
    return result.changes > 0;
  }
}
