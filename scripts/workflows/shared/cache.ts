/**
 * Shared Caching Layer
 *
 * TTL-based caching for collector data to avoid redundant API calls.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { type CollectorSource, DEFAULT_CACHE_TTL } from '../config/schemas.js';
import { getProjectRoot } from '../config/load.js';

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: string;
  source: CollectorSource;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Override default TTL in minutes */
  ttlMinutes?: number;
  /** Compress data with gzip */
  compress?: boolean;
  /** Date for date-keyed caches */
  date?: string;
}

/**
 * Get the cache directory path
 */
export function getCacheDir(module: string): string {
  return join(getProjectRoot(), module, 'cache');
}

/**
 * Get the collected items cache directory
 */
export function getCollectedCacheDir(): string {
  return join(getProjectRoot(), 'collected', 'cache');
}

/**
 * Check if a cache entry is still valid
 */
export function isCacheValid(
  entry: CacheEntry<unknown>,
  source: CollectorSource,
  options?: CacheOptions
): boolean {
  const ttlMinutes = options?.ttlMinutes ?? DEFAULT_CACHE_TTL[source];
  const cacheTime = new Date(entry.timestamp).getTime();
  const now = Date.now();
  const ageMinutes = (now - cacheTime) / (1000 * 60);

  return ageMinutes < ttlMinutes;
}

/**
 * Read from cache
 */
export function readCache<T>(
  module: string,
  source: CollectorSource,
  options?: CacheOptions
): CacheEntry<T> | null {
  const cacheDir = getCacheDir(module);
  const filename = options?.date ? `${source}-${options.date}` : source;
  const extension = options?.compress ? '.json.gz' : '.json';
  const cachePath = join(cacheDir, `${filename}${extension}`);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    let content: string;

    if (options?.compress) {
      const compressed = readFileSync(cachePath);
      content = gunzipSync(compressed).toString('utf-8');
    } else {
      content = readFileSync(cachePath, 'utf-8');
    }

    const entry = JSON.parse(content) as CacheEntry<T>;

    if (!isCacheValid(entry, source, options)) {
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

/**
 * Write to cache
 */
export function writeCache<T>(
  module: string,
  source: CollectorSource,
  data: T,
  options?: CacheOptions & {
    dateRange?: { start: string; end: string };
  }
): void {
  const cacheDir = getCacheDir(module);
  mkdirSync(cacheDir, { recursive: true });

  const filename = options?.date ? `${source}-${options.date}` : source;
  const extension = options?.compress ? '.json.gz' : '.json';
  const cachePath = join(cacheDir, `${filename}${extension}`);

  const entry: CacheEntry<T> = {
    data,
    timestamp: new Date().toISOString(),
    source,
    dateRange: options?.dateRange,
  };

  const content = JSON.stringify(entry, null, options?.compress ? 0 : 2);

  if (options?.compress) {
    const compressed = gzipSync(Buffer.from(content, 'utf-8'));
    writeFileSync(cachePath, compressed);
  } else {
    writeFileSync(cachePath, content, 'utf-8');
  }
}

/**
 * Clear cache for a source
 */
export function clearCache(module: string, source?: CollectorSource, date?: string): void {
  const cacheDir = getCacheDir(module);

  if (!existsSync(cacheDir)) {
    return;
  }

  if (!source) {
    // Clear all caches
    const files = readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.json.gz')) {
        unlinkSync(join(cacheDir, file));
      }
    }
    return;
  }

  // Clear specific source cache
  const patterns = date ? [`${source}-${date}.json`, `${source}-${date}.json.gz`] : [`${source}.json`, `${source}.json.gz`];

  for (const pattern of patterns) {
    const cachePath = join(cacheDir, pattern);
    if (existsSync(cachePath)) {
      unlinkSync(cachePath);
    }
  }
}

/**
 * Get cache stats
 */
export function getCacheStats(
  module: string
): { source: string; size: number; lastModified: string; isValid: boolean }[] {
  const cacheDir = getCacheDir(module);

  if (!existsSync(cacheDir)) {
    return [];
  }

  const stats: { source: string; size: number; lastModified: string; isValid: boolean }[] = [];
  const files = readdirSync(cacheDir) as string[];

  for (const file of files) {
    if (!file.endsWith('.json') && !file.endsWith('.json.gz')) {
      continue;
    }

    const cachePath = join(cacheDir, file);
    const fileStat = statSync(cachePath);

    // Extract source name from filename
    const sourceName = file.replace('.json.gz', '').replace('.json', '');

    // Try to read and check validity
    let isValid = false;
    try {
      const content = file.endsWith('.gz')
        ? gunzipSync(readFileSync(cachePath)).toString('utf-8')
        : readFileSync(cachePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<unknown>;
      // Can't determine source type from filename alone, use default TTL
      const cacheTime = new Date(entry.timestamp).getTime();
      const ageMinutes = (Date.now() - cacheTime) / (1000 * 60);
      isValid = ageMinutes < 60; // Default 1 hour
    } catch {
      isValid = false;
    }

    stats.push({
      source: sourceName,
      size: fileStat.size,
      lastModified: fileStat.mtime.toISOString(),
      isValid,
    });
  }

  return stats;
}

/**
 * Collected items cache - for storing raw collected items by date
 */
export class CollectedItemsCache {
  private cacheDir: string;

  constructor() {
    this.cacheDir = getCollectedCacheDir();
  }

  /**
   * Get cache file path for a source and date
   */
  private getFilePath(source: CollectorSource, date: string): string {
    const sourceDir = join(this.cacheDir, source);
    return join(sourceDir, `${date}.json.gz`);
  }

  /**
   * Read collected items for a source and date
   */
  read<T>(source: CollectorSource, date: string): T[] | null {
    const filePath = this.getFilePath(source, date);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const compressed = readFileSync(filePath);
      const content = gunzipSync(compressed).toString('utf-8');
      return JSON.parse(content) as T[];
    } catch {
      return null;
    }
  }

  /**
   * Write collected items for a source and date
   */
  write<T>(source: CollectorSource, date: string, items: T[]): void {
    const filePath = this.getFilePath(source, date);
    mkdirSync(dirname(filePath), { recursive: true });

    const content = JSON.stringify(items);
    const compressed = gzipSync(Buffer.from(content, 'utf-8'));
    writeFileSync(filePath, compressed);
  }

  /**
   * Check if cache exists for a source and date
   */
  exists(source: CollectorSource, date: string): boolean {
    return existsSync(this.getFilePath(source, date));
  }

  /**
   * Get all cached dates for a source
   */
  getCachedDates(source: CollectorSource): string[] {
    const sourceDir = join(this.cacheDir, source);

    if (!existsSync(sourceDir)) {
      return [];
    }

    const files = readdirSync(sourceDir) as string[];
    return files
      .filter((f: string) => f.endsWith('.json.gz'))
      .map((f: string) => f.replace('.json.gz', ''))
      .sort();
  }
}
