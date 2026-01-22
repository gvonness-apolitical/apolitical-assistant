/**
 * Task Helper Types
 *
 * Type definitions for the TODO task helper system.
 */

import { z } from 'zod';
import { TodoSchema, TodoSourceSchema } from '@apolitical-assistant/shared';

// Re-export base types
export type { Todo, TodoSource, TodoStatus, TodoCategory } from '@apolitical-assistant/shared';
export { TodoSchema, TodoSourceSchema };

/**
 * Helper mode for task assistance
 */
export const HelperModeSchema = z.enum([
  'respond',    // Draft a response (email, PR comment, etc.)
  'review',     // Provide review points/commentary
  'summarize',  // Summarize context and provide insights
  'schedule',   // Help schedule related meetings
  'research',   // Gather more context and answer questions
  'complete',   // Help complete/close the TODO
  'delegate',   // Draft delegation message
  'custom',     // Free-form question/request
]);

export type HelperMode = z.infer<typeof HelperModeSchema>;

/**
 * Action output type
 */
export const OutputTypeSchema = z.enum([
  'mcp',        // Write directly via MCP
  'clipboard',  // Copy to clipboard
  'file',       // Write to file
  'display',    // Display in terminal
]);

export type OutputType = z.infer<typeof OutputTypeSchema>;

/**
 * Context depth levels for gathering
 */
export const ContextDepthSchema = z.enum([
  'minimal',       // Just the TODO source details + thread
  'standard',      // + related items from same source + key people context
  'comprehensive', // + cross-source search + business context + summaries
]);

export type ContextDepth = z.infer<typeof ContextDepthSchema>;

/**
 * Thread item in conversation context
 */
export const ThreadItemSchema = z.object({
  author: z.string(),
  content: z.string(),
  date: z.string(),
  type: z.enum(['comment', 'message', 'email', 'note', 'review']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ThreadItem = z.infer<typeof ThreadItemSchema>;

/**
 * Related item from any source
 */
export const RelatedItemSchema = z.object({
  type: z.string(),
  source: TodoSourceSchema.optional(),
  title: z.string(),
  url: z.string().optional(),
  relevance: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RelatedItem = z.infer<typeof RelatedItemSchema>;

/**
 * Person context
 */
export const PersonContextSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  recentActivity: z.string().optional(),
  isOutOfOffice: z.boolean().optional(),
});

export type PersonContext = z.infer<typeof PersonContextSchema>;

/**
 * Calendar availability slot
 */
export const AvailabilitySlotSchema = z.object({
  start: z.string(),
  end: z.string(),
  duration: z.number(), // minutes
});

export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

/**
 * Source-specific details
 */
export const SourceDetailsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  status: z.string().optional(),
  author: z.string().optional(),
  assignee: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  labels: z.array(z.string()).optional(),

  // GitHub-specific
  prNumber: z.number().optional(),
  issueNumber: z.number().optional(),
  repo: z.string().optional(),
  ciStatus: z.string().optional(),
  reviewState: z.string().optional(),
  changedFiles: z.number().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),

  // Linear-specific
  projectName: z.string().optional(),
  teamName: z.string().optional(),
  estimate: z.number().optional(),
  cycleName: z.string().optional(),

  // Email-specific
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  subject: z.string().optional(),
  threadId: z.string().optional(),

  // Slack-specific
  channel: z.string().optional(),
  channelId: z.string().optional(),
  threadTs: z.string().optional(),

  // Incident-specific
  severity: z.string().optional(),
  incidentStatus: z.string().optional(),

  // Generic metadata
  metadata: z.record(z.unknown()).optional(),
});

export type SourceDetails = z.infer<typeof SourceDetailsSchema>;

/**
 * Context gathering status for a source
 */
export const GatheringStatusSchema = z.object({
  source: z.string(),
  status: z.enum(['success', 'partial', 'failed', 'skipped']),
  itemCount: z.number().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
});

export type GatheringStatus = z.infer<typeof GatheringStatusSchema>;

/**
 * Gathered context for a TODO
 */
export const TaskContextSchema = z.object({
  todo: TodoSchema,

  // Source-specific context
  sourceDetails: SourceDetailsSchema,

  // Conversation/thread context
  thread: z.array(ThreadItemSchema).optional(),

  // Related items
  relatedItems: z.array(RelatedItemSchema).optional(),

  // People context
  people: z.array(PersonContextSchema).optional(),

  // Calendar context (for scheduling)
  calendar: z.object({
    relevantEvents: z.array(z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      attendees: z.array(z.string()).optional(),
    })).optional(),
    availability: z.array(AvailabilitySlotSchema).optional(),
  }).optional(),

  // Wider context from other sources
  widerContext: z.object({
    relatedPRs: z.array(RelatedItemSchema).optional(),
    relatedIssues: z.array(RelatedItemSchema).optional(),
    relatedDocs: z.array(RelatedItemSchema).optional(),
    slackDiscussions: z.array(RelatedItemSchema).optional(),
    recentSummaries: z.array(z.string()).optional(),
  }).optional(),

  // Gathering metadata
  gatheredAt: z.string(),
  depth: ContextDepthSchema,
  sources: z.array(GatheringStatusSchema),
});

export type TaskContext = z.infer<typeof TaskContextSchema>;

