/**
 * Email Triage Types
 *
 * Type definitions for the email triage module.
 */

import { z } from 'zod';

/**
 * Email classification categories
 */
export const EmailCategorySchema = z.enum([
  'delete',    // Alert emails, notifications, can be deleted
  'archive',   // Reference material, keep but no action
  'fyi',       // Keep me in loop, summarize but no action
  'respond',   // Requires my response → becomes TODO
  'delegate',  // Should be handled by someone else
  'review',    // Needs my attention but no reply needed
]);

export type EmailCategory = z.infer<typeof EmailCategorySchema>;

/**
 * Confidence levels for classification
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Classification method
 */
export const ClassificationMethodSchema = z.enum(['rule', 'llm', 'user']);
export type ClassificationMethod = z.infer<typeof ClassificationMethodSchema>;

/**
 * Email from Gmail
 */
export const EmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  subject: z.string(),
  snippet: z.string(),
  body: z.string().optional(),
  date: z.string(),
  labels: z.array(z.string()),
  hasAttachment: z.boolean(),
  isRead: z.boolean(),
  isStarred: z.boolean(),
  isImportant: z.boolean(),
});

export type Email = z.infer<typeof EmailSchema>;

/**
 * Classification result
 */
export const ClassificationResultSchema = z.object({
  category: EmailCategorySchema,
  confidence: ConfidenceLevelSchema,
  classifiedBy: ClassificationMethodSchema,
  ruleId: z.string().optional(),
  reason: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * Triaged email (email with classification)
 */
export const TriagedEmailSchema = EmailSchema.extend({
  classification: ClassificationResultSchema,
  actionTaken: z.enum(['deleted', 'archived', 'todo_created', 'delegated', 'none']).optional(),
  todoId: z.string().optional(),
  delegatedTo: z.string().optional(),
});

export type TriagedEmail = z.infer<typeof TriagedEmailSchema>;

/**
 * Classification rule conditions
 */
export const RuleConditionsSchema = z.object({
  from: z.array(z.string()).optional(),         // Sender patterns (regex)
  to: z.array(z.string()).optional(),           // Recipient patterns
  cc: z.array(z.string()).optional(),           // CC patterns
  subject: z.array(z.string()).optional(),      // Subject patterns
  body: z.array(z.string()).optional(),         // Body patterns
  labels: z.array(z.string()).optional(),       // Gmail labels
  hasAttachment: z.boolean().optional(),
  isUnread: z.boolean().optional(),
  threadLength: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});

export type RuleConditions = z.infer<typeof RuleConditionsSchema>;

/**
 * Classification rule
 */
export const ClassificationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priority: z.number().default(50),              // Higher = evaluated first
  enabled: z.boolean().default(true),
  conditions: RuleConditionsSchema,
  category: EmailCategorySchema,
  confidence: ConfidenceLevelSchema,
});

export type ClassificationRule = z.infer<typeof ClassificationRuleSchema>;

/**
 * Triage session
 */
export const TriageSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),

  // Input
  query: z.string().optional(),           // Gmail query used
  emailCount: z.number(),

  // Results grouped by category
  groups: z.object({
    delete: z.array(TriagedEmailSchema),
    archive: z.array(TriagedEmailSchema),
    fyi: z.array(TriagedEmailSchema),
    respond: z.array(TriagedEmailSchema),
    delegate: z.array(TriagedEmailSchema),
    review: z.array(TriagedEmailSchema),
    uncategorized: z.array(TriagedEmailSchema),
  }),

  // Statistics
  stats: z.object({
    total: z.number(),
    byCategory: z.record(EmailCategorySchema, z.number()),
    byConfidence: z.record(ConfidenceLevelSchema, z.number()),
    byMethod: z.record(ClassificationMethodSchema, z.number()),
    processed: z.number(),
    skipped: z.number(),
  }),
});

export type TriageSession = z.infer<typeof TriageSessionSchema>;

/**
 * Classification feedback for learning
 */
export const ClassificationFeedbackSchema = z.object({
  emailId: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  predictedCategory: EmailCategorySchema,
  predictedConfidence: ConfidenceLevelSchema,
  predictedBy: ClassificationMethodSchema,
  ruleId: z.string().optional(),
  actualCategory: EmailCategorySchema,
  correctedBy: z.enum(['user', 'auto']),
  timestamp: z.string(),
  sessionId: z.string().optional(),
});

export type ClassificationFeedback = z.infer<typeof ClassificationFeedbackSchema>;

/**
 * Email triage configuration
 */
export const EmailTriageConfigSchema = z.object({
  // Gmail query defaults
  defaultQuery: z.string().default('is:unread'),
  maxResults: z.number().default(100),

  // Auto-action settings
  autoDeleteHighConfidence: z.boolean().default(false),
  autoArchiveHighConfidence: z.boolean().default(false),

  // Learning settings
  feedbackEnabled: z.boolean().default(true),
  minFeedbackForSuggestion: z.number().default(5),  // Min corrections before suggesting rule

  // Category-specific settings
  categorySettings: z.object({
    respond: z.object({
      createTodos: z.boolean().default(true),
      defaultPriority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
    }).default({}),
    delegate: z.object({
      notifyDelegate: z.boolean().default(false),
      defaultDelegates: z.array(z.string()).default([]),
    }).default({}),
    fyi: z.object({
      includeInSummary: z.boolean().default(true),
    }).default({}),
  }).default({}),

  // Custom rules file path
  customRulesPath: z.string().optional(),
});

export type EmailTriageConfig = z.infer<typeof EmailTriageConfigSchema>;

/**
 * Triage action result
 */
export const ActionResultSchema = z.object({
  emailId: z.string(),
  action: z.enum(['delete', 'archive', 'label', 'star', 'mark_read', 'mark_unread', 'create_todo', 'delegate']),
  success: z.boolean(),
  error: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Batch action request
 */
export const BatchActionRequestSchema = z.object({
  emailIds: z.array(z.string()),
  action: z.enum(['delete', 'archive', 'label', 'star', 'mark_read']),
  labelId: z.string().optional(),   // For label action
});

export type BatchActionRequest = z.infer<typeof BatchActionRequestSchema>;
