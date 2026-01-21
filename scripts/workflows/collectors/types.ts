/**
 * TODO Collector Types
 *
 * Defines the interface for TODO collectors that gather tasks from various sources.
 */

import type { Todo, TodoSource } from '@apolitical-assistant/shared';

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
}

/**
 * Result of a collection run.
 */
export interface CollectionResult {
  /** The source that was collected from */
  source: TodoSource;
  /** TODOs that were collected */
  todos: Todo[];
  /** Any errors that occurred */
  errors: Error[];
  /** How long the collection took in milliseconds */
  durationMs: number;
  /** Whether the collection was incremental */
  wasIncremental: boolean;
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
