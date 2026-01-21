/**
 * Configuration Loading Utilities
 *
 * Provides unified configuration loading with validation for all modules.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadConfig,
  BackfillConfigSchema,
  SummaryConfigSchema,
  MeetingConfigSchema,
  EmailTriageConfigSchema,
  BriefingConfigSchema,
  CollectorsConfigSchema,
  type BackfillConfig,
  type SummaryConfig,
  type MeetingConfig,
  type EmailTriageConfig,
  type BriefingConfig,
  type CollectorsConfig,
} from './schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

/**
 * Read a file from the filesystem
 */
function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

/**
 * Load collectors configuration
 */
export function loadCollectorsConfig(): CollectorsConfig {
  const configPath = join(PROJECT_ROOT, 'scripts/workflows/config/collectors.json');
  return loadConfig(configPath, CollectorsConfigSchema, readFile);
}

/**
 * Load backfill configuration
 */
export function loadBackfillConfig(): BackfillConfig {
  const configPath = join(PROJECT_ROOT, 'backfill/config.json');

  // Return default if file doesn't exist
  if (!existsSync(configPath)) {
    return BackfillConfigSchema.parse({
      defaultFromDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  return loadConfig(configPath, BackfillConfigSchema, readFile);
}

/**
 * Load summary configuration
 */
export function loadSummaryConfig(): SummaryConfig {
  const configPath = join(PROJECT_ROOT, 'summaries/config.json');
  return loadConfig(configPath, SummaryConfigSchema, readFile);
}

/**
 * Load meeting configuration
 */
export function loadMeetingConfig(): MeetingConfig {
  const configPath = join(PROJECT_ROOT, 'meetings/config.json');
  return loadConfig(configPath, MeetingConfigSchema, readFile);
}

/**
 * Load email triage configuration
 */
export function loadEmailTriageConfig(): EmailTriageConfig {
  const configPath = join(PROJECT_ROOT, 'email/config.json');
  return loadConfig(configPath, EmailTriageConfigSchema, readFile);
}

/**
 * Load briefing configuration
 */
export function loadBriefingConfig(): BriefingConfig {
  const configPath = join(PROJECT_ROOT, 'briefings/config.json');
  return loadConfig(configPath, BriefingConfigSchema, readFile);
}

/**
 * Get a path relative to project root
 */
export function getPath(...parts: string[]): string {
  return join(PROJECT_ROOT, ...parts);
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}
