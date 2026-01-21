/**
 * TODO Configuration Loader
 *
 * Loads configuration from todos/config.json with sensible defaults.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');
const CONFIG_PATH = join(PROJECT_ROOT, 'todos/config.json');

export interface TodoConfig {
  archiveAfterDays: number;
  retentionMonths: number;
  staleDays: number;
  notifications: {
    dayBefore: boolean;
    dayOf: boolean;
    overdue: boolean;
  };
  deduplication: {
    enabled: boolean;
    fuzzyThreshold: number;
  };
  collectors: {
    github: { enabled: boolean; reviewRequestsOnly: boolean };
    linear: { enabled: boolean; assignedOnly: boolean };
    email: { enabled: boolean; patterns: string[] };
    slack: { enabled: boolean; channels: string[] };
    googleDocs: { enabled: boolean; docIds: string[] };
    googleSlides: { enabled: boolean; presentationIds: string[] };
    notion: { enabled: boolean };
    humaans: { enabled: boolean };
    geminiNotes: { enabled: boolean };
  };
}

const DEFAULT_CONFIG: TodoConfig = {
  archiveAfterDays: 14,
  retentionMonths: 12,
  staleDays: 14,
  notifications: {
    dayBefore: true,
    dayOf: true,
    overdue: true,
  },
  deduplication: {
    enabled: true,
    fuzzyThreshold: 0.85,
  },
  collectors: {
    github: { enabled: true, reviewRequestsOnly: true },
    linear: { enabled: true, assignedOnly: true },
    email: {
      enabled: true,
      patterns: [
        'action required',
        'action needed',
        'please review',
        'awaiting your',
        'follow up',
        'follow-up',
      ],
    },
    slack: { enabled: true, channels: [] },
    googleDocs: { enabled: true, docIds: [] },
    googleSlides: { enabled: true, presentationIds: [] },
    notion: { enabled: true },
    humaans: { enabled: true },
    geminiNotes: { enabled: true },
  },
};

export function loadTodoConfig(): TodoConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  try {
    const fileContent = readFileSync(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(fileContent);
    return deepMerge(DEFAULT_CONFIG, userConfig);
  } catch (error) {
    console.warn(`Warning: Failed to load TODO config from ${CONFIG_PATH}:`, error);
    return DEFAULT_CONFIG;
  }
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

export function getCachePath(): string {
  return join(PROJECT_ROOT, 'todos/cache');
}

export function getArchivePath(): string {
  return join(PROJECT_ROOT, 'todos/archive');
}
