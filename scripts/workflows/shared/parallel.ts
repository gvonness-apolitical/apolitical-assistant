/**
 * Parallel Collection Utilities
 *
 * Utilities for running collectors in parallel while respecting rate limits.
 */

import type { CollectorSource } from '../config/schemas.js';

/**
 * Rate limit profiles for different sources
 */
export const RATE_LIMIT_PROFILES: Record<'high' | 'medium' | 'low', CollectorSource[]> = {
  // High rate limit - can run freely in parallel
  high: ['dev-analytics', 'humaans'],

  // Medium rate limit - some concurrency allowed
  medium: ['github', 'linear', 'notion', 'incident-io'],

  // Low rate limit - need careful throttling
  low: ['slack', 'email', 'calendar', 'google-docs', 'google-slides', 'gemini-notes'],
};

/**
 * Default concurrency limits by profile
 */
export const CONCURRENCY_LIMITS: Record<'high' | 'medium' | 'low', number> = {
  high: 10,
  medium: 3,
  low: 1,
};

/**
 * Delay between requests for low-rate sources (ms)
 */
export const LOW_RATE_DELAY_MS = 1000;

/**
 * Get the rate limit profile for a source
 */
export function getRateLimitProfile(source: CollectorSource): 'high' | 'medium' | 'low' {
  if (RATE_LIMIT_PROFILES.high.includes(source)) return 'high';
  if (RATE_LIMIT_PROFILES.medium.includes(source)) return 'medium';
  return 'low';
}

/**
 * Simple delay function
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a rate limiter for a specific concurrency limit
 */
export function createLimiter(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let running = 0;
  const queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];

  const runNext = (): void => {
    if (running >= concurrency || queue.length === 0) return;

    const item = queue.shift()!;
    running++;

    item
      .fn()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        running--;
        runNext();
      });
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      runNext();
    });
  };
}

/**
 * Collection task result
 */
export interface CollectionTask<T> {
  source: CollectorSource;
  collect: () => Promise<T>;
}

/**
 * Collection result with source and status
 */
export interface CollectionTaskResult<T> {
  source: CollectorSource;
  status: 'success' | 'failed';
  result?: T;
  error?: Error;
  durationMs: number;
}

/**
 * Run collection tasks in parallel, respecting rate limits
 *
 * Groups tasks by rate limit profile and runs them with appropriate concurrency.
 */
export async function collectParallel<T>(
  tasks: CollectionTask<T>[],
  options?: {
    delayBetweenLowRate?: number;
    onProgress?: (completed: number, total: number, source: CollectorSource) => void;
  }
): Promise<CollectionTaskResult<T>[]> {
  const results: CollectionTaskResult<T>[] = [];
  const lowRateDelay = options?.delayBetweenLowRate ?? LOW_RATE_DELAY_MS;
  let completed = 0;

  // Group tasks by rate limit profile
  const highRateTasks = tasks.filter((t) => getRateLimitProfile(t.source) === 'high');
  const mediumRateTasks = tasks.filter((t) => getRateLimitProfile(t.source) === 'medium');
  const lowRateTasks = tasks.filter((t) => getRateLimitProfile(t.source) === 'low');

  // Run high-rate tasks in full parallel
  const highLimiter = createLimiter(CONCURRENCY_LIMITS.high);
  const highPromises = highRateTasks.map(async (task) => {
    const startTime = Date.now();
    try {
      const result = await highLimiter(() => task.collect());
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      return {
        source: task.source,
        status: 'success' as const,
        result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      return {
        source: task.source,
        status: 'failed' as const,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
      };
    }
  });

  // Run medium-rate tasks with limited concurrency
  const mediumLimiter = createLimiter(CONCURRENCY_LIMITS.medium);
  const mediumPromises = mediumRateTasks.map(async (task) => {
    const startTime = Date.now();
    try {
      const result = await mediumLimiter(() => task.collect());
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      return {
        source: task.source,
        status: 'success' as const,
        result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      return {
        source: task.source,
        status: 'failed' as const,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
      };
    }
  });

  // Start high and medium in parallel
  const parallelResults = await Promise.all([...highPromises, ...mediumPromises]);
  results.push(...parallelResults);

  // Run low-rate tasks sequentially with delays
  for (const task of lowRateTasks) {
    const startTime = Date.now();
    try {
      const result = await task.collect();
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      results.push({
        source: task.source,
        status: 'success',
        result,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      completed++;
      options?.onProgress?.(completed, tasks.length, task.source);
      results.push({
        source: task.source,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
      });
    }

    // Add delay between low-rate tasks
    if (lowRateTasks.indexOf(task) < lowRateTasks.length - 1) {
      await delay(lowRateDelay);
    }
  }

  return results;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        options?.onRetry?.(attempt + 1, lastError);
        const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Run a function with a timeout
 */
export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
