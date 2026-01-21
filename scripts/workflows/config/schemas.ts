/**
 * Configuration Schemas
 *
 * Zod schemas for validating all configuration files.
 */

import { z } from 'zod';

/**
 * Collector source types
 */
export const CollectorSourceSchema = z.enum([
  'email',
  'slack',
  'github',
  'linear',
  'notion',
  'google-docs',
  'google-slides',
  'humaans',
  'incident-io',
  'gemini-notes',
  'dev-analytics',
  'calendar',
]);

export type CollectorSource = z.infer<typeof CollectorSourceSchema>;

/**
 * Priority levels (P0 = Critical, P3 = Low)
 */
export const PriorityLevelSchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

/**
 * Summary categories
 */
export const SummaryCategorySchema = z.enum(['engineering', 'management', 'business']);
export type SummaryCategory = z.infer<typeof SummaryCategorySchema>;

/**
 * Per-collector configuration
 */
export const CollectorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttlMinutes: z.number().min(1).max(1440).optional(),
  batchSize: z.number().min(1).max(500).optional(),
  // Per-source specific options
  patterns: z.array(z.string()).optional(), // For email
  channels: z.array(z.string()).optional(), // For Slack
  docIds: z.array(z.string()).optional(), // For google-docs
  presentationIds: z.array(z.string()).optional(), // For google-slides
  reportsPath: z.string().optional(), // For dev-analytics
  reviewRequestsOnly: z.boolean().optional(), // For github
  assignedOnly: z.boolean().optional(), // For linear
});

export type CollectorConfig = z.infer<typeof CollectorConfigSchema>;

/**
 * Unified collectors configuration
 */
export const CollectorsConfigSchema = z.object({
  sources: z.record(CollectorSourceSchema, CollectorConfigSchema).optional(),
  cache: z
    .object({
      ttlMinutes: z.number().min(1).max(1440).default(60),
      maxAgeMinutes: z.number().min(1).max(10080).default(1440), // 1 week
    })
    .optional(),
});

export type CollectorsConfig = z.infer<typeof CollectorsConfigSchema>;

/**
 * Backfill configuration
 */
export const BackfillConfigSchema = z.object({
  defaultFromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chunkSize: z.enum(['day', 'week', 'month']).default('week'),
  delayBetweenCollectors: z.number().min(0).default(1000),
  delayBetweenChunks: z.number().min(0).default(5000),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(0).default(60000),
  sources: z
    .record(
      CollectorSourceSchema,
      z.object({
        enabled: z.boolean().default(true),
        fromDate: z.string().optional(), // Per-source override
        batchSize: z.number().optional(),
      })
    )
    .optional(),
});

export type BackfillConfig = z.infer<typeof BackfillConfigSchema>;

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
 * TODO configuration
 */
export const TodoConfigSchema = z.object({
  archiveAfterDays: z.number().min(1).default(14),
  retentionMonths: z.number().min(1).default(12),
  staleDays: z.number().min(1).default(14),
  notifications: z
    .object({
      dayBefore: z.boolean().default(true),
      dayOf: z.boolean().default(true),
      overdue: z.boolean().default(true),
    })
    .optional(),
  deduplication: z
    .object({
      enabled: z.boolean().default(true),
      fuzzyThreshold: z.number().min(0).max(1).default(0.85),
    })
    .optional(),
});

export type TodoConfigType = z.infer<typeof TodoConfigSchema>;

/**
 * Meetings configuration
 */
export const MeetingConfigSchema = z.object({
  outputPath: z.string().default('./meetings/output'),
  oneOnOneSettings: z
    .object({
      lookbackDays: z.number().min(1).default(14),
      includeDeliveryMetrics: z.boolean().default(true),
      includeSlackContext: z.boolean().default(true),
      includeEmailContext: z.boolean().default(true),
      includeGithubActivity: z.boolean().default(true),
      includeLinearActivity: z.boolean().default(true),
    })
    .optional(),
  agendaSettings: z
    .object({
      defaultDurationMinutes: z.number().min(5).default(30),
      includeActionItems: z.boolean().default(true),
      includePreviousNotes: z.boolean().default(true),
    })
    .optional(),
});

export type MeetingConfig = z.infer<typeof MeetingConfigSchema>;

/**
 * Email triage configuration
 */
export const EmailTriageConfigSchema = z.object({
  rulesPath: z.string().default('./email/rules'),
  feedbackPath: z.string().default('./email/feedback.jsonl'),
  autoActions: z
    .object({
      deleteHighConfidence: z.boolean().default(false),
      archiveHighConfidence: z.boolean().default(false),
    })
    .optional(),
  llmClassification: z
    .object({
      enabled: z.boolean().default(true),
      confidenceThreshold: z.number().min(0).max(1).default(0.8),
    })
    .optional(),
});

export type EmailTriageConfig = z.infer<typeof EmailTriageConfigSchema>;

/**
 * Briefing configuration
 */
export const BriefingConfigSchema = z.object({
  outputPath: z.string().default('./output/briefings'),
  morningBriefing: z
    .object({
      includeCalendar: z.boolean().default(true),
      includeTodos: z.boolean().default(true),
      includeIncidents: z.boolean().default(true),
      includeTeamAvailability: z.boolean().default(true),
      includeSummary: z.boolean().default(true),
      includeMeetingPrep: z.boolean().default(true),
    })
    .optional(),
  eodSummary: z
    .object({
      includeCompletedTasks: z.boolean().default(true),
      includeNextDayPreview: z.boolean().default(true),
    })
    .optional(),
});

export type BriefingConfig = z.infer<typeof BriefingConfigSchema>;

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

/**
 * Default cache TTLs per source (in minutes)
 */
export const DEFAULT_CACHE_TTL: Record<CollectorSource, number> = {
  slack: 15, // Fast-moving, short TTL
  email: 60, // Hourly refresh sufficient
  github: 30, // PRs change moderately
  linear: 30,
  notion: 60,
  'google-docs': 60,
  'google-slides': 60,
  humaans: 240, // HR data changes rarely
  'incident-io': 5, // Incidents need near-real-time
  'gemini-notes': 60,
  'dev-analytics': 1440, // Daily reports, cache for 24h
  calendar: 15, // Meetings can change
};
