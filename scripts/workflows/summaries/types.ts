/**
 * Summary Types
 *
 * Types for the summaries module.
 */

import { z } from 'zod';
import { CollectorSourceSchema } from '@apolitical-assistant/shared';

/**
 * Summary fidelity levels
 */
export const SummaryFidelitySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'h1-h2',
  'yearly',
]);

export type SummaryFidelity = z.infer<typeof SummaryFidelitySchema>;

/**
 * Summary categories
 */
export const SummaryCategorySchema = z.enum(['engineering', 'management', 'business']);
export type SummaryCategory = z.infer<typeof SummaryCategorySchema>;

/**
 * Priority levels
 */
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Source reference in a summary item
 */
export const SummarySourceRefSchema = z.object({
  type: CollectorSourceSchema,
  url: z.string().optional(),
  title: z.string().optional(),
});

export type SummarySourceRef = z.infer<typeof SummarySourceRefSchema>;

/**
 * Summary item
 */
export const SummaryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: SummaryCategorySchema,
  priority: PrioritySchema,
  date: z.string(),
  sources: z.array(SummarySourceRefSchema),

  // Integration with TODOs
  todoId: z.string().optional(), // Linked TODO if action item
  todoStatus: z.enum(['pending', 'in_progress', 'completed', 'archived']).optional(),
});

export type SummaryItem = z.infer<typeof SummaryItemSchema>;

/**
 * Summary statistics
 */
export const SummaryStatsSchema = z.object({
  totalItems: z.number(),
  byCategory: z.record(z.number()),
  byPriority: z.record(z.number()),
  bySource: z.record(z.number()),
  actionItems: z.number(),
  completedActionItems: z.number(),
});

export type SummaryStats = z.infer<typeof SummaryStatsSchema>;

/**
 * TODO progress within a summary
 */
export const TodoProgressSchema = z.object({
  created: z.number(),
  completed: z.number(),
  pending: z.number(),
  todoIds: z.array(z.string()),
});

export type TodoProgress = z.infer<typeof TodoProgressSchema>;

/**
 * Trend analysis data
 */
export const TrendAnalysisSchema = z.object({
  // Incident trends
  incidents: z
    .object({
      count: z.number(),
      countPreviousPeriod: z.number(),
      trend: z.enum(['increasing', 'decreasing', 'stable']),
      severityDistribution: z.record(z.number()),
    })
    .optional(),

  // Delivery trends
  delivery: z
    .object({
      prsPerPeriod: z.number(),
      prsPreviousPeriod: z.number(),
      avgCycleTime: z.number().optional(),
      cycleTimeTrend: z.enum(['improving', 'degrading', 'stable']).optional(),
    })
    .optional(),

  // Theme recurrence
  recurringThemes: z.array(
    z.object({
      theme: z.string(),
      occurrences: z.number(),
      sources: z.array(z.string()),
      firstSeen: z.string(),
    })
  ),

  // Recommendations
  recommendations: z.array(z.string()),
});

export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;

/**
 * Full summary document
 */
export const SummaryDocumentSchema = z.object({
  id: z.string(),
  fidelity: SummaryFidelitySchema,
  period: z.string(), // e.g., "2025-01-15", "2025-W03", "2025-01", "2025-Q1"
  startDate: z.string(),
  endDate: z.string(),
  generatedAt: z.string(),

  // Categorized items
  engineering: z.array(SummaryItemSchema),
  management: z.array(SummaryItemSchema),
  business: z.array(SummaryItemSchema),

  // TODO integration
  todoProgress: TodoProgressSchema,

  // Trends (for weekly and higher)
  trends: TrendAnalysisSchema.optional(),

  // Metadata
  sourceSummaries: z.array(z.string()).optional(), // IDs of source summaries (for distilled)
  filePath: z.string(),
  stats: SummaryStatsSchema,
});

export type SummaryDocument = z.infer<typeof SummaryDocumentSchema>;

/**
 * Summary generation options
 */
export interface GenerateSummaryOptions {
  fidelity: SummaryFidelity;
  period: string;
  startDate?: string;
  endDate?: string;
  force?: boolean; // Regenerate even if exists
  deps?: boolean; // Generate dependencies first
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Summary diff result
 */
export interface SummaryDiff {
  period1: string;
  period2: string;
  onlyInPeriod1: SummaryItem[];
  onlyInPeriod2: SummaryItem[];
  evolved: Array<{
    item: SummaryItem;
    previousState: Partial<SummaryItem>;
    changes: string[];
  }>;
  statsDiff: {
    totalItems: { before: number; after: number; change: number };
    actionItems: { before: number; after: number; change: number };
    byPriority: Record<string, { before: number; after: number }>;
    byCategory: Record<string, { before: number; after: number }>;
  };
}

/**
 * Collection status for graceful degradation
 */
export interface CollectionStatus {
  source: string;
  status: 'success' | 'partial' | 'failed';
  itemsCollected: number;
  error?: string;
}

/**
 * Generation result with status
 */
export interface GenerationResult {
  document: SummaryDocument;
  collectionStatus: CollectionStatus[];
  warnings: string[];
}
