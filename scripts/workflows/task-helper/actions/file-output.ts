/**
 * Task Helper - File Output Operations
 *
 * Handles writing content to files.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TaskContext } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../../..');

/**
 * Default output directory
 */
export const OUTPUT_DIR = join(PROJECT_ROOT, 'task-helper', 'output');

/**
 * Ensure the output directory exists
 */
function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Get the default output file path for a context
 */
export function getDefaultOutputPath(context: TaskContext): string {
  ensureOutputDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const source = context.todo.source ?? 'unknown';
  const sanitizedTitle = sanitizeFilename(context.todo.title);

  return join(OUTPUT_DIR, `${source}-${sanitizedTitle}-${timestamp}.md`);
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Write content to a file
 */
export async function writeToFile(filePath: string, content: string): Promise<void> {
  // Ensure parent directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Write content to file synchronously
 */
export function writeToFileSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Format content for file output with metadata
 */
export function formatForFile(
  context: TaskContext,
  content: string,
  mode: string
): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`title: "${escapeYaml(context.todo.title)}"`);
  lines.push(`source: ${context.todo.source ?? 'unknown'}`);
  lines.push(`mode: ${mode}`);
  lines.push(`todo_id: ${context.todo.id}`);
  lines.push(`generated_at: ${new Date().toISOString()}`);

  if (context.sourceDetails.url) {
    lines.push(`source_url: ${context.sourceDetails.url}`);
  }

  lines.push('---');
  lines.push('');

  // Main content
  lines.push(content);

  return lines.join('\n');
}

/**
 * Escape special characters for YAML strings
 */
function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * List files in the output directory
 */
export function listOutputFiles(): string[] {
  ensureOutputDir();

  try {
    const files = readdirSync(OUTPUT_DIR);
    return files
      .filter((f: string) => f.endsWith('.md'))
      .map((f: string) => join(OUTPUT_DIR, f));
  } catch {
    return [];
  }
}

/**
 * Clean up old output files
 */
export function cleanupOldFiles(maxAgeHours: number = 24): number {
  const files = listOutputFiles();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  let deleted = 0;

  for (const file of files) {
    try {
      const stats = statSync(file);
      if (stats.mtimeMs < cutoff) {
        unlinkSync(file);
        deleted++;
      }
    } catch {
      // Ignore errors
    }
  }

  return deleted;
}

/**
 * Get output statistics
 */
export function getOutputStats(): {
  totalFiles: number;
  totalSizeBytes: number;
  oldestFile: Date | null;
  newestFile: Date | null;
} {
  const files = listOutputFiles();

  let totalSize = 0;
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const file of files) {
    try {
      const stats = statSync(file);
      totalSize += stats.size;

      const mtime = new Date(stats.mtime);
      if (!oldest || mtime < oldest) oldest = mtime;
      if (!newest || mtime > newest) newest = mtime;
    } catch {
      // Ignore errors
    }
  }

  return {
    totalFiles: files.length,
    totalSizeBytes: totalSize,
    oldestFile: oldest,
    newestFile: newest,
  };
}
