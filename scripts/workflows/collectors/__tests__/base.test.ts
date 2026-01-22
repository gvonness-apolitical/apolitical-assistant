/**
 * Base Collector Tests
 *
 * Tests the BaseCollector abstract class using a concrete test implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseCollector } from '../base.js';
import type { CollectOptions, RawTodoItem, CollectorCache } from '../types.js';
import type { TodoSource } from '@apolitical-assistant/shared';
import * as shared from '@apolitical-assistant/shared';
import * as fs from 'node:fs';

// Mock dependencies
vi.mock('@apolitical-assistant/shared', async () => {
  const actual = await vi.importActual('@apolitical-assistant/shared');
  return {
    ...actual,
    generateFingerprint: vi.fn((title: string) => `fp-${title.slice(0, 10)}`),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
      setLevel: vi.fn(),
    })),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock the config module
vi.mock('../config.js', () => ({
  getCachePath: vi.fn(() => '/tmp/test-cache'),
  loadTodoConfig: vi.fn(() => ({
    archiveAfterDays: 14,
    staleDays: 14,
    deduplication: { enabled: true, fuzzyThreshold: 0.85 },
    notifications: { dayBefore: true, dayOf: true, overdue: true },
  })),
  getCollectionStartDate: vi.fn(() => null),
}));

/**
 * Concrete test implementation of BaseCollector
 */
class TestCollector extends BaseCollector {
  readonly source: TodoSource = 'manual';
  readonly name = 'Test Collector';

  private _enabled = true;
  private _rawItems: RawTodoItem[] = [];
  private _collectError: Error | null = null;

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  setRawItems(items: RawTodoItem[]): void {
    this._rawItems = items;
  }

  setCollectError(error: Error | null): void {
    this._collectError = error;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  protected async collectRaw(_options?: CollectOptions): Promise<RawTodoItem[]> {
    if (this._collectError) {
      throw this._collectError;
    }
    return this._rawItems;
  }
}

describe('BaseCollector', () => {
  let collector: TestCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new TestCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collect', () => {
    it('returns empty result when collector is disabled', async () => {
      collector.setEnabled(false);

      const result = await collector.collect();

      expect(result.source).toBe('manual');
      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.wasIncremental).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('collects and converts raw items to todos', async () => {
      const rawItems: RawTodoItem[] = [
        {
          title: 'Test Task 1',
          sourceId: 'src-1',
          sourceUrl: 'https://example.com/1',
        },
        {
          title: 'Test Task 2',
          sourceId: 'src-2',
          description: 'A description',
        },
      ];
      collector.setRawItems(rawItems);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const todo1 = result.todos[0];
      expect(todo1.title).toBe('Test Task 1');
      expect(todo1.sourceId).toBe('src-1');
      expect(todo1.sourceUrl).toBe('https://example.com/1');
      expect(todo1.source).toBe('manual');
      expect(todo1.status).toBe('pending');
      expect(todo1.priority).toBe(3);
      expect(todo1.basePriority).toBe(3);
      expect(todo1.urgency).toBe(3);
      expect(todo1.id).toBeDefined();
      expect(todo1.createdAt).toBeDefined();
      expect(todo1.updatedAt).toBeDefined();
      expect(todo1.fingerprint).toBeDefined();

      const todo2 = result.todos[1];
      expect(todo2.title).toBe('Test Task 2');
      expect(todo2.description).toBe('A description');
    });

    it('preserves raw item fields in todos', async () => {
      const rawItems: RawTodoItem[] = [
        {
          title: 'Priority Task',
          sourceId: 'src-1',
          basePriority: 1,
          urgency: 2,
          dueDate: '2024-01-15',
          deadline: '2024-01-20',
          requestDate: '2024-01-01',
          tags: ['urgent', 'review'],
        },
      ];
      collector.setRawItems(rawItems);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      const todo = result.todos[0];
      expect(todo.priority).toBe(1);
      expect(todo.basePriority).toBe(1);
      expect(todo.urgency).toBe(2);
      expect(todo.dueDate).toBe('2024-01-15');
      expect(todo.deadline).toBe('2024-01-20');
      expect(todo.requestDate).toBe('2024-01-01');
      expect(todo.tags).toEqual(['urgent', 'review']);
    });

    it('handles collection errors gracefully', async () => {
      collector.setCollectError(new Error('API Error'));

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('API Error');
    });

    it('tracks duration in milliseconds', async () => {
      collector.setRawItems([{ title: 'Task', sourceId: '1' }]);

      const result = await collector.collect();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('sets wasIncremental to false when no cache exists', async () => {
      collector.setRawItems([]);
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = await collector.collect({ incremental: true });

      expect(result.wasIncremental).toBe(false);
    });

    it('sets wasIncremental to true when cache exists and incremental is requested', async () => {
      collector.setRawItems([]);
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ lastFetch: new Date().toISOString(), lastSourceIds: [] })
      );

      const result = await collector.collect({ incremental: true });

      expect(result.wasIncremental).toBe(true);
    });
  });

