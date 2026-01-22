/**
 * Collector Backfill
 *
 * Per-collector backfill logic for gathering historical data.
 */

import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { toErrorMessage } from '@apolitical-assistant/shared';
import type { CollectorSource } from '../config/schemas.js';
import type {
  RawCollectedItem,
  BackfillChunkResult,
  DateChunk,
} from './types.js';
import { getCollectedCachePath, updateProgress } from './config.js';
import { delay, withRetry } from '../shared/parallel.js';
import { getMaxRetries, getRetryDelay } from './config.js';

// Import collectors
import { GitHubCollector } from '../collectors/github.js';
import { LinearCollector } from '../collectors/linear.js';
import { EmailCollector } from '../collectors/email.js';
import { SlackCollector } from '../collectors/slack.js';
import { GoogleDocsCollector } from '../collectors/google-docs.js';
import { GoogleSlidesCollector } from '../collectors/google-slides.js';
import { NotionCollector } from '../collectors/notion.js';
import { HumaansCollector } from '../collectors/humaans.js';
import { GeminiNotesCollector } from '../collectors/gemini-notes.js';
import { DevAnalyticsCollector } from '../collectors/dev-analytics.js';
import { CalendarCollector } from '../collectors/calendar.js';
import { IncidentIoCollector } from '../collectors/incident-io.js';

/**
 * Get collector instance for a source
 */
function getCollector(source: CollectorSource) {
  switch (source) {
    case 'github':
      return new GitHubCollector();
    case 'linear':
      return new LinearCollector();
    case 'email':
      return new EmailCollector();
    case 'slack':
      return new SlackCollector();
    case 'google-docs':
      return new GoogleDocsCollector();
    case 'google-slides':
      return new GoogleSlidesCollector();
    case 'notion':
      return new NotionCollector();
    case 'humaans':
      return new HumaansCollector();
    case 'gemini-notes':
      return new GeminiNotesCollector();
    case 'dev-analytics':
      return new DevAnalyticsCollector();
    case 'calendar':
      return new CalendarCollector();
    case 'incident-io':
      return new IncidentIoCollector();
    default:
      throw new Error(`Unknown collector source: ${source}`);
  }
}

/**
 * Chunk a date range into smaller pieces
 */
export function chunkDateRange(
  startDate: string,
  endDate: string,
  chunkSize: 'day' | 'week' | 'month'
): DateChunk[] {
  const chunks: DateChunk[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentStart = new Date(start);

  while (currentStart < end) {
    const currentEnd = new Date(currentStart);

    switch (chunkSize) {
      case 'day':
        currentEnd.setDate(currentEnd.getDate() + 1);
        break;
      case 'week':
        currentEnd.setDate(currentEnd.getDate() + 7);
        break;
      case 'month':
        currentEnd.setMonth(currentEnd.getMonth() + 1);
        break;
    }

    // Don't go past the end date
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime());
    }

    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0],
    });

    currentStart = new Date(currentEnd);
  }

  return chunks;
}

/**
 * Convert collector TODO items to raw collected items
 */
function convertToRawItems(
  source: CollectorSource,
  todos: Array<{
    title: string;
    description?: string;
    sourceId: string;
    sourceUrl?: string;
    requestDate?: string;
    tags?: string[];
  }>,
  dateRange: { start: string; end: string }
): RawCollectedItem[] {
  return todos.map((todo) => ({
    id: `${source}-${todo.sourceId}`,
    source,
    title: todo.title,
    content: todo.description,
    url: todo.sourceUrl,
    date: todo.requestDate ?? dateRange.start,
    metadata: { tags: todo.tags },
    flags: {
      isActionItem: true,
    },
  }));
}

/**
 * Save collected items to cache
 */
function saveToCache(source: CollectorSource, date: string, items: RawCollectedItem[]): void {
  const cacheDir = join(getCollectedCachePath(), source);
  mkdirSync(cacheDir, { recursive: true });

  const filePath = join(cacheDir, `${date}.json.gz`);
  const content = JSON.stringify(items);
  const compressed = gzipSync(Buffer.from(content, 'utf-8'));
  writeFileSync(filePath, compressed);
}

/**
 * Check if cache exists for a date
 */
