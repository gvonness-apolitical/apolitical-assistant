/**
 * Collector Types
 *
 * Types for TODO collectors that gather tasks from various sources.
 */

import { z } from 'zod';
import type { Todo, TodoSource } from './core.js';

/**
 * Sources that have active collectors (subset of TodoSource).
 */
export const CollectorSourceSchema = z.enum([
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
]);

export type CollectorSource = z.infer<typeof CollectorSourceSchema>;

/**
 * Options passed to collectors when collecting TODOs.
 */
export interface CollectOptions {
  /** Only fetch items since the last collection run */
  incremental?: boolean;
  /** Log detailed progress */
  verbose?: boolean;
  /** Suppress output (for cron) */
  quiet?: boolean;
  /** Filter by specific source */
  source?: TodoSource;
  /** Start date for filtering (ISO format) */
  startDate?: string;
  /** End date for filtering (ISO format) */
  endDate?: string;
}

/**
 * Result of a collection run.
 */
export interface CollectionResult {
  /** The source that was collected from */
  source: TodoSource;
  /** TODOs that were collected */
  todos: Todo[];
  /** Any errors that occurred (as Error objects for type safety) */
  errors: Error[];
  /** How long the collection took in milliseconds */
  durationMs: number;
  /** Whether the collection was incremental */
  wasIncremental?: boolean;
}

/**
 * Cache data stored per collector.
 */
export interface CollectorCache {
  /** Last successful fetch timestamp */
  lastFetch: string;
  /** Source IDs from last fetch (for deduplication) */
  lastSourceIds: string[];
  /** Additional collector-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * A raw TODO item before processing (from external sources).
 */
export interface RawTodoItem {
  /** Title of the TODO */
  title: string;
  /** Optional description */
  description?: string;
  /** External source ID */
  sourceId: string;
  /** URL to the source item */
  sourceUrl?: string;
  /** When the item was created/requested */
  requestDate?: string;
  /** Due date if specified */
  dueDate?: string;
  /** Hard deadline if specified */
  deadline?: string;
  /** Urgency (1-5, where 1 is most urgent) */
  urgency?: number;
  /** Base priority (1-5) */
  basePriority?: number;
  /** Tags from the source */
  tags?: string[];
}

/**
 * Interface that all TODO collectors must implement.
 */
export interface TodoCollector {
  /** The source type this collector handles */
  readonly source: TodoSource;

  /** Human-readable name of the collector */
  readonly name: string;

  /** Whether this collector is enabled */
  isEnabled(): boolean;

  /**
   * Collect TODOs from this source.
   * @param options Collection options
   * @returns Collection result with TODOs and metadata
   */
  collect(options?: CollectOptions): Promise<CollectionResult>;

  /**
   * Get the current cache for this collector.
   */
  getCache(): CollectorCache | null;

  /**
   * Update the cache after a successful collection.
   */
  setCache(cache: CollectorCache): void;

  /**
   * Clear the cache, forcing a full refresh on next collection.
   */
  clearCache(): void;
}

/**
 * Processing statistics for batch operations.
 */
export interface ProcessingStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}
