/**
 * Backfill Types
 *
 * Types for the backfill infrastructure.
 */

import { z } from 'zod';
import { CollectorSourceSchema } from '../config/schemas.js';

/**
 * Raw collected item from any collector - universal format
 */
export const RawCollectedItemSchema = z.object({
  id: z.string(),
  source: CollectorSourceSchema,
  title: z.string(),
  content: z.string().optional(),
  url: z.string().optional(),
  date: z.string(), // ISO date of item
  author: z.string().optional(), // Who created/sent it
  participants: z.array(z.string()).optional(), // People involved
  metadata: z.record(z.unknown()).optional(),

  // Flags for downstream processing
  flags: z
    .object({
      isActionItem: z.boolean().default(false),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      category: z.enum(['engineering', 'management', 'business']).optional(),
    })
    .optional(),
});

export type RawCollectedItem = z.infer<typeof RawCollectedItemSchema>;

/**
 * Collection result with items and metadata
 */
export const CollectionResultSchema = z.object({
  source: CollectorSourceSchema,
  items: z.array(RawCollectedItemSchema),
  errors: z.array(z.string()),
  durationMs: z.number(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
});

export type CollectionResult = z.infer<typeof CollectionResultSchema>;

/**
 * Backfill progress for a single source
 */
export const BackfillProgressEntrySchema = z.object({
  lastCompletedDate: z.string(),
  itemsCollected: z.number(),
  errors: z.number(),
  startedAt: z.string(),
  updatedAt: z.string(),
});

export type BackfillProgressEntry = z.infer<typeof BackfillProgressEntrySchema>;

/**
 * Overall backfill progress
 */
export const BackfillProgressSchema = z.record(CollectorSourceSchema, BackfillProgressEntrySchema);

export type BackfillProgress = z.infer<typeof BackfillProgressSchema>;

/**
 * Backfill options
 */
export interface BackfillOptions {
  fromDate: string;
  toDate?: string;
  sources?: string[];
  delayMs?: number;
  dryRun?: boolean;
  verbose?: boolean;
  resume?: boolean;
}

/**
 * Backfill result for a single chunk
 */
export interface BackfillChunkResult {
  source: string;
  dateRange: { start: string; end: string };
  itemsCollected: number;
  errors: string[];
  durationMs: number;
}

/**
 * Overall backfill result
 */
export interface BackfillResult {
  totalItems: number;
  totalErrors: number;
  durationMs: number;
  chunkResults: BackfillChunkResult[];
  progress: BackfillProgress;
}

/**
 * Date chunk for backfill processing
 */
export interface DateChunk {
  start: string;
  end: string;
}

/**
 * Audit entry for tracking backfill activity
 */
export const AuditEntrySchema = z.object({
  id: z.string(),
  action: z.enum(['generate', 'regenerate', 'backfill']),
  target: z.string(), // e.g., "summary:daily:2025-01-15"
  triggeredBy: z.enum(['manual', 'scheduled', 'dependency']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  inputHash: z.string().optional(), // Hash of input data for reproducibility
  collectorVersions: z.record(z.string()).optional(),
  result: z.enum(['success', 'partial', 'failed']).optional(),
  outputPath: z.string().optional(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;
