/**
 * Briefings Module
 *
 * Public API for generating briefings (morning, EOD, weekly).
 */

// Types
export type {
  BriefingType,
  BriefingCalendarEvent,
  BriefingIncident,
  TeamAvailability,
  BriefingCommunication,
  BriefingTodo,
  SummaryReference,
  QuickAction,
  EmailTriageStats,
  BriefingSection,
  BriefingDocument,
  MorningBriefingOptions,
  EodSummaryOptions,
  WeeklyReviewOptions,
} from './types.js';

export {
  BriefingTypeSchema,
  BriefingCalendarEventSchema,
  BriefingIncidentSchema,
  TeamAvailabilitySchema,
  BriefingCommunicationSchema,
  BriefingTodoSchema,
  SummaryReferenceSchema,
  QuickActionSchema,
  EmailTriageStatsSchema,
  BriefingSectionSchema,
  BriefingDocumentSchema,
  MorningBriefingOptionsSchema,
  EodSummaryOptionsSchema,
  WeeklyReviewOptionsSchema,
} from './types.js';

// Config
export {
  loadBriefingsConfig,
  saveBriefingsConfig,
  ensureDirectories,
  getBriefingFilePath,
  getLogFilePath,
  getConfigPath,
  getOutputPath,
  getLogsPath,
  getDatabasePath,
} from './config.js';

export type { BriefingsConfig } from './config.js';

// Morning briefing
export {
  generateMorningBriefing,
  formatBriefingMarkdown,
} from './morning.js';

// EOD summary
export {
  generateEodSummary,
  formatEodMarkdown,
} from './eod.js';

// Weekly review
export {
  generateWeeklyReview,
  formatWeeklyMarkdown,
  getPreviousWeek,
} from './weekly.js';
