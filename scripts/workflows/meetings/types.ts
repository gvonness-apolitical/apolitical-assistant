/**
 * Meeting Types
 *
 * Type definitions for the meetings module.
 */

import { z } from 'zod';
import type { CollectorSource } from '../config/schemas.js';

/**
 * Meeting type classification
 */
export const MeetingTypeSchema = z.enum([
  'one-on-one',      // 1:1 with direct report
  'team-meeting',    // Team standup, retro, etc.
  'leadership',      // Leadership/exec meetings
  'external',        // External stakeholders
  'other'
]);

export type MeetingType = z.infer<typeof MeetingTypeSchema>;

/**
 * Attendee information
 */
export interface Attendee {
  email: string;
  name?: string;
  role?: string;
  team?: string;
  isDirectReport: boolean;
  isOrganizer: boolean;
}

/**
 * Attendee context gathered from various sources
 */
export interface AttendeeContext {
  email: string;
  name: string;
  role?: string;
  team?: string;
  isDirectReport: boolean;

  // Gathered context
  recentActivity: {
    deliveryMetrics?: unknown;           // From dev-analytics
    prsAndReviews?: unknown[];           // From GitHub
    linearIssues?: unknown[];            // From Linear
    slackHighlights?: unknown[];         // From Slack
    emailThreads?: unknown[];            // From email
    timeOff?: unknown[];                 // From Humaans
  };

  // From previous 1:1s
  previousTopics?: string[];
  openActionItems?: ActionItemTracking[];
}

/**
 * Action item tracking for 1:1s
 */
export interface ActionItemTracking {
  id: string;
  text: string;
  createdAt: string;
  createdIn121With: string;       // Attendee email
  source: string;                 // URL to source doc

  // Tracking
  linkedTodoId?: string;          // If converted to TODO
  status: 'open' | 'completed' | 'stale';
  completedAt?: string;
  staleAfterDays: number;         // Default 14
}

/**
 * Source reference for agenda items
 */
export interface SourceReference {
  type: CollectorSource;
  url?: string;
  title?: string;
}

/**
 * Agenda item
 */
export interface AgendaItem {
  topic: string;
  context?: string;
  suggestedDuration?: number;     // minutes
  sources: SourceReference[];
}

/**
 * 1:1 script sections
 */
export interface OneOnOneScript {
  openingTopics: string[];        // Check-in, wellbeing
  performanceDiscussion: string[];  // Metrics, recent work
  developmentTopics: string[];    // Growth, learning
  actionItemReview: string[];     // Previous action items
  closingItems: string[];         // Next steps, support needed
}

/**
 * Meeting preparation document
 */
export interface MeetingPrep {
  id: string;
  calendarEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingType: MeetingType;
  isLeading: boolean;             // Am I the organizer/leader?

  attendees: AttendeeContext[];

  // Generated content
  agendaItems: AgendaItem[];

  // For 1:1s specifically
  oneOnOneScript?: OneOnOneScript;

  generatedAt: string;
  filePath: string;
}

/**
 * Previous 1:1 note structure
 */
export interface Previous121Note {
  date: string;
  source: 'notion' | 'google-docs';
  url: string;
  topics: string[];
  actionItems: ActionItemTracking[];
  notes: string;
}

/**
 * Calendar event structure
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: Attendee[];
  location?: string;
  description?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
}

/**
 * Meeting prep options
 */
export interface PrepOptions {
  date?: string;                  // Date to prep for (default: today)
  eventId?: string;               // Specific event to prep
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;                // Regenerate even if exists
}

/**
 * Meeting generation result
 */
export interface MeetingPrepResult {
  prep: MeetingPrep;
  collectionStatus: {
    source: CollectorSource;
    status: 'success' | 'partial' | 'failed';
    error?: string;
  }[];
  warnings: string[];
}

/**
 * Meeting config schema
 */
export const MeetingConfigSchema = z.object({
  outputPath: z.string().default('./meetings/output'),
  directReportEmails: z.array(z.string()).default([]),  // Auto-discovered from Humaans
  oneOnOneSettings: z.object({
    lookbackDays: z.number().default(14),
    includeDeliveryMetrics: z.boolean().default(true),
    includeSlackHighlights: z.boolean().default(true),
    includeEmailThreads: z.boolean().default(true),
    includeGitHubActivity: z.boolean().default(true),
    includeLinearIssues: z.boolean().default(true),
    includeTimeOff: z.boolean().default(true),
    actionItemStaleDays: z.number().default(14),
  }).default({}),
  agendaSettings: z.object({
    defaultDurationMinutes: z.number().default(30),
    includeRecentDocs: z.boolean().default(true),
    includeRecentIncidents: z.boolean().default(true),
  }).default({}),
  meetingTypeOverrides: z.record(z.string(), MeetingTypeSchema).default({}),  // title pattern -> type
});

export type MeetingConfig = z.infer<typeof MeetingConfigSchema>;

/**
 * Direct report info
 */
export interface DirectReport {
  email: string;
  name: string;
  role?: string;
  team?: string;
  startDate?: string;
}
