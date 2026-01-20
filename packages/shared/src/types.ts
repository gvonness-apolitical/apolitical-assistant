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
  'notion-api-key',
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
  'notion-api-key': 'Notion Integration Token',
};

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.number().min(1).max(5).default(3),
  dueDate: z.string().optional(),
  source: z.string().optional(),
  sourceId: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  createdAt: z.string(),
  updatedAt: z.string(),
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
