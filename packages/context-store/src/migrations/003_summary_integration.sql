-- Summary Integration for TODOs
-- Migration 003: Add summary linking fields and category

-- Add summary integration columns
ALTER TABLE todos ADD COLUMN summary_id TEXT;           -- Linked summary that created this TODO
ALTER TABLE todos ADD COLUMN summary_period TEXT;       -- Period of source summary (e.g., "2025-01-15")
ALTER TABLE todos ADD COLUMN summary_item_id TEXT;      -- ID of the summary item this TODO was created from
ALTER TABLE todos ADD COLUMN category TEXT CHECK (category IN ('engineering', 'management', 'business'));

-- Add indexes for summary lookups
CREATE INDEX IF NOT EXISTS idx_todos_summary_id ON todos(summary_id);
CREATE INDEX IF NOT EXISTS idx_todos_summary_period ON todos(summary_period);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category);

-- Create summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  fidelity TEXT NOT NULL CHECK (fidelity IN ('daily', 'weekly', 'monthly', 'quarterly', 'h1-h2', 'yearly')),
  period TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  file_path TEXT NOT NULL,
  source_summaries TEXT,              -- JSON array of source summary IDs
  stats TEXT NOT NULL,                -- JSON object with statistics
  generated_at TEXT NOT NULL,
  UNIQUE(fidelity, period)
);

CREATE INDEX IF NOT EXISTS idx_summaries_fidelity ON summaries(fidelity);
CREATE INDEX IF NOT EXISTS idx_summaries_period ON summaries(period);
CREATE INDEX IF NOT EXISTS idx_summaries_start_date ON summaries(start_date);

-- Create summary-todo links table for tracking relationships
CREATE TABLE IF NOT EXISTS summary_todos (
  summary_id TEXT NOT NULL,
  todo_id TEXT NOT NULL,
  created_by_summary INTEGER DEFAULT 0,  -- Was TODO created by this summary?
  PRIMARY KEY (summary_id, todo_id),
  FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- Track migration version
INSERT OR IGNORE INTO schema_migrations (version) VALUES (3);
