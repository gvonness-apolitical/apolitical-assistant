/**
 * Configuration Schemas
 *
 * Zod schemas for validating configuration files.
 */

import { z } from 'zod';
import { CollectorSourceSchema, type CollectorSource } from '@apolitical-assistant/shared';

// Re-export CollectorSource for backwards compatibility
export { CollectorSourceSchema, type CollectorSource };

/**
 * Summary configuration
 */
export const SummaryConfigSchema = z.object({
  archivePath: z.string().default('./summaries/archive'),
  cachePath: z.string().default('./summaries/cache'),
  retention: z
    .object({
      daily: z.number().default(90), // days
      weekly: z.number().default(365), // days
      monthly: z.number().default(730), // days (2 years)
      quarterly: z.number().default(-1), // -1 = forever
      'h1-h2': z.number().default(-1),
      yearly: z.number().default(-1),
    })
    .optional(),
  autoCreateTodos: z.boolean().default(true),
  trendsAnalysis: z.boolean().default(true),
});

export type SummaryConfig = z.infer<typeof SummaryConfigSchema>;

/**
 * Backfill source configuration
 */
const BackfillSourceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  fromDate: z.string().optional(),
  batchSize: z.number().default(100),
});

/**
 * Backfill configuration
 */
export const BackfillConfigSchema = z.object({
  defaultFromDate: z.string().default('2024-01-01'),
  chunkSize: z.enum(['day', 'week', 'month']).default('week'),
  delayBetweenCollectors: z.number().default(2000),
  delayBetweenChunks: z.number().default(1000),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(5000),
  sources: z.record(CollectorSourceSchema, BackfillSourceConfigSchema).optional(),
});

export type BackfillConfig = z.infer<typeof BackfillConfigSchema>;

/**
 * Load and validate a configuration file
 */
export function loadConfig<T>(
  path: string,
  schema: z.ZodSchema<T>,
  readFile: (path: string) => string
): T {
  let raw: unknown;

  try {
    const content = readFile(path);
    raw = JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, use schema defaults
      raw = {};
    } else {
      throw new Error(`Failed to read config file ${path}: ${error}`);
    }
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Config validation failed for ${path}:\n${errors}`);
  }

  return result.data;
}
