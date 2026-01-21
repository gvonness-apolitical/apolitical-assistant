/**
 * Briefing Types
 *
 * Type definitions for briefing documents.
 */

import { z } from 'zod';

/**
 * Briefing type
 */
export const BriefingTypeSchema = z.enum([
  'morning',
  'eod',
  'weekly',
]);

export type BriefingType = z.infer<typeof BriefingTypeSchema>;

/**
 * Calendar event for briefing
 */
export const BriefingCalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  attendees: z.array(z.string()),
  isLeading: z.boolean(),
  meetingType: z.string().optional(),
  hasPrep: z.boolean().default(false),
  prepPath: z.string().optional(),
});

export type BriefingCalendarEvent = z.infer<typeof BriefingCalendarEventSchema>;

/**
 * Incident for briefing
 */
export const BriefingIncidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  url: z.string().optional(),
  assignee: z.string().optional(),
  followUps: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    assignee: z.string().optional(),
  })).optional(),
});

export type BriefingIncident = z.infer<typeof BriefingIncidentSchema>;

/**
 * Team member availability
 */
export const TeamAvailabilitySchema = z.object({
  email: z.string(),
  name: z.string(),
  status: z.enum(['available', 'out', 'partial']),
  reason: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type TeamAvailability = z.infer<typeof TeamAvailabilitySchema>;

/**
 * Communication item for briefing
 */
export const BriefingCommunicationSchema = z.object({
  id: z.string(),
  type: z.enum(['email', 'slack', 'github']),
  title: z.string(),
  from: z.string(),
  date: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  url: z.string().optional(),
  snippet: z.string().optional(),
  requiresResponse: z.boolean().default(false),
});

export type BriefingCommunication = z.infer<typeof BriefingCommunicationSchema>;

/**
 * TODO item for briefing
 */
export const BriefingTodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.number(),
  status: z.string(),
  dueDate: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  isOverdue: z.boolean().default(false),
  isDueToday: z.boolean().default(false),
  isStale: z.boolean().default(false),
});

export type BriefingTodo = z.infer<typeof BriefingTodoSchema>;

/**
 * Summary reference for briefing
 */
export const SummaryReferenceSchema = z.object({
  id: z.string(),
  fidelity: z.string(),
  period: z.string(),
  filePath: z.string(),
  generatedAt: z.string(),
});

export type SummaryReference = z.infer<typeof SummaryReferenceSchema>;

/**
 * Quick action suggestion
 */
export const QuickActionSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['reply', 'review', 'decision', 'task']),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedTime: z.string().optional(),
  url: z.string().optional(),
});

export type QuickAction = z.infer<typeof QuickActionSchema>;

/**
 * Email triage stats for briefing
 */
export const EmailTriageStatsSchema = z.object({
  totalProcessed: z.number(),
  autoArchived: z.number(),
  autoDeleted: z.number(),
  needsAttention: z.number(),
  todosCreated: z.number(),
});

export type EmailTriageStats = z.infer<typeof EmailTriageStatsSchema>;

/**
 * Briefing section
 */
export const BriefingSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  content: z.string(),
  priority: z.number().default(50),
  hasItems: z.boolean().default(true),
});

export type BriefingSection = z.infer<typeof BriefingSectionSchema>;

/**
 * Full briefing document
 */
export const BriefingDocumentSchema = z.object({
  id: z.string(),
  type: BriefingTypeSchema,
  date: z.string(),
  generatedAt: z.string(),
  filePath: z.string(),

  // Data sources
  calendar: z.array(BriefingCalendarEventSchema).optional(),
  incidents: z.array(BriefingIncidentSchema).optional(),
  teamAvailability: z.array(TeamAvailabilitySchema).optional(),
  communications: z.array(BriefingCommunicationSchema).optional(),
  todos: z.object({
    overdue: z.array(BriefingTodoSchema),
    dueToday: z.array(BriefingTodoSchema),
    highPriority: z.array(BriefingTodoSchema),
    stale: z.array(BriefingTodoSchema),
    other: z.array(BriefingTodoSchema),
    total: z.number(),
  }).optional(),
  emailTriageStats: EmailTriageStatsSchema.optional(),
  summary: SummaryReferenceSchema.optional(),

  // Generated content
  sections: z.array(BriefingSectionSchema),
  quickActions: z.array(QuickActionSchema).optional(),

  // Metadata
  warnings: z.array(z.string()).optional(),
  collectionStatus: z.array(z.object({
    source: z.string(),
    status: z.enum(['success', 'partial', 'failed']),
    itemCount: z.number().optional(),
    error: z.string().optional(),
  })).optional(),
});

export type BriefingDocument = z.infer<typeof BriefingDocumentSchema>;

/**
 * Morning briefing options
 */
export const MorningBriefingOptionsSchema = z.object({
  date: z.string().optional(),
  force: z.boolean().default(false),
  skipNotification: z.boolean().default(false),
  includeMeetingPrep: z.boolean().default(true),
  includeEmailStats: z.boolean().default(true),
});

export type MorningBriefingOptions = z.infer<typeof MorningBriefingOptionsSchema>;

/**
 * EOD summary options
 */
export const EodSummaryOptionsSchema = z.object({
  date: z.string().optional(),
  force: z.boolean().default(false),
  skipNotification: z.boolean().default(false),
});

export type EodSummaryOptions = z.infer<typeof EodSummaryOptionsSchema>;

/**
 * Weekly review options
 */
export const WeeklyReviewOptionsSchema = z.object({
  week: z.string().optional(),
  force: z.boolean().default(false),
  skipNotification: z.boolean().default(false),
  includeSummary: z.boolean().default(true),
});

export type WeeklyReviewOptions = z.infer<typeof WeeklyReviewOptionsSchema>;
