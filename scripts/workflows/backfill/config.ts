/**
 * Backfill Configuration
 *
 * Configuration management for the backfill infrastructure.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBackfillConfig, getProjectRoot } from '../config/load.js';
import type { BackfillProgress, BackfillProgressEntry } from './types.js';
import type { CollectorSource } from '../config/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = getProjectRoot();

/**
 * Get path to backfill progress file
 */
export function getProgressPath(): string {
  return join(PROJECT_ROOT, 'collected/backfill-progress.json');
}

/**
 * Get path to collected items cache
 */
export function getCollectedCachePath(): string {
  return join(PROJECT_ROOT, 'collected/cache');
}

/**
 * Get path to audit log
 */
export function getAuditLogPath(): string {
  return join(PROJECT_ROOT, 'collected/audit.jsonl');
}

/**
 * Load backfill progress
 */
export function loadProgress(): BackfillProgress {
  const progressPath = getProgressPath();

  if (!existsSync(progressPath)) {
    return {};
  }

  try {
    const content = readFileSync(progressPath, 'utf-8');
    return JSON.parse(content) as BackfillProgress;
  } catch {
    return {};
  }
}

/**
 * Save backfill progress
 */
export function saveProgress(progress: BackfillProgress): void {
  const progressPath = getProgressPath();
  mkdirSync(dirname(progressPath), { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
}

/**
 * Update progress for a single source
 */
export function updateProgress(
  source: CollectorSource,
  update: Partial<BackfillProgressEntry>
): void {
  const progress = loadProgress();
  const existing = progress[source] ?? {
    lastCompletedDate: '',
    itemsCollected: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  progress[source] = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };

  saveProgress(progress);
}

/**
 * Get the from date for a source (considering overrides and progress)
 */
export function getSourceFromDate(source: CollectorSource, options?: { resume?: boolean }): string {
  const config = loadBackfillConfig();

  // If resuming, check progress
  if (options?.resume) {
    const progress = loadProgress();
    if (progress[source]?.lastCompletedDate) {
      // Start from day after last completed
      const lastDate = new Date(progress[source].lastCompletedDate);
      lastDate.setDate(lastDate.getDate() + 1);
      return lastDate.toISOString().split('T')[0];
    }
  }

  // Check for source-specific override
  const sourceConfig = config.sources?.[source];
  if (sourceConfig?.fromDate) {
    return sourceConfig.fromDate;
  }

  // Use default
  return config.defaultFromDate;
}

/**
 * Check if a source is enabled for backfill
 */
export function isSourceEnabledForBackfill(source: CollectorSource): boolean {
  const config = loadBackfillConfig();
  const sourceConfig = config.sources?.[source];
  return sourceConfig?.enabled ?? true;
}

/**
 * Get batch size for a source
 */
export function getSourceBatchSize(source: CollectorSource): number {
  const config = loadBackfillConfig();
  const sourceConfig = config.sources?.[source];
  return sourceConfig?.batchSize ?? 100;
}

/**
 * Get delay between collectors (ms)
 */
export function getDelayBetweenCollectors(): number {
  const config = loadBackfillConfig();
  return config.delayBetweenCollectors;
}

/**
 * Get delay between chunks (ms)
 */
export function getDelayBetweenChunks(): number {
  const config = loadBackfillConfig();
  return config.delayBetweenChunks;
}

/**
 * Get max retries
 */
export function getMaxRetries(): number {
  const config = loadBackfillConfig();
  return config.maxRetries;
}

/**
 * Get retry delay (ms)
 */
export function getRetryDelay(): number {
  const config = loadBackfillConfig();
  return config.retryDelay;
}

/**
 * Get chunk size setting
 */
export function getChunkSize(): 'day' | 'week' | 'month' {
  const config = loadBackfillConfig();
  return config.chunkSize;
}

/**
 * Append an audit entry
 */
export function appendAuditEntry(entry: {
  action: 'generate' | 'regenerate' | 'backfill';
  target: string;
  triggeredBy: 'manual' | 'scheduled' | 'dependency';
  result?: 'success' | 'partial' | 'failed';
  outputPath?: string;
}): string {
  const auditPath = getAuditLogPath();
  mkdirSync(dirname(auditPath), { recursive: true });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditEntry = {
    id,
    ...entry,
    startedAt: new Date().toISOString(),
    completedAt: entry.result ? new Date().toISOString() : undefined,
  };

  const line = JSON.stringify(auditEntry) + '\n';

  if (existsSync(auditPath)) {
    appendFileSync(auditPath, line, 'utf-8');
  } else {
    writeFileSync(auditPath, line, 'utf-8');
  }

  return id;
}
