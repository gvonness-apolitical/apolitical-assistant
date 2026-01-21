/**
 * Summary Configuration
 *
 * Configuration management for the summaries module.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadSummaryConfig, getProjectRoot } from '../config/load.js';
import type { SummaryFidelity, SummaryDocument } from './types.js';

const PROJECT_ROOT = getProjectRoot();

/**
 * Get path to summary archive directory
 */
export function getArchivePath(fidelity?: SummaryFidelity): string {
  const config = loadSummaryConfig();
  const basePath = join(PROJECT_ROOT, config.archivePath);

  if (fidelity) {
    return join(basePath, fidelity);
  }

  return basePath;
}

/**
 * Get path to summary cache directory
 */
export function getCachePath(): string {
  const config = loadSummaryConfig();
  return join(PROJECT_ROOT, config.cachePath);
}

/**
 * Get the summary file path for a period
 */
export function getSummaryFilePath(fidelity: SummaryFidelity, period: string): string {
  return join(getArchivePath(fidelity), `${period}.md`);
}

/**
 * Get the summary JSON file path for a period
 */
export function getSummaryJsonPath(fidelity: SummaryFidelity, period: string): string {
  return join(getArchivePath(fidelity), `${period}.json`);
}

/**
 * Check if a summary exists
 */
export function summaryExists(fidelity: SummaryFidelity, period: string): boolean {
  return existsSync(getSummaryJsonPath(fidelity, period));
}

/**
 * Load a summary document
 */
export function loadSummary(fidelity: SummaryFidelity, period: string): SummaryDocument | null {
  const jsonPath = getSummaryJsonPath(fidelity, period);

  if (!existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content) as SummaryDocument;
  } catch {
    return null;
  }
}

/**
 * List all available summaries for a fidelity
 */
export function listSummaries(fidelity: SummaryFidelity): string[] {
  const archivePath = getArchivePath(fidelity);

  if (!existsSync(archivePath)) {
    return [];
  }

  return readdirSync(archivePath)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort()
    .reverse();
}

/**
 * Get retention period for a fidelity (in days, -1 = forever)
 */
export function getRetentionDays(fidelity: SummaryFidelity): number {
  const config = loadSummaryConfig();
  return config.retention?.[fidelity] ?? -1;
}

/**
 * Check if auto-create TODOs is enabled
 */
export function shouldAutoCreateTodos(): boolean {
  const config = loadSummaryConfig();
  return config.autoCreateTodos;
}

/**
 * Check if trend analysis is enabled
 */
export function shouldAnalyzeTrends(): boolean {
  const config = loadSummaryConfig();
  return config.trendsAnalysis;
}
