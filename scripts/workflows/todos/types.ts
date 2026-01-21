/**
 * TODO Module Types
 *
 * Extended types for the TODOs module with summary integration.
 */

import { z } from 'zod';
import { TodoSchema, TodoSourceSchema, TodoStatusSchema, TodoCategorySchema } from '@apolitical-assistant/shared';

// Re-export base types
export { TodoSchema, TodoSourceSchema, TodoStatusSchema, TodoCategorySchema };
export type { Todo, TodoSource, TodoStatus, TodoCategory } from '@apolitical-assistant/shared';

/**
 * Options for collecting TODOs
 */
export interface CollectOptions {
  verbose?: boolean;
  quiet?: boolean;
  incremental?: boolean;
  source?: z.infer<typeof TodoSourceSchema>;
  startDate?: string;
  endDate?: string;
}

/**
 * Result from a collection operation
 */
export interface CollectionResult {
  source: z.infer<typeof TodoSourceSchema>;
  todos: z.infer<typeof TodoSchema>[];
  errors: string[];
  durationMs: number;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Options for creating a TODO from a summary
 */
export interface CreateFromSummaryOptions {
  summaryId: string;
  summaryPeriod: string;
  itemId: string;
  title: string;
  description?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  category: z.infer<typeof TodoCategorySchema>;
  sourceUrl?: string;
  sourceUrls?: string[];
  dueDate?: string;
}

/**
 * Options for listing TODOs
 */
export interface ListOptions {
  status?: z.infer<typeof TodoStatusSchema>[];
  source?: z.infer<typeof TodoSourceSchema>;
  category?: z.infer<typeof TodoCategorySchema>;
  limit?: number;
  offset?: number;
  orderBy?: 'priority' | 'createdAt' | 'updatedAt' | 'dueDate';
  orderDirection?: 'asc' | 'desc';
  onlyStale?: boolean;
  onlySnoozed?: boolean;
  excludeSnoozed?: boolean;
  summaryId?: string;
  summaryPeriod?: string;
}

/**
 * TODO with computed fields for display
 */
export interface TodoWithComputed extends z.infer<typeof TodoSchema> {
  effectivePriority: number;
  isStale: boolean;
  isSnoozed: boolean;
  isOverdue: boolean;
  daysUntilDue?: number;
}

/**
 * Grouped TODOs by status
 */
export interface GroupedTodos {
  overdue: TodoWithComputed[];
  active: TodoWithComputed[];
  snoozed: TodoWithComputed[];
  stale: TodoWithComputed[];
  completed: TodoWithComputed[];
}

/**
 * Summary of TODO activity for a period
 */
export interface TodoSummary {
  period: {
    start: string;
    end: string;
  };
  stats: {
    created: number;
    completed: number;
    carriedOver: number;
    totalActive: number;
  };
  bySource: Map<string, {
    completed: number;
    new: number;
    pending: number;
  }>;
  byCategory: Map<string, {
    completed: number;
    new: number;
    pending: number;
  }>;
  overdue: z.infer<typeof TodoSchema>[];
  stale: z.infer<typeof TodoSchema>[];
}

/**
 * Configuration for the TODOs module
 */
export const TodoConfigSchema = z.object({
  archiveAfterDays: z.number().default(14),
  staleDays: z.number().default(14),
  deduplication: z.object({
    enabled: z.boolean().default(true),
    fuzzyThreshold: z.number().min(0).max(1).default(0.85),
  }).default({}),
  notifications: z.object({
    dayBefore: z.boolean().default(true),
    dayOf: z.boolean().default(true),
    overdue: z.boolean().default(true),
  }).default({}),
  autoCreateFromSummaries: z.boolean().default(true),
});

export type TodoConfig = z.infer<typeof TodoConfigSchema>;
