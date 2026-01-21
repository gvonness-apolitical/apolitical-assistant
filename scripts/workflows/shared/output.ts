/**
 * Output Utilities
 *
 * File output utilities for generated documents.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectRoot } from '../config/load.js';

/**
 * Write a markdown file to the output directory
 */
export function writeMarkdown(relativePath: string, content: string): string {
  const fullPath = join(getProjectRoot(), relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

/**
 * Write a JSON file
 */
export function writeJson<T>(relativePath: string, data: T, pretty = true): string {
  const fullPath = join(getProjectRoot(), relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

/**
 * Read a JSON file
 */
export function readJson<T>(relativePath: string): T | null {
  const fullPath = join(getProjectRoot(), relativePath);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 */
export function fileExists(relativePath: string): boolean {
  return existsSync(join(getProjectRoot(), relativePath));
}

/**
 * List files in a directory matching a pattern
 */
export function listFiles(
  relativePath: string,
  options?: {
    extension?: string;
    recursive?: boolean;
  }
): string[] {
  const fullPath = join(getProjectRoot(), relativePath);

  if (!existsSync(fullPath)) {
    return [];
  }

  const files: string[] = [];
  const entries = readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(relativePath, entry.name);

    if (entry.isDirectory() && options?.recursive) {
      files.push(...listFiles(entryPath, options));
    } else if (entry.isFile()) {
      if (!options?.extension || entry.name.endsWith(options.extension)) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

/**
 * Get a dated filename
 */
export function getDatedFilename(prefix: string, date: string, extension = 'md'): string {
  return `${prefix}-${date}.${extension}`;
}

/**
 * Parse a dated filename
 */
export function parseDatedFilename(
  filename: string,
  prefix: string
): { date: string; extension: string } | null {
  const pattern = new RegExp(`^${prefix}-(.+)\\.(.+)$`);
  const match = filename.match(pattern);

  if (!match) {
    return null;
  }

  return {
    date: match[1],
    extension: match[2],
  };
}

/**
 * Ensure a directory exists
 */
export function ensureDir(relativePath: string): void {
  const fullPath = join(getProjectRoot(), relativePath);
  mkdirSync(fullPath, { recursive: true });
}

/**
 * Get the full path for a relative path
 */
export function getFullPath(relativePath: string): string {
  return join(getProjectRoot(), relativePath);
}