/**
 * Review point structure
 */
export const ReviewPointSchema = z.object({
  type: z.enum(['praise', 'concern', 'question', 'suggestion', 'blocker']),
  content: z.string(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  file: z.string().optional(),
  line: z.number().optional(),
});

export type ReviewPoint = z.infer<typeof ReviewPointSchema>;

/**
 * Suggested meeting time
 */
export const SuggestedTimeSchema = z.object({
  start: z.string(),
  end: z.string(),
  duration: z.number(), // minutes
  attendeesAvailable: z.array(z.string()),
  conflicts: z.array(z.string()).optional(),
});

export type SuggestedTime = z.infer<typeof SuggestedTimeSchema>;

/**
 * Structured response output
 */
export const StructuredOutputSchema = z.object({
  // For respond mode
  draftResponse: z.string().optional(),

  // For review mode
  reviewPoints: z.array(ReviewPointSchema).optional(),
  reviewSummary: z.string().optional(),
  approvalRecommendation: z.enum(['approve', 'request_changes', 'comment']).optional(),

  // For summarize mode
  summary: z.string().optional(),
  keyInsights: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),

  // For schedule mode
  suggestedTimes: z.array(SuggestedTimeSchema).optional(),
  meetingAgenda: z.array(z.string()).optional(),

  // For complete mode
  completionSteps: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),

  // For delegate mode
  delegationMessage: z.string().optional(),
  suggestedDelegate: z.string().optional(),
});

export type StructuredOutput = z.infer<typeof StructuredOutputSchema>;

/**
 * Action that was taken or is available
 */
export const ActionResultSchema = z.object({
  type: z.enum(['mcp_write', 'clipboard', 'file', 'display']),
  description: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'skipped']),
  target: z.string().optional(),
  error: z.string().optional(),
});

export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Helper response with structured output
 */
export const HelperResponseSchema = z.object({
  todoId: z.string(),
  mode: HelperModeSchema,
  content: z.string(), // Main generated content

  // Mode-specific structured output
  structured: StructuredOutputSchema.optional(),

  // Actions taken or available
  actions: z.array(ActionResultSchema),

  // Context that was used
  contextSummary: z.string().optional(),

  generatedAt: z.string(),
});

export type HelperResponse = z.infer<typeof HelperResponseSchema>;

/**
 * Cached context entry
 */
export const CachedContextSchema = z.object({
  todoId: z.string(),
  context: TaskContextSchema,
  cachedAt: z.string(),
  expiresAt: z.string(),
});

export type CachedContext = z.infer<typeof CachedContextSchema>;

/**
 * MCP write capability map - which sources support MCP writes
 */
export const MCP_WRITE_CAPABLE: Record<string, boolean> = {
  github: true,
  linear: true,
  notion: true,
  email: false,      // Could be enabled with Gmail write scope
  slack: false,      // Could be enabled with Slack write scope
  'google-docs': false,
  'google-slides': false,
  calendar: false,
  'meeting-prep': false,
  'incident-io': false,
  manual: false,
  humaans: false,
  'gemini-notes': false,
  applied: false,
  'dev-analytics': false,
  summary: false,
};

/**
 * Default mode per source type
 */
export const DEFAULT_MODE_BY_SOURCE: Record<string, HelperMode> = {
  github: 'review',         // PRs typically need review
  linear: 'respond',        // Issues need response
  email: 'respond',         // Emails need replies
  slack: 'respond',         // Messages need replies
  notion: 'summarize',      // Pages often need summary
  'meeting-prep': 'schedule',
  calendar: 'schedule',
  'incident-io': 'summarize',
  manual: 'complete',
  summary: 'complete',
};

/**
 * Default context depth by mode
 */
export const DEFAULT_DEPTH_BY_MODE: Record<HelperMode, ContextDepth> = {
  respond: 'standard',
  review: 'comprehensive',
  summarize: 'comprehensive',
  schedule: 'standard',
  research: 'comprehensive',
  complete: 'minimal',
  delegate: 'standard',
  custom: 'comprehensive',
};

/**
 * CLI options for the task helper
 */
export interface TaskHelperOptions {
  todoId?: string;
  mode?: HelperMode;
  outputType?: OutputType;
  depth?: ContextDepth;
  customPrompt?: string;
  refresh?: boolean;      // Force refresh context cache
  interactive?: boolean;  // Interactive mode
  list?: boolean;         // Just list TODOs
  source?: string;        // Filter by source
  priority?: number[];    // Filter by priority
  search?: string;        // Search text
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
}

/**
 * Context gathering options
 */
export interface GatherOptions {
  depth: ContextDepth;
  includeThread: boolean;
  includeRelated: boolean;
  includePeople: boolean;
  includeCalendar: boolean;
  includeWider: boolean;
  maxThreadMessages: number;
  maxRelatedItems: number;
  refresh: boolean;
}

/**
 * Default gathering options
 */
export const DEFAULT_GATHER_OPTIONS: GatherOptions = {
  depth: 'standard',
  includeThread: true,
  includeRelated: true,
  includePeople: true,
  includeCalendar: false,
  includeWider: false,
  maxThreadMessages: 20,
  maxRelatedItems: 10,
  refresh: false,
};
