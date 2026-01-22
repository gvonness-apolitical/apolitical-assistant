import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Todo, Meeting, CommunicationLog, BriefingData, TodoSource, TodoStatus } from '@apolitical-assistant/shared';
import { toErrorMessage, TODO_DEFAULTS } from '@apolitical-assistant/shared';
import {
  type TodoRow,
  type MeetingRow,
  type CommunicationLogRow,
  type BriefingRow,
  type PreferenceRow,
  type StoredBriefing,
  type SummaryRow,
  type SummaryTodoRow,
  type StoredSummary,
  type SummaryTodoLink,
  type SummaryFidelity,
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
} from './models.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ListTodosOptions {
  status?: TodoStatus | TodoStatus[];
  source?: TodoSource | TodoSource[];
  excludeSnoozed?: boolean;
  onlySnoozed?: boolean;
  onlyStale?: boolean;
  staleDays?: number;
  updatedBefore?: string;
  completedAfter?: string;
  limit?: number;
  orderBy?: 'priority' | 'due_date' | 'created_at' | 'deadline' | 'urgency';
  orderDirection?: 'ASC' | 'DESC';
  // Summary integration filters
  summaryId?: string;
  summaryPeriod?: string;
  category?: string;
}

export class ContextStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.runMigrations();
  }

  private runMigrations(): void {
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, 'utf-8');
      try {
        this.db.exec(migration);
      } catch (error) {
        // Ignore errors for already-applied migrations (e.g., duplicate column)
        const message = toErrorMessage(error);
        if (!message.includes('duplicate column')) {
          throw error;
        }
      }
    }
  }

  close(): void {
    this.db.close();
  }

  // ==================== TODOS ====================

  createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Todo {
    const id = randomUUID();
    const row = todoToRow({ ...todo, id });

    this.db.prepare(`
      INSERT INTO todos (
        id, title, description, priority, base_priority, urgency,
        request_date, due_date, deadline, source, source_id, source_url, source_urls,
        status, snoozed_until, stale_notified_at, fingerprint, tags, completed_at, archived_at,
        summary_id, summary_period, summary_item_id, category
      )
      VALUES (
        @id, @title, @description, @priority, @base_priority, @urgency,
        @request_date, @due_date, @deadline, @source, @source_id, @source_url, @source_urls,
        @status, @snoozed_until, @stale_notified_at, @fingerprint, @tags, @completed_at, @archived_at,
        @summary_id, @summary_period, @summary_item_id, @category
      )
    `).run(row);

    return this.getTodo(id)!;
  }

  getTodo(id: string): Todo | null {
    const row = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    return row ? todoRowToTodo(row) : null;
  }

  getTodoByFingerprint(fingerprint: string): Todo | null {
    const row = this.db
      .prepare('SELECT * FROM todos WHERE fingerprint = ? AND status NOT IN (?, ?)')
      .get(fingerprint, 'completed', 'archived') as TodoRow | undefined;
    return row ? todoRowToTodo(row) : null;
  }

  getTodoBySourceId(source: TodoSource, sourceId: string): Todo | null {
    const row = this.db
      .prepare('SELECT * FROM todos WHERE source = ? AND source_id = ?')
      .get(source, sourceId) as TodoRow | undefined;
    return row ? todoRowToTodo(row) : null;
  }

  listTodos(options: ListTodosOptions = {}): Todo[] {
    const {
      status,
      source,
      excludeSnoozed = false,
      onlySnoozed = false,
      onlyStale = false,
      staleDays = TODO_DEFAULTS.STALE_DAYS,
      updatedBefore,
      completedAfter,
      limit = 100,
      orderBy = 'priority',
      orderDirection,
      summaryId,
      summaryPeriod,
      category,
    } = options;

    let query = 'SELECT * FROM todos WHERE 1=1';
    const params: Record<string, unknown> = {};

    // Status filter (supports single or array)
    if (status) {
      if (Array.isArray(status)) {
        const placeholders = status.map((_, i) => `@status${i}`).join(', ');
        query += ` AND status IN (${placeholders})`;
        status.forEach((s, i) => {
          params[`status${i}`] = s;
        });
      } else {
        query += ' AND status = @status';
        params.status = status;
      }
    }

    // Source filter (supports single or array)
    if (source) {
      if (Array.isArray(source)) {
        const placeholders = source.map((_, i) => `@source${i}`).join(', ');
        query += ` AND source IN (${placeholders})`;
        source.forEach((s, i) => {
          params[`source${i}`] = s;
        });
      } else {
        query += ' AND source = @source';
        params.source = source;
      }
    }

    // Snooze filters
    if (excludeSnoozed) {
      query += " AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))";
    }
    if (onlySnoozed) {
      query += " AND snoozed_until IS NOT NULL AND snoozed_until > datetime('now')";
    }

    // Stale filter
    if (onlyStale) {
      query += ` AND status IN ('pending', 'in_progress')`;
      query += ` AND updated_at < datetime('now', '-${staleDays} days')`;
      query += " AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))";
    }

    if (updatedBefore) {
      query += ' AND updated_at < @updatedBefore';
      params.updatedBefore = updatedBefore;
    }

    if (completedAfter) {
      query += ' AND completed_at >= @completedAfter';
      params.completedAfter = completedAfter;
    }

    // Summary integration filters
    if (summaryId) {
      query += ' AND summary_id = @summaryId';
      params.summaryId = summaryId;
    }
    if (summaryPeriod) {
      query += ' AND summary_period = @summaryPeriod';
      params.summaryPeriod = summaryPeriod;
    }
    if (category) {
      query += ' AND category = @category';
      params.category = category;
    }

    // Determine order direction
    const dir = orderDirection ?? (orderBy === 'priority' || orderBy === 'urgency' ? 'ASC' : 'DESC');
    query += ` ORDER BY ${orderBy} ${dir}`;
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
    if (updates.basePriority !== undefined) {
      fields.push('base_priority = @base_priority');
      params.base_priority = updates.basePriority;
    }
    if (updates.urgency !== undefined) {
      fields.push('urgency = @urgency');
      params.urgency = updates.urgency;
    }
    if (updates.requestDate !== undefined) {
      fields.push('request_date = @request_date');
      params.request_date = updates.requestDate;
    }
    if (updates.dueDate !== undefined) {
      fields.push('due_date = @due_date');
      params.due_date = updates.dueDate;
    }
    if (updates.deadline !== undefined) {
      fields.push('deadline = @deadline');
      params.deadline = updates.deadline;
    }
    if (updates.sourceUrl !== undefined) {
      fields.push('source_url = @source_url');
      params.source_url = updates.sourceUrl;
    }
    if (updates.sourceUrls !== undefined) {
      fields.push('source_urls = @source_urls');
      params.source_urls = updates.sourceUrls ? JSON.stringify(updates.sourceUrls) : null;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      params.status = updates.status;
    }
    if (updates.snoozedUntil !== undefined) {
      fields.push('snoozed_until = @snoozed_until');
      params.snoozed_until = updates.snoozedUntil;
    }
    if (updates.staleNotifiedAt !== undefined) {
      fields.push('stale_notified_at = @stale_notified_at');
      params.stale_notified_at = updates.staleNotifiedAt;
    }
    if (updates.fingerprint !== undefined) {
      fields.push('fingerprint = @fingerprint');
      params.fingerprint = updates.fingerprint;
    }
    if (updates.tags !== undefined) {
      fields.push('tags = @tags');
      params.tags = updates.tags ? JSON.stringify(updates.tags) : null;
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = @completed_at');
      params.completed_at = updates.completedAt;
    }
    if (updates.archivedAt !== undefined) {
      fields.push('archived_at = @archived_at');
      params.archived_at = updates.archivedAt;
    }
    // Summary integration fields
    if (updates.summaryId !== undefined) {
      fields.push('summary_id = @summary_id');
      params.summary_id = updates.summaryId;
    }
    if (updates.summaryPeriod !== undefined) {
      fields.push('summary_period = @summary_period');
      params.summary_period = updates.summaryPeriod;
    }
    if (updates.summaryItemId !== undefined) {
      fields.push('summary_item_id = @summary_item_id');
      params.summary_item_id = updates.summaryItemId;
    }
    if (updates.category !== undefined) {
      fields.push('category = @category');
      params.category = updates.category;
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }

    return this.getTodo(id);
  }

  completeTodo(id: string): Todo | null {
    const now = new Date().toISOString();
    return this.updateTodo(id, {
      status: 'completed',
      completedAt: now,
      snoozedUntil: undefined, // Clear snooze when completing
    });
  }

  snoozeTodo(id: string, until: string): Todo | null {
    return this.updateTodo(id, {
      snoozedUntil: until,
    });
  }

  unsnoozeTodo(id: string): Todo | null {
    return this.updateTodo(id, {
      snoozedUntil: undefined,
    });
  }

  archiveTodo(id: string): Todo | null {
    const now = new Date().toISOString();
    return this.updateTodo(id, {
      status: 'archived',
      archivedAt: now,
    });
  }

  getCompletedTodosForArchive(olderThanDays: number): Todo[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const rows = this.db
      .prepare(
        `SELECT * FROM todos
         WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND completed_at < ?
         ORDER BY completed_at ASC`
      )
      .all(cutoff.toISOString()) as TodoRow[];

    return rows.map(todoRowToTodo);
  }

  getStaleTodos(staleDays: number = TODO_DEFAULTS.STALE_DAYS): Todo[] {
    return this.listTodos({
      onlyStale: true,
      staleDays,
    });
  }

  deleteTodo(id: string): boolean {
    const result = this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return result.changes > 0;
  }

  bulkDeleteTodos(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const result = this.db.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).run(...ids);
    return result.changes;
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

  // ==================== SUMMARIES ====================

  createSummary(summary: Omit<StoredSummary, 'generatedAt'> & { generatedAt?: string }): StoredSummary {
    const row = summaryToRow(summary);

    this.db.prepare(`
      INSERT OR REPLACE INTO summaries (
        id, fidelity, period, start_date, end_date, file_path,
        source_summaries, stats, generated_at
      )
      VALUES (
        @id, @fidelity, @period, @start_date, @end_date, @file_path,
        @source_summaries, @stats, @generated_at
      )
    `).run(row);

    return this.getSummary(summary.id)!;
  }

  getSummary(id: string): StoredSummary | null {
    const row = this.db.prepare('SELECT * FROM summaries WHERE id = ?').get(id) as SummaryRow | undefined;
    return row ? summaryRowToSummary(row) : null;
  }

  getSummaryByPeriod(fidelity: SummaryFidelity, period: string): StoredSummary | null {
    const row = this.db
      .prepare('SELECT * FROM summaries WHERE fidelity = ? AND period = ?')
      .get(fidelity, period) as SummaryRow | undefined;
    return row ? summaryRowToSummary(row) : null;
  }

  listSummaries(options: {
    fidelity?: SummaryFidelity;
    startDateAfter?: string;
    startDateBefore?: string;
    limit?: number;
  } = {}): StoredSummary[] {
    const { fidelity, startDateAfter, startDateBefore, limit = 100 } = options;

    let query = 'SELECT * FROM summaries WHERE 1=1';
    const params: Record<string, unknown> = {};

    if (fidelity) {
      query += ' AND fidelity = @fidelity';
      params.fidelity = fidelity;
    }

    if (startDateAfter) {
      query += ' AND start_date >= @startDateAfter';
      params.startDateAfter = startDateAfter;
    }

    if (startDateBefore) {
      query += ' AND start_date <= @startDateBefore';
      params.startDateBefore = startDateBefore;
    }

    query += ' ORDER BY start_date DESC LIMIT @limit';
    params.limit = limit;

    const rows = this.db.prepare(query).all(params) as SummaryRow[];
    return rows.map(summaryRowToSummary);
  }

  deleteSummary(id: string): boolean {
    const result = this.db.prepare('DELETE FROM summaries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==================== SUMMARY-TODO LINKS ====================

  linkTodoToSummary(summaryId: string, todoId: string, createdBySummary: boolean = false): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO summary_todos (summary_id, todo_id, created_by_summary)
      VALUES (@summary_id, @todo_id, @created_by_summary)
    `).run({
      summary_id: summaryId,
      todo_id: todoId,
      created_by_summary: createdBySummary ? 1 : 0,
    });
  }

  unlinkTodoFromSummary(summaryId: string, todoId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM summary_todos WHERE summary_id = ? AND todo_id = ?')
      .run(summaryId, todoId);
    return result.changes > 0;
  }

  getTodosForSummary(summaryId: string): Todo[] {
    const rows = this.db.prepare(`
      SELECT t.* FROM todos t
      JOIN summary_todos st ON t.id = st.todo_id
      WHERE st.summary_id = ?
      ORDER BY t.priority ASC
    `).all(summaryId) as TodoRow[];

    return rows.map(todoRowToTodo);
  }

  getSummaryTodoLinks(summaryId: string): SummaryTodoLink[] {
    const rows = this.db
      .prepare('SELECT * FROM summary_todos WHERE summary_id = ?')
      .all(summaryId) as SummaryTodoRow[];

    return rows.map(summaryTodoRowToLink);
  }

  getTodoSummaryProgress(summaryPeriod: string): {
    created: number;
    completed: number;
    pending: number;
    inProgress: number;
  } {
    const todos = this.listTodos({ summaryPeriod, limit: 1000 });

    return {
      created: todos.length,
      completed: todos.filter(t => t.status === 'completed').length,
      pending: todos.filter(t => t.status === 'pending').length,
      inProgress: todos.filter(t => t.status === 'in_progress').length,
    };
  }
}
