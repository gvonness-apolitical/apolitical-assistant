/**
 * Configuration Loading Utilities
 *
 * Provides configuration loading with validation.
 */

import { readFileSync } from 'node:fs';
import { getProjectRoot, SUMMARIES_CONFIG_PATH } from '@apolitical-assistant/shared';
import { loadConfig, SummaryConfigSchema, type SummaryConfig } from './schemas.js';

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
