-- Enhanced TODO schema for comprehensive task management
-- Migration 002: Add request dates, deadlines, snooze, archive, and deduplication support

-- Add new columns to todos table
ALTER TABLE todos ADD COLUMN request_date TEXT;
ALTER TABLE todos ADD COLUMN deadline TEXT;
ALTER TABLE todos ADD COLUMN urgency INTEGER DEFAULT 3 CHECK (urgency >= 1 AND urgency <= 5);
ALTER TABLE todos ADD COLUMN base_priority INTEGER DEFAULT 3;
ALTER TABLE todos ADD COLUMN source_url TEXT;
ALTER TABLE todos ADD COLUMN source_urls TEXT;          -- JSON array for merged duplicates
ALTER TABLE todos ADD COLUMN completed_at TEXT;
ALTER TABLE todos ADD COLUMN archived_at TEXT;
ALTER TABLE todos ADD COLUMN snoozed_until TEXT;
ALTER TABLE todos ADD COLUMN stale_notified_at TEXT;
ALTER TABLE todos ADD COLUMN tags TEXT;                 -- JSON array
ALTER TABLE todos ADD COLUMN fingerprint TEXT;          -- For deduplication

-- Add index for new columns
CREATE INDEX IF NOT EXISTS idx_todos_deadline ON todos(deadline);
CREATE INDEX IF NOT EXISTS idx_todos_urgency ON todos(urgency);
CREATE INDEX IF NOT EXISTS idx_todos_snoozed_until ON todos(snoozed_until);
CREATE INDEX IF NOT EXISTS idx_todos_fingerprint ON todos(fingerprint);
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);
CREATE INDEX IF NOT EXISTS idx_todos_archived_at ON todos(archived_at);

-- Update status constraint to include 'archived'
-- Note: SQLite doesn't support ALTER CONSTRAINT, so we need to work with the existing constraint
-- The application layer will handle the 'archived' status validation

-- Track migration version
INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
