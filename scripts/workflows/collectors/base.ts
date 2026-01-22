/**
 * Base TODO Collector
 *
 * Provides common functionality for all TODO collectors including
 * caching, error handling, and TODO creation.
 */

import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Todo, TodoSource } from '@apolitical-assistant/shared';
import { generateFingerprint, toError, createLogger, type Logger } from '@apolitical-assistant/shared';
import type {
  TodoCollector,
  CollectorCache,
  CollectOptions,
  CollectionResult,
  RawTodoItem,
} from './types.js';
import { getCachePath, loadTodoConfig, getCollectionStartDate } from './config.js';

export abstract class BaseCollector implements TodoCollector {
  abstract readonly source: TodoSource;
  abstract readonly name: string;

  protected config = loadTodoConfig();
  protected logger: Logger = createLogger('collector');
  private cacheDir = getCachePath();

  abstract isEnabled(): boolean;

  /**
   * Collect raw items from the source. Subclasses must implement this.
   */
  protected abstract collectRaw(options?: CollectOptions): Promise<RawTodoItem[]>;

  async collect(options: CollectOptions = {}): Promise<CollectionResult> {
    const startTime = Date.now();
    const errors: Error[] = [];
    const todos: Todo[] = [];
    let wasIncremental = false;

    // Configure logger based on options
    this.logger = createLogger(this.name, {
      quiet: options.quiet,
      verbose: options.verbose,
    });

    if (!this.isEnabled()) {
      return {
        source: this.source,
        todos: [],
        errors: [],
        durationMs: Date.now() - startTime,
        wasIncremental: false,
      };
    }

    try {
      const cache = this.getCache();
      wasIncremental = options.incremental === true && cache !== null;

      this.logger.debug(`Starting collection (incremental: ${wasIncremental})`);

      const rawItems = await this.collectRaw({
        ...options,
        incremental: wasIncremental,
      });

      this.logger.debug(`Found ${rawItems.length} raw items`);

      // Filter items by collection start date if set
      const collectionStartDate = getCollectionStartDate();
      const filteredItems = collectionStartDate
        ? this.filterByStartDate(rawItems, collectionStartDate, options)
        : rawItems;

      if (collectionStartDate && filteredItems.length !== rawItems.length) {
        this.logger.debug(
          `Filtered ${rawItems.length - filteredItems.length} items before ${collectionStartDate}`
        );
      }

      // Convert raw items to TODOs
      for (const raw of filteredItems) {
        try {
          const todo = this.createTodo(raw);
          todos.push(todo);
        } catch (error) {
          errors.push(toError(error));
        }
      }

      // Update cache
      this.setCache({
        lastFetch: new Date().toISOString(),
        lastSourceIds: rawItems.map((item) => item.sourceId),
      });

      this.logger.debug(`Created ${todos.length} TODOs with ${errors.length} errors`);
    } catch (error) {
      errors.push(toError(error));
      this.logger.error('Collection failed:', error);
    }

    return {
      source: this.source,
      todos,
      errors,
      durationMs: Date.now() - startTime,
      wasIncremental,
    };
  }

  protected createTodo(raw: RawTodoItem): Todo {
    const now = new Date().toISOString();
    const fingerprint = generateFingerprint(raw.title);

    return {
      id: randomUUID(),
      title: raw.title,
      description: raw.description,
      priority: raw.basePriority ?? 3,
      basePriority: raw.basePriority ?? 3,
      urgency: raw.urgency ?? 3,
      requestDate: raw.requestDate,
      dueDate: raw.dueDate,
      deadline: raw.deadline,
      source: this.source,
      sourceId: raw.sourceId,
      sourceUrl: raw.sourceUrl,
      status: 'pending',
      fingerprint,
      tags: raw.tags,
      createdAt: now,
      updatedAt: now,
    };
  }

  getCache(): CollectorCache | null {
    const cachePath = this.getCacheFilePath();

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const content = readFileSync(cachePath, 'utf-8');
      return JSON.parse(content) as CollectorCache;
    } catch {
      return null;
    }
  }

  setCache(cache: CollectorCache): void {
    mkdirSync(this.cacheDir, { recursive: true });
    const cachePath = this.getCacheFilePath();
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }

  clearCache(): void {
    const cachePath = this.getCacheFilePath();
    if (existsSync(cachePath)) {
      writeFileSync(cachePath, '{}', 'utf-8');
    }
  }

  private getCacheFilePath(): string {
    return join(this.cacheDir, `${this.source}.json`);
  }

  /**
   * Get the time since last fetch in milliseconds, or null if never fetched.
   */
  protected getTimeSinceLastFetch(): number | null {
    const cache = this.getCache();
    if (!cache?.lastFetch) return null;
    return Date.now() - new Date(cache.lastFetch).getTime();
  }

  /**
   * Check if an item was seen in the last fetch (for incremental updates).
   */
  protected wasSeenInLastFetch(sourceId: string): boolean {
    const cache = this.getCache();
    return cache?.lastSourceIds?.includes(sourceId) ?? false;
  }

  /**
   * Log a debug message. Uses the logger configured during collect().
   */
  protected log(message: string, _options?: CollectOptions): void {
    this.logger.debug(message);
  }

  /**
   * Filter raw items to only include those on or after the start date.
   * Uses requestDate, dueDate, or deadline to determine the item's date.
   */
  protected filterByStartDate(
    items: RawTodoItem[],
    startDate: string,
    options?: CollectOptions
  ): RawTodoItem[] {
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    return items.filter((item) => {
      // Use the earliest available date for comparison
      const itemDate = item.requestDate || item.dueDate || item.deadline;

      if (!itemDate) {
        // If no date, include the item (can't determine if it's before start date)
        return true;
      }

      const itemDateObj = new Date(itemDate);
      itemDateObj.setHours(0, 0, 0, 0);

      const include = itemDateObj >= startDateObj;

      if (!include && options?.verbose) {
        this.log(`Excluding "${item.title}" (date: ${itemDate} < ${startDate})`, options);
      }

      return include;
    });
  }
}
