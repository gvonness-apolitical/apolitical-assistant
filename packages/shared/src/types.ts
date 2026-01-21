import { z } from 'zod';

export const CredentialKeySchema = z.enum([
  'google-oauth-client-id',
  'google-oauth-client-secret',
  'google-refresh-token',
  'slack-token',
  'github-token',
  'linear-api-key',
  'humaans-api-token',
  'incidentio-api-key',
]);

export type CredentialKey = z.infer<typeof CredentialKeySchema>;

export const CREDENTIAL_DESCRIPTIONS: Record<CredentialKey, string> = {
  'google-oauth-client-id': 'Google OAuth Client ID (from Google Cloud Console)',
  'google-oauth-client-secret': 'Google OAuth Client Secret',
  'google-refresh-token': 'Google OAuth Refresh Token (run: npm run google-auth)',
  'slack-token': 'Slack User Token (xoxp-...) - from OAuth & Permissions',
  'github-token': 'GitHub Personal Access Token',
  'linear-api-key': 'Linear API Key',
  'humaans-api-token': 'Humaans API Token',
  'incidentio-api-key': 'Incident.io API Key',
};

export const TodoSourceSchema = z.enum([
  'google-docs',
  'google-slides',
  'notion',
  'slack',
  'humaans',
  'gemini-notes',
  'meeting-prep',
  'email',
  'applied',
  'github',
  'linear',
  'manual',
  'dev-analytics',
  'calendar',
  'incident-io',
  'summary',
]);

export type TodoSource = z.infer<typeof TodoSourceSchema>;

export const TodoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'archived']);

export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoCategorySchema = z.enum(['engineering', 'management', 'business']);

export type TodoCategory = z.infer<typeof TodoCategorySchema>;

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.number().min(1).max(5).default(3),          // Computed effective priority
  basePriority: z.number().min(1).max(5).default(3),      // Original priority
  urgency: z.number().min(1).max(5).default(3),           // Urgency level (1=urgent, 5=not urgent)
  requestDate: z.string().optional(),                      // When the task was requested
  dueDate: z.string().optional(),                          // Soft due date
  deadline: z.string().optional(),                         // Hard deadline
  source: TodoSourceSchema.optional(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),                        // Primary source link
  sourceUrls: z.array(z.string()).optional(),              // All source links (for merged duplicates)
  status: TodoStatusSchema.default('pending'),
  snoozedUntil: z.string().optional(),                     // Snooze until this date
  staleNotifiedAt: z.string().optional(),                  // Last stale notification timestamp
  fingerprint: z.string().optional(),                      // For deduplication
  tags: z.array(z.string()).optional(),                    // Tags for categorization
  category: TodoCategorySchema.optional(),                  // Engineering/Management/Business
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  archivedAt: z.string().optional(),

  // Summary integration
  summaryId: z.string().optional(),                        // Linked summary that created this TODO
  summaryPeriod: z.string().optional(),                    // Period of source summary (e.g., "2025-01-15")
  summaryItemId: z.string().optional(),                    // ID of the summary item this TODO was created from
});

export type Todo = z.infer<typeof TodoSchema>;

export const MeetingSchema = z.object({
  id: z.string(),
  calendarEventId: z.string().optional(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  attendees: z.array(z.string()).optional(),
  talkingPoints: z.array(z.string()).optional(),
  contextNotes: z.string().optional(),
  transcriptPath: z.string().optional(),
  createdAt: z.string(),
});

export type Meeting = z.infer<typeof MeetingSchema>;

export const CommunicationLogSchema = z.object({
  id: z.string(),
  channel: z.enum(['email', 'slack', 'github', 'linear']),
  summary: z.string(),
  importance: z.number().min(1).max(5).default(3),
  actionRequired: z.boolean().default(false),
  loggedAt: z.string(),
});

export type CommunicationLog = z.infer<typeof CommunicationLogSchema>;

export interface BriefingData {
  date: string;
  calendar: {
    meetings: Meeting[];
    focusTimeBlocks: number;
  };
  communications: {
    urgentEmails: number;
    slackMentions: number;
    prReviewsNeeded: number;
  };
  todos: Todo[];
  incidents: {
    active: number;
    recentlyResolved: number;
  };
  teamUpdates: {
    outOfOffice: string[];
    newHires: string[];
  };
}
