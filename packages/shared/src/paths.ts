/**
 * Centralized Path Definitions
 *
 * All data directory paths are defined here to ensure consistency
 * across the codebase and make migration easier.
 *
 * Directory Structure:
 *   /data/
 *     /cache/       - Runtime caches (collected, task-helper)
 *     /output/      - Generated files (briefings, summaries, meetings)
 *     /store/       - Persistent data (context.db, todos)
 *     /config/      - User configuration (email rules)
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root is determined relative to this file's location
// packages/shared/src/paths.ts -> ../../.. = project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

/**
 * Get a path relative to project root
 */
export function getPath(...parts: string[]): string {
  return join(PROJECT_ROOT, ...parts);
}

// =============================================================================
// Data Directory Paths
// =============================================================================

/**
 * Base data directory
 */
export const DATA_DIR = join(PROJECT_ROOT, 'data');

// -----------------------------------------------------------------------------
// Cache Paths - Runtime caches that can be deleted safely
// -----------------------------------------------------------------------------

export const CACHE_DIR = join(DATA_DIR, 'cache');

/** Collected items cache directory */
export const COLLECTED_CACHE_DIR = join(CACHE_DIR, 'collected');

/** Task helper cache directory */
export const TASK_HELPER_CACHE_DIR = join(CACHE_DIR, 'task-helper');

/** Todo collector cache directory */
export const TODO_CACHE_DIR = join(CACHE_DIR, 'todos');

/** Todo reset state file */
export const TODO_RESET_STATE_PATH = join(CACHE_DIR, 'todo-reset-state.json');

// -----------------------------------------------------------------------------
// Output Paths - Generated files (briefings, summaries, meeting notes)
// -----------------------------------------------------------------------------

export const OUTPUT_DIR = join(DATA_DIR, 'output');

/** Briefings output directory */
export const BRIEFINGS_DIR = join(OUTPUT_DIR, 'briefings');

/** Summaries output directory */
export const SUMMARIES_DIR = join(OUTPUT_DIR, 'summaries');

/** Summaries archive directory */
export const SUMMARIES_ARCHIVE_DIR = join(SUMMARIES_DIR, 'archive');

/** Summaries cache directory */
export const SUMMARIES_CACHE_DIR = join(SUMMARIES_DIR, 'cache');

/** Meetings output directory */
export const MEETINGS_OUTPUT_DIR = join(OUTPUT_DIR, 'meetings');

// -----------------------------------------------------------------------------
// Store Paths - Persistent data (database, todos)
// -----------------------------------------------------------------------------

export const STORE_DIR = join(DATA_DIR, 'store');

/** SQLite database path */
export const DB_PATH = join(STORE_DIR, 'context.db');

/** Todos directory (for config and archive) */
export const TODOS_DIR = join(STORE_DIR, 'todos');

/** Todos archive directory */
export const TODOS_ARCHIVE_DIR = join(TODOS_DIR, 'archive');

// -----------------------------------------------------------------------------
// Config Paths - User configuration files
// -----------------------------------------------------------------------------

export const CONFIG_DIR = join(DATA_DIR, 'config');

/** Email configuration directory */
export const EMAIL_CONFIG_DIR = join(CONFIG_DIR, 'email');

/** Email rules directory */
export const EMAIL_RULES_DIR = join(EMAIL_CONFIG_DIR, 'rules');

/** Email feedback file */
export const EMAIL_FEEDBACK_PATH = join(EMAIL_CONFIG_DIR, 'feedback.jsonl');

// =============================================================================
// Config File Paths (outside /data - these are version controlled)
// =============================================================================

/** Collectors config */
export const COLLECTORS_CONFIG_PATH = join(PROJECT_ROOT, 'scripts/workflows/config/collectors.json');

/** Briefings config */
export const BRIEFINGS_CONFIG_PATH = join(CONFIG_DIR, 'briefings.json');

/** Summaries config */
export const SUMMARIES_CONFIG_PATH = join(CONFIG_DIR, 'summaries.json');

/** Meetings config */
export const MEETINGS_CONFIG_PATH = join(CONFIG_DIR, 'meetings.json');

/** Todos config */
export const TODOS_CONFIG_PATH = join(CONFIG_DIR, 'todos.json');

/** Email triage config */
export const EMAIL_TRIAGE_CONFIG_PATH = join(CONFIG_DIR, 'email.json');

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Ensure all data directories exist
 * Call this at application startup
 */
export function getDataDirectories(): string[] {
  return [
    DATA_DIR,
    CACHE_DIR,
    COLLECTED_CACHE_DIR,
    TASK_HELPER_CACHE_DIR,
    TODO_CACHE_DIR,
    OUTPUT_DIR,
    BRIEFINGS_DIR,
    SUMMARIES_DIR,
    SUMMARIES_ARCHIVE_DIR,
    SUMMARIES_CACHE_DIR,
    MEETINGS_OUTPUT_DIR,
    STORE_DIR,
    TODOS_DIR,
    TODOS_ARCHIVE_DIR,
    CONFIG_DIR,
    EMAIL_CONFIG_DIR,
    EMAIL_RULES_DIR,
  ];
}

/**
 * Get a dated output path for briefings
 */
export function getBriefingPath(date: string): string {
  return join(BRIEFINGS_DIR, `${date}.md`);
}

/**
 * Get a dated output path for summaries
 */
export function getSummaryPath(type: 'daily' | 'weekly' | 'monthly', dateOrPeriod: string): string {
  return join(SUMMARIES_DIR, type, `${dateOrPeriod}.md`);
}

/**
 * Get a meeting output path
 */
export function getMeetingPath(date: string, filename: string): string {
  return join(MEETINGS_OUTPUT_DIR, date, filename);
}

/**
 * Get monthly archive path for todos
 */
export function getTodoArchivePath(yearMonth: string): string {
  return join(TODOS_ARCHIVE_DIR, `${yearMonth}.json`);
}
