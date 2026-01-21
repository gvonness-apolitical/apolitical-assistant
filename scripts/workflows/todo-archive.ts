#!/usr/bin/env npx tsx

/**
 * TODO Archive Script
 *
 * Archives completed TODOs older than a configurable number of days.
 * Completed TODOs are moved to monthly JSON files in todos/archive/.
 *
 * Usage:
 *   npm run todos:archive              # Archive TODOs completed 14+ days ago
 *   npm run todos:archive -- --days=7  # Archive TODOs completed 7+ days ago
 *   npm run todos:archive -- --dry-run # Show what would be archived
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ContextStore } from '@apolitical-assistant/context-store';
import type { Todo } from '@apolitical-assistant/shared';
import { loadTodoConfig } from './collectors/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'context/store.db');
const ARCHIVE_DIR = join(PROJECT_ROOT, 'todos/archive');

interface ArchiveOptions {
  days: number;
  dryRun: boolean;
  verbose: boolean;
}

interface ArchiveFile {
  month: string;
  archivedAt: string;
  todos: Todo[];
}

function parseArgs(): ArchiveOptions {
  const args = process.argv.slice(2);
  const config = loadTodoConfig();

  const options: ArchiveOptions = {
    days: config.archiveAfterDays,
    dryRun: false,
    verbose: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

function getArchiveFilename(completedAt: string): string {
  const date = new Date(completedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}.json`;
}

function loadArchiveFile(filename: string): ArchiveFile {
  const filePath = join(ARCHIVE_DIR, filename);

  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      // If file is corrupted or empty, start fresh
    }
  }

  const month = filename.replace('.json', '');
  return {
    month,
    archivedAt: new Date().toISOString(),
    todos: [],
  };
}

function saveArchiveFile(filename: string, archive: ArchiveFile): void {
  const filePath = join(ARCHIVE_DIR, filename);
  archive.archivedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(archive, null, 2), 'utf-8');
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log(`Archiving TODOs completed more than ${options.days} days ago...`);

  if (options.dryRun) {
    console.log('(Dry run - no changes will be made)\n');
  }

  // Ensure archive directory exists
  if (!options.dryRun) {
    mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const store = new ContextStore(DB_PATH);

  try {
    // Get completed TODOs older than the threshold
    const todosToArchive = store.getCompletedTodosForArchive(options.days);

    if (todosToArchive.length === 0) {
      console.log('No TODOs to archive.');
      return;
    }

    console.log(`Found ${todosToArchive.length} TODO${todosToArchive.length !== 1 ? 's' : ''} to archive.\n`);

    // Group by archive file (month)
    const byMonth = new Map<string, Todo[]>();
    for (const todo of todosToArchive) {
      const filename = getArchiveFilename(todo.completedAt!);
      const existing = byMonth.get(filename) || [];
      existing.push(todo);
      byMonth.set(filename, existing);
    }

    // Process each month
    const archivedIds: string[] = [];

    for (const [filename, todos] of byMonth) {
      if (options.verbose || options.dryRun) {
        console.log(`\n${filename}:`);
        for (const todo of todos) {
          console.log(`  - ${todo.title}`);
        }
      }

      if (!options.dryRun) {
        // Load existing archive and append
        const archive = loadArchiveFile(filename);

        // Check for duplicates (by ID)
        const existingIds = new Set(archive.todos.map((t) => t.id));
        const newTodos = todos.filter((t) => !existingIds.has(t.id));

        if (newTodos.length > 0) {
          archive.todos.push(...newTodos);
          saveArchiveFile(filename, archive);
          archivedIds.push(...newTodos.map((t) => t.id));
        }
      } else {
        archivedIds.push(...todos.map((t) => t.id));
      }
    }

    // Delete archived TODOs from the database
    if (!options.dryRun && archivedIds.length > 0) {
      const deleted = store.bulkDeleteTodos(archivedIds);
      console.log(`\nArchived and removed ${deleted} TODO${deleted !== 1 ? 's' : ''} from database.`);
    } else if (options.dryRun) {
      console.log(`\nWould archive ${archivedIds.length} TODO${archivedIds.length !== 1 ? 's' : ''}.`);
    }

    // Show archive location
    if (!options.dryRun) {
      console.log(`Archive location: ${ARCHIVE_DIR}`);
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
