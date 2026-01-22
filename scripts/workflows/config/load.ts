/**
 * Configuration Loading Utilities
 *
 * Provides unified configuration loading with validation for all modules.
 */

import { readFileSync, existsSync } from 'node:fs';
import {
  getProjectRoot,
  getPath,
  COLLECTORS_CONFIG_PATH,
  BACKFILL_CONFIG_PATH,
  SUMMARIES_CONFIG_PATH,
  MEETINGS_CONFIG_PATH,
  EMAIL_TRIAGE_CONFIG_PATH,
  BRIEFINGS_CONFIG_PATH,
} from '@apolitical-assistant/shared';
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

// Re-export path utilities from shared for backwards compatibility
export { getProjectRoot, getPath };

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
  return loadConfig(COLLECTORS_CONFIG_PATH, CollectorsConfigSchema, readFile);
}

/**
 * Load backfill configuration
 */
export function loadBackfillConfig(): BackfillConfig {
  // Return default if file doesn't exist
  if (!existsSync(BACKFILL_CONFIG_PATH)) {
    return BackfillConfigSchema.parse({
      defaultFromDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  return loadConfig(BACKFILL_CONFIG_PATH, BackfillConfigSchema, readFile);
}

/**
 * Load summary configuration
 */
export function loadSummaryConfig(): SummaryConfig {
  return loadConfig(SUMMARIES_CONFIG_PATH, SummaryConfigSchema, readFile);
}

/**
 * Load meeting configuration
 */
export function loadMeetingConfig(): MeetingConfig {
  return loadConfig(MEETINGS_CONFIG_PATH, MeetingConfigSchema, readFile);
}

/**
 * Load email triage configuration
 */
export function loadEmailTriageConfig(): EmailTriageConfig {
  return loadConfig(EMAIL_TRIAGE_CONFIG_PATH, EmailTriageConfigSchema, readFile);
}

/**
 * Load briefing configuration
 */
export function loadBriefingConfig(): BriefingConfig {
  return loadConfig(BRIEFINGS_CONFIG_PATH, BriefingConfigSchema, readFile);
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}
