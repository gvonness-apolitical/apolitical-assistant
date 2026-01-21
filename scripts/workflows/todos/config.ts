/**
 * TODO Module Configuration
 *
 * Configuration loading and management for the TODOs module.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TodoConfigSchema, type TodoConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

export const DB_PATH = join(PROJECT_ROOT, 'context/store.db');
export const TODOS_DIR = join(PROJECT_ROOT, 'todos');
export const CONFIG_PATH = join(TODOS_DIR, 'config.json');
export const ARCHIVE_DIR = join(TODOS_DIR, 'archive');
export const CACHE_DIR = join(TODOS_DIR, 'cache');

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TodoConfig = {
  archiveAfterDays: 14,
  staleDays: 14,
  deduplication: {
    enabled: true,
    fuzzyThreshold: 0.85,
  },
  notifications: {
    dayBefore: true,
    dayOf: true,
    overdue: true,
  },
  autoCreateFromSummaries: true,
};

let cachedConfig: TodoConfig | null = null;

/**
 * Load TODO configuration from file
 */
export function loadTodoConfig(): TodoConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    // Create default config if it doesn't exist
    ensureDirectories();
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const result = TodoConfigSchema.safeParse(raw);

    if (!result.success) {
      console.warn('Invalid TODO config, using defaults:', result.error.message);
      cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }

    cachedConfig = result.data;
    return result.data;
  } catch (error) {
    console.warn('Error loading TODO config, using defaults:', error);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Save TODO configuration to file
 */
export function saveTodoConfig(config: TodoConfig): void {
  ensureDirectories();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

/**
 * Clear the cached configuration
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Ensure required directories exist
 */
export function ensureDirectories(): void {
  mkdirSync(TODOS_DIR, { recursive: true });
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Get the archive file path for a given date
 */
export function getArchiveFilePath(completedAt: string): string {
  const date = new Date(completedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return join(ARCHIVE_DIR, `${year}-${month}.json`);
}

/**
 * Get paths for the module
 */
export function getPaths() {
  return {
    projectRoot: PROJECT_ROOT,
    dbPath: DB_PATH,
    todosDir: TODOS_DIR,
    configPath: CONFIG_PATH,
    archiveDir: ARCHIVE_DIR,
    cacheDir: CACHE_DIR,
  };
}
