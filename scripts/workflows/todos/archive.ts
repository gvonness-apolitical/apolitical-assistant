/**
 * TODO Archival
 *
 * Archive completed TODOs to monthly JSON files.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import type { Todo } from '@apolitical-assistant/shared';
import { ContextStore } from '@apolitical-assistant/context-store';
import { DB_PATH, ARCHIVE_DIR, loadTodoConfig, ensureDirectories, getArchiveFilePath } from './config.js';

/**
 * Archive file structure
 */
interface ArchiveFile {
  month: string;
  archivedAt: string;
  todos: Todo[];
}

/**
 * Result of an archive operation
 */
export interface ArchiveResult {
  archivedCount: number;
  byMonth: Map<string, number>;
  errors: string[];
}

/**
 * Load an archive file
 */
function loadArchiveFile(filePath: string): ArchiveFile {
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      // If file is corrupted or empty, start fresh
    }
  }

  const month = filePath.split('/').pop()?.replace('.json', '') || '';
  return {
    month,
    archivedAt: new Date().toISOString(),
    todos: [],
  };
}

/**
 * Save an archive file
 */
function saveArchiveFile(filePath: string, archive: ArchiveFile): void {
  archive.archivedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(archive, null, 2), 'utf-8');
}

/**
 * Get TODOs ready for archiving
 */
export function getTodosForArchive(days?: number): Todo[] {
  const config = loadTodoConfig();
  const archiveDays = days ?? config.archiveAfterDays;

  const store = new ContextStore(DB_PATH);
  try {
    return store.getCompletedTodosForArchive(archiveDays);
  } finally {
    store.close();
  }
}

/**
 * Archive completed TODOs
 */
export function archiveTodos(options: { days?: number; dryRun?: boolean } = {}): ArchiveResult {
  const config = loadTodoConfig();
  const archiveDays = options.days ?? config.archiveAfterDays;
  const result: ArchiveResult = {
    archivedCount: 0,
    byMonth: new Map(),
    errors: [],
  };

  // Ensure directories exist
  if (!options.dryRun) {
    ensureDirectories();
  }

  const store = new ContextStore(DB_PATH);
  try {
    // Get TODOs to archive
    const todosToArchive = store.getCompletedTodosForArchive(archiveDays);

    if (todosToArchive.length === 0) {
      return result;
    }

    // Group by archive file (month)
    const byMonth = new Map<string, Todo[]>();
    for (const todo of todosToArchive) {
      const filePath = getArchiveFilePath(todo.completedAt!);
      const existing = byMonth.get(filePath) || [];
      existing.push(todo);
      byMonth.set(filePath, existing);
    }

    // Process each month
    const archivedIds: string[] = [];

    for (const [filePath, todos] of byMonth) {
      const monthKey = filePath.split('/').pop()?.replace('.json', '') || 'unknown';

      if (!options.dryRun) {
        // Load existing archive and append
        const archive = loadArchiveFile(filePath);

        // Check for duplicates (by ID)
        const existingIds = new Set(archive.todos.map((t) => t.id));
        const newTodos = todos.filter((t) => !existingIds.has(t.id));

        if (newTodos.length > 0) {
          archive.todos.push(...newTodos);
          saveArchiveFile(filePath, archive);
          archivedIds.push(...newTodos.map((t) => t.id));
          result.byMonth.set(monthKey, newTodos.length);
        }
      } else {
        archivedIds.push(...todos.map((t) => t.id));
        result.byMonth.set(monthKey, todos.length);
      }
    }

    // Delete archived TODOs from the database
    if (!options.dryRun && archivedIds.length > 0) {
      const deleted = store.bulkDeleteTodos(archivedIds);
      result.archivedCount = deleted;
    } else {
      result.archivedCount = archivedIds.length;
    }

    return result;
  } finally {
    store.close();
  }
}

/**
 * List archived TODOs for a specific month
 */
export function listArchivedTodos(month: string): Todo[] {
  const filePath = `${ARCHIVE_DIR}/${month}.json`;
  const archive = loadArchiveFile(filePath);
  return archive.todos;
}

/**
 * Get all archive months
 */
export function getArchiveMonths(): string[] {
  try {
    const files = readdirSync(ARCHIVE_DIR) as string[];
    return files
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Search archived TODOs
 */
export function searchArchivedTodos(query: string): Array<Todo & { archiveMonth: string }> {
  const months = getArchiveMonths();
  const results: Array<Todo & { archiveMonth: string }> = [];
  const queryLower = query.toLowerCase();

  for (const month of months) {
    const todos = listArchivedTodos(month);
    for (const todo of todos) {
      if (
        todo.title.toLowerCase().includes(queryLower) ||
        todo.description?.toLowerCase().includes(queryLower)
      ) {
        results.push({ ...todo, archiveMonth: month });
      }
    }
  }

  return results;
}
