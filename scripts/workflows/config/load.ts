/**
 * Configuration Loading Utilities
 *
 * Provides configuration loading with validation.
 */

import { readFileSync } from 'node:fs';
import {
  getProjectRoot,
  SUMMARIES_CONFIG_PATH,
  BACKFILL_CONFIG_PATH,
} from '@apolitical-assistant/shared';
import {
  loadConfig,
  SummaryConfigSchema,
  BackfillConfigSchema,
  type SummaryConfig,
  type BackfillConfig,
} from './schemas.js';

// Re-export path utilities from shared for backwards compatibility
export { getProjectRoot };

/**
 * Read a file from the filesystem
 */
function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

/**
 * Load summary configuration
 */
export function loadSummaryConfig(): SummaryConfig {
  return loadConfig(SUMMARIES_CONFIG_PATH, SummaryConfigSchema, readFile);
}

/**
 * Load backfill configuration
 */
export function loadBackfillConfig(): BackfillConfig {
  return loadConfig(BACKFILL_CONFIG_PATH, BackfillConfigSchema, readFile);
}