function cacheExists(source: CollectorSource, date: string): boolean {
  const cacheDir = join(getCollectedCachePath(), source);
  const filePath = join(cacheDir, `${date}.json.gz`);
  return existsSync(filePath);
}

/**
 * Backfill a single source for a date chunk
 */
export async function backfillSourceChunk(
  source: CollectorSource,
  chunk: DateChunk,
  options?: { verbose?: boolean; dryRun?: boolean }
): Promise<BackfillChunkResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let itemsCollected = 0;

  if (options?.verbose) {
    console.log(`  [${source}] Backfilling ${chunk.start} to ${chunk.end}...`);
  }

  // Skip if we already have this data (unless forcing)
  if (cacheExists(source, chunk.start)) {
    if (options?.verbose) {
      console.log(`  [${source}] Cache exists for ${chunk.start}, skipping`);
    }
    return {
      source,
      dateRange: chunk,
      itemsCollected: 0,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  if (options?.dryRun) {
    console.log(`  [${source}] Would backfill ${chunk.start} to ${chunk.end}`);
    return {
      source,
      dateRange: chunk,
      itemsCollected: 0,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const collector = getCollector(source);

    if (!collector.isEnabled()) {
      if (options?.verbose) {
        console.log(`  [${source}] Collector not enabled, skipping`);
      }
      return {
        source,
        dateRange: chunk,
        itemsCollected: 0,
        errors: ['Collector not enabled'],
        durationMs: Date.now() - startTime,
      };
    }

    // Use retry logic for API calls
    const result = await withRetry(
      () => collector.collect({ verbose: options?.verbose }),
      {
        maxRetries: getMaxRetries(),
        baseDelayMs: getRetryDelay(),
        onRetry: (attempt, error) => {
          if (options?.verbose) {
            console.log(`  [${source}] Retry ${attempt}: ${error.message}`);
          }
        },
      }
    );

    // Convert to raw items and save
    const rawItems = convertToRawItems(source, result.todos, chunk);
    itemsCollected = rawItems.length;

    // Group items by date and save
    const itemsByDate = new Map<string, RawCollectedItem[]>();
    for (const item of rawItems) {
      const itemDate = item.date.split('T')[0];
      if (!itemsByDate.has(itemDate)) {
        itemsByDate.set(itemDate, []);
      }
      itemsByDate.get(itemDate)!.push(item);
    }

    for (const [date, items] of itemsByDate) {
      saveToCache(source, date, items);
    }

    // Also save empty file for the chunk start date if no items
    if (!itemsByDate.has(chunk.start)) {
      saveToCache(source, chunk.start, []);
    }

    // Update progress
    updateProgress(source, {
      lastCompletedDate: chunk.end,
      itemsCollected: itemsCollected + (result.errors.length > 0 ? 0 : itemsCollected),
      errors: errors.length + result.errors.length,
    });

    if (options?.verbose) {
      console.log(`  [${source}] Collected ${itemsCollected} items`);
    }
  } catch (error) {
    const errorMsg = toErrorMessage(error);
    errors.push(errorMsg);
    if (options?.verbose) {
      console.error(`  [${source}] Error: ${errorMsg}`);
    }
  }

  return {
    source,
    dateRange: chunk,
    itemsCollected,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Backfill a single source for a full date range
 */
export async function backfillSource(
  source: CollectorSource,
  fromDate: string,
  toDate: string,
  options?: {
    chunkSize?: 'day' | 'week' | 'month';
    delayMs?: number;
    verbose?: boolean;
    dryRun?: boolean;
  }
): Promise<BackfillChunkResult[]> {
  const chunks = chunkDateRange(fromDate, toDate, options?.chunkSize ?? 'week');
  const results: BackfillChunkResult[] = [];

  if (options?.verbose) {
    console.log(`[${source}] Backfilling ${chunks.length} chunks from ${fromDate} to ${toDate}`);
  }

  for (const chunk of chunks) {
    const result = await backfillSourceChunk(source, chunk, options);
    results.push(result);

    // Delay between chunks
    if (options?.delayMs && chunks.indexOf(chunk) < chunks.length - 1) {
      await delay(options.delayMs);
    }
  }

  return results;
}
