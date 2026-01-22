/**
 * Task Helper - Context Cache
 *
 * Caching layer for gathered context to avoid redundant API calls.
 */

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { CACHE_DIR, getCacheTTL, loadConfig, ensureDirectories } from './config.js';
import type { TaskContext, CachedContext } from './types.js';
import { CachedContextSchema } from './types.js';

/**
 * Get the cache file path for a TODO
 */
function getCacheFilePath(todoId: string): string {
  return join(CACHE_DIR, `${todoId}.json`);
}

/**
 * Check if cached context is valid (not expired)
 */
function isValidCache(cached: CachedContext): boolean {
  const now = new Date();
  const expiresAt = new Date(cached.expiresAt);
  return expiresAt > now;
}

/**
 * Get cached context for a TODO
 */
export function getCachedContext(todoId: string): TaskContext | null {
  const config = loadConfig();

  // Check if caching is enabled
  if (!config.cache.enabled) {
    return null;
  }

  const cachePath = getCacheFilePath(todoId);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
    const result = CachedContextSchema.safeParse(raw);

    if (!result.success) {
      // Invalid cache, remove it
      unlinkSync(cachePath);
      return null;
    }

    if (!isValidCache(result.data)) {
      // Expired cache, remove it
      unlinkSync(cachePath);
      return null;
    }

    return result.data.context;
  } catch {
    // Failed to read cache, remove it
    try {
      unlinkSync(cachePath);
    } catch {
      // Ignore removal errors
    }
    return null;
  }
}

/**
 * Save context to cache
 */
export function setCachedContext(todoId: string, context: TaskContext): void {
  const config = loadConfig();

  // Check if caching is enabled
  if (!config.cache.enabled) {
    return;
  }

  ensureDirectories();

  const source = context.todo.source ?? 'default';
  const ttlMinutes = getCacheTTL(source);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const cached: CachedContext = {
    todoId,
    context,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const cachePath = getCacheFilePath(todoId);
  writeFileSync(cachePath, JSON.stringify(cached, null, 2), 'utf-8');
}

/**
 * Invalidate cached context for a TODO
 */
export function invalidateCache(todoId: string): boolean {
  const cachePath = getCacheFilePath(todoId);

  if (!existsSync(cachePath)) {
    return false;
  }

  try {
    unlinkSync(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all cached context
 */
export function clearAllCache(): number {
  if (!existsSync(CACHE_DIR)) {
    return 0;
  }

  let count = 0;

  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          unlinkSync(join(CACHE_DIR, file));
          count++;
        } catch {
          // Ignore individual file errors
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return count;
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(): number {
  if (!existsSync(CACHE_DIR)) {
    return 0;
  }

  let count = 0;

  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(CACHE_DIR, file);

      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
        const result = CachedContextSchema.safeParse(raw);

        if (!result.success || !isValidCache(result.data)) {
          unlinkSync(filePath);
          count++;
        }
      } catch {
        // Invalid file, remove it
        try {
          unlinkSync(filePath);
          count++;
        } catch {
          // Ignore removal errors
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return count;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  totalSizeBytes: number;
} {
  const stats = {
    totalEntries: 0,
    validEntries: 0,
    expiredEntries: 0,
    totalSizeBytes: 0,
  };

  if (!existsSync(CACHE_DIR)) {
    return stats;
  }

  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(CACHE_DIR, file);
      stats.totalEntries++;

      try {
        const content = readFileSync(filePath, 'utf-8');
        stats.totalSizeBytes += Buffer.byteLength(content, 'utf-8');

        const raw = JSON.parse(content);
        const result = CachedContextSchema.safeParse(raw);

        if (result.success && isValidCache(result.data)) {
          stats.validEntries++;
        } else {
          stats.expiredEntries++;
        }
      } catch {
        stats.expiredEntries++;
      }
    }
  } catch {
    // Ignore errors
  }

  return stats;
}

/**
 * Format cache stats for display
 */
export function formatCacheStats(stats: ReturnType<typeof getCacheStats>): string {
  const sizeKB = (stats.totalSizeBytes / 1024).toFixed(2);
  return [
    `Cache Statistics:`,
    `  Total entries: ${stats.totalEntries}`,
    `  Valid entries: ${stats.validEntries}`,
    `  Expired entries: ${stats.expiredEntries}`,
    `  Total size: ${sizeKB} KB`,
  ].join('\n');
}
