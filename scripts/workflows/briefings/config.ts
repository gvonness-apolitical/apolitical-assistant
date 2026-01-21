/**
 * Briefings Configuration
 *
 * Configuration management for briefings.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Briefing configuration schema
 */
export const BriefingsConfigSchema = z.object({
  // Output paths
  outputPath: z.string().default('output/briefings'),
  logsPath: z.string().default('logs'),

  // Morning briefing settings
  morning: z.object({
    sections: z.array(z.enum([
      'schedule',
      'communications',
      'incidents',
      'team',
      'todos',
      'quickActions',
    ])).default(['schedule', 'communications', 'incidents', 'team', 'todos', 'quickActions']),
    todoLimit: z.number().default(10),
    staleDays: z.number().default(14),
    includeMeetingPrep: z.boolean().default(true),
    includeEmailTriageStats: z.boolean().default(true),
  }).default({}),

  // EOD summary settings
  eod: z.object({
    sections: z.array(z.enum([
      'completed',
      'inProgress',
      'blockers',
      'tomorrow',
    ])).default(['completed', 'inProgress', 'blockers', 'tomorrow']),
    lookbackHours: z.number().default(12),
  }).default({}),

  // Weekly review settings
  weekly: z.object({
    sections: z.array(z.enum([
      'highlights',
      'metrics',
      'incidents',
      'teamUpdates',
      'nextWeek',
    ])).default(['highlights', 'metrics', 'incidents', 'teamUpdates', 'nextWeek']),
    includeSummary: z.boolean().default(true),
    includeTeamMetrics: z.boolean().default(true),
  }).default({}),

  // Notification settings
  notifications: z.object({
    enabled: z.boolean().default(true),
    sound: z.boolean().default(true),
  }).default({}),
});

export type BriefingsConfig = z.infer<typeof BriefingsConfigSchema>;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BriefingsConfig = {
  outputPath: 'output/briefings',
  logsPath: 'logs',
  morning: {
    sections: ['schedule', 'communications', 'incidents', 'team', 'todos', 'quickActions'],
    todoLimit: 10,
    staleDays: 14,
    includeMeetingPrep: true,
    includeEmailTriageStats: true,
  },
  eod: {
    sections: ['completed', 'inProgress', 'blockers', 'tomorrow'],
    lookbackHours: 12,
  },
  weekly: {
    sections: ['highlights', 'metrics', 'incidents', 'teamUpdates', 'nextWeek'],
    includeSummary: true,
    includeTeamMetrics: true,
  },
  notifications: {
    enabled: true,
    sound: true,
  },
};

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return join(PROJECT_ROOT, 'briefings/config.json');
}

/**
 * Get output directory path
 */
export function getOutputPath(): string {
  const config = loadBriefingsConfig();
  return join(PROJECT_ROOT, config.outputPath);
}

/**
 * Get logs directory path
 */
export function getLogsPath(): string {
  const config = loadBriefingsConfig();
  return join(PROJECT_ROOT, config.logsPath);
}

/**
 * Get database path
 */
export function getDatabasePath(): string {
  return join(PROJECT_ROOT, 'context/store.db');
}

/**
 * Load briefings configuration
 */
export function loadBriefingsConfig(): BriefingsConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return BriefingsConfigSchema.parse(raw);
  } catch (error) {
    console.warn('Failed to load briefings config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save briefings configuration
 */
export function saveBriefingsConfig(config: BriefingsConfig): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Ensure output directories exist
 */
export function ensureDirectories(): void {
  const outputPath = getOutputPath();
  const logsPath = getLogsPath();

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  if (!existsSync(logsPath)) {
    mkdirSync(logsPath, { recursive: true });
  }
}

/**
 * Get briefing file path for a date
 */
export function getBriefingFilePath(type: 'morning' | 'eod' | 'weekly', date: string): string {
  const outputPath = getOutputPath();
  return join(outputPath, `${type}-${date}.md`);
}

/**
 * Get log file path for a briefing
 */
export function getLogFilePath(type: 'morning' | 'eod' | 'weekly', timestamp: string): string {
  const logsPath = getLogsPath();
  return join(logsPath, `${type}-${timestamp}.log`);
}
