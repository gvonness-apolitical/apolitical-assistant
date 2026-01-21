/**
 * Backfill Module
 *
 * Master backfill orchestrator for populating historical data.
 */

import type { CollectorSource } from '../config/schemas.js';
import type { BackfillOptions, BackfillResult, BackfillProgress } from './types.js';
import {
  loadProgress,
  saveProgress,
  getSourceFromDate,
  isSourceEnabledForBackfill,
  getDelayBetweenCollectors,
  getDelayBetweenChunks,
  getChunkSize,
  appendAuditEntry,
} from './config.js';
import { backfillSource } from './collector-backfill.js';
import { delay } from '../shared/parallel.js';

/**
 * All available collector sources
 */
const ALL_SOURCES: CollectorSource[] = [
  'email',
  'slack',
  'github',
  'linear',
  'notion',
  'google-docs',
  'google-slides',
  'humaans',
  'incident-io',
  'gemini-notes',
  'dev-analytics',
  'calendar',
];

/**
 * Run a full backfill across all enabled sources
 */
export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const startTime = Date.now();
  const toDate = options.toDate ?? new Date().toISOString().split('T')[0];

  // Determine which sources to backfill
  const sources = (options.sources as CollectorSource[]) ?? ALL_SOURCES;
  const enabledSources = sources.filter(isSourceEnabledForBackfill);

  if (options.verbose) {
    console.log(`\n=== Backfill Starting ===`);
    console.log(`From: ${options.fromDate}`);
    console.log(`To: ${toDate}`);
    console.log(`Sources: ${enabledSources.join(', ')}`);
    console.log(`Chunk size: ${getChunkSize()}`);
    console.log(`Dry run: ${options.dryRun ?? false}`);
    console.log(`Resume: ${options.resume ?? false}`);
    console.log('');
  }

  // Start audit entry
  const _auditId = appendAuditEntry({
    action: 'backfill',
    target: `${options.fromDate}:${toDate}:${enabledSources.join(',')}`,
    triggeredBy: 'manual',
  });

  const allResults: BackfillResult['chunkResults'] = [];
  let totalItems = 0;
  let totalErrors = 0;

  // Process each source
  for (const source of enabledSources) {
    // Get the from date for this source (considering overrides and progress)
    const sourceFromDate = options.resume
      ? getSourceFromDate(source, { resume: true })
      : options.fromDate;

    // Skip if already caught up
    if (new Date(sourceFromDate) >= new Date(toDate)) {
      if (options.verbose) {
        console.log(`[${source}] Already up to date, skipping`);
      }
      continue;
    }

    if (options.verbose) {
      console.log(`\n[${source}] Starting backfill from ${sourceFromDate}...`);
    }

    const results = await backfillSource(source, sourceFromDate, toDate, {
      chunkSize: getChunkSize(),
      delayMs: getDelayBetweenChunks(),
      verbose: options.verbose,
      dryRun: options.dryRun,
    });

    allResults.push(...results);

    for (const result of results) {
      totalItems += result.itemsCollected;
      totalErrors += result.errors.length;
    }

    // Delay between collectors
    if (enabledSources.indexOf(source) < enabledSources.length - 1) {
      await delay(options.delayMs ?? getDelayBetweenCollectors());
    }
  }

  const durationMs = Date.now() - startTime;
  const progress = loadProgress();

  // Complete audit entry
  appendAuditEntry({
    action: 'backfill',
    target: `${options.fromDate}:${toDate}:${enabledSources.join(',')}`,
    triggeredBy: 'manual',
    result: totalErrors > 0 ? 'partial' : 'success',
  });

  if (options.verbose) {
    console.log(`\n=== Backfill Complete ===`);
    console.log(`Total items: ${totalItems}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
  }

  return {
    totalItems,
    totalErrors,
    durationMs,
    chunkResults: allResults,
    progress,
  };
}

/**
 * Get backfill status
 */
export function getBackfillStatus(): BackfillProgress {
  return loadProgress();
}

/**
 * Reset backfill progress for a source
 */
export function resetBackfillProgress(source?: CollectorSource): void {
  if (source) {
    const progress = loadProgress();
    delete progress[source];
    saveProgress(progress);
  } else {
    saveProgress({});
  }
}

export * from './types.js';
export * from './config.js';
export * from './collector-backfill.js';
