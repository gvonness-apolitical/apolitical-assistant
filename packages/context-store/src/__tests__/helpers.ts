/**
 * Context Store Test Helpers
 *
 * Utilities for testing the context store with in-memory SQLite.
 */

import { ContextStore } from '../store.js';

/**
 * Create a test store using in-memory SQLite.
 * This is fast and isolated - each test gets its own clean database.
 */
export function createTestStore(): ContextStore {
  return new ContextStore(':memory:');
}

/**
 * Test row types for direct database assertions
 */
export interface TestTodoRow {
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
  source_urls: string | null;
  status: string;
  snoozed_until: string | null;
  stale_notified_at: string | null;
  fingerprint: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
  summary_id: string | null;
  summary_period: string | null;
  summary_item_id: string | null;
  category: string | null;
}

export interface TestMeetingRow {
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

export interface TestCommunicationLogRow {
  id: string;
  channel: string;
  summary: string;
  importance: number;
  action_required: number;
  logged_at: string;
}