  describe('cache operations', () => {
    it('returns null when no cache file exists', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const cache = collector.getCache();

      expect(cache).toBeNull();
    });

    it('returns cache data when file exists', () => {
      const cacheData: CollectorCache = {
        lastFetch: '2024-01-15T10:00:00Z',
        lastSourceIds: ['id-1', 'id-2'],
        metadata: { extra: 'data' },
      };
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(cacheData));

      const cache = collector.getCache();

      expect(cache).toEqual(cacheData);
    });

    it('returns null when cache file is invalid JSON', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      const cache = collector.getCache();

      expect(cache).toBeNull();
    });

    it('creates cache directory and writes cache file', () => {
      const cacheData: CollectorCache = {
        lastFetch: '2024-01-15T10:00:00Z',
        lastSourceIds: ['id-1'],
      };

      collector.setCache(cacheData);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/test-cache', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/test-cache/manual.json',
        JSON.stringify(cacheData, null, 2),
        'utf-8'
      );
    });

    it('clears cache by writing empty object', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      collector.clearCache();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/test-cache/manual.json',
        '{}',
        'utf-8'
      );
    });

    it('does not clear cache if file does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      collector.clearCache();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('createTodo', () => {
    it('generates unique IDs for each todo', async () => {
      collector.setRawItems([
        { title: 'Task 1', sourceId: '1' },
        { title: 'Task 2', sourceId: '2' },
      ]);

      const result = await collector.collect();

      expect(result.todos[0].id).not.toBe(result.todos[1].id);
    });

    it('generates fingerprint using shared utility', async () => {
      collector.setRawItems([{ title: 'Test Title', sourceId: '1' }]);

      const result = await collector.collect();

      expect(shared.generateFingerprint).toHaveBeenCalledWith('Test Title');
      expect(result.todos[0].fingerprint).toBe('fp-Test Title');
    });

    it('sets createdAt and updatedAt to same value', async () => {
      collector.setRawItems([{ title: 'Task', sourceId: '1' }]);

      const result = await collector.collect();

      expect(result.todos[0].createdAt).toBe(result.todos[0].updatedAt);
    });

    it('defaults priority, basePriority, and urgency to 3', async () => {
      collector.setRawItems([{ title: 'Task', sourceId: '1' }]);

      const result = await collector.collect();

      expect(result.todos[0].priority).toBe(3);
      expect(result.todos[0].basePriority).toBe(3);
      expect(result.todos[0].urgency).toBe(3);
    });
  });

  describe('filterByStartDate', () => {
    // Note: filterByStartDate tests are handled through the collect() method
    // The mock for getCollectionStartDate is set up in the vi.mock('../config.js') block
    // These tests are covered by the collect() tests above since filterByStartDate is a protected method

    it('includes all items when no start date is set', async () => {
      // Default mock returns null for getCollectionStartDate
      collector.setRawItems([
        { title: 'Old Task', sourceId: '1', requestDate: '2020-01-01' },
        { title: 'New Task', sourceId: '2', requestDate: '2024-01-01' },
      ]);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
    });
  });

  describe('logger integration', () => {
    it('creates logger with verbose option', async () => {
      collector.setRawItems([]);

      await collector.collect({ verbose: true });

      expect(shared.createLogger).toHaveBeenCalledWith('Test Collector', {
        quiet: undefined,
        verbose: true,
      });
    });

    it('creates logger with quiet option', async () => {
      collector.setRawItems([]);

      await collector.collect({ quiet: true });

      expect(shared.createLogger).toHaveBeenCalledWith('Test Collector', {
        quiet: true,
        verbose: undefined,
      });
    });
  });
});
