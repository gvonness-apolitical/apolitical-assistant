/**
 * Meetings Module
 *
 * Public API for meeting preparation, agenda generation, and 1:1 scripts.
 */

// Types
export type {
  MeetingType,
  Attendee,
  CalendarEvent,
  DirectReport,
  AttendeeContext,
  AgendaItem,
  OneOnOneScript,
  MeetingPrep,
  ActionItemTracking,
  Previous121Note,
  MeetingConfig,
} from './types.js';

export {
  MeetingTypeSchema,
  AttendeeSchema,
  CalendarEventSchema,
  DirectReportSchema,
  AttendeeContextSchema,
  AgendaItemSchema,
  OneOnOneScriptSchema,
  MeetingPrepSchema,
  ActionItemTrackingSchema,
  Previous121NoteSchema,
  MeetingConfigSchema,
} from './types.js';

// Config
export {
  loadMeetingConfig,
  saveMeetingConfig,
  clearConfigCache,
  getConfigPath,
  getOutputPath,
  getMeetingPrepPath,
  get121PrepPath,
  ensureDirectories,
  meetingPrepExists,
  oneOnOnePrepExists,
} from './config.js';

// Detection
export {
  detectMeetingType,
  isLeadingMeeting,
  getMeetingTypeDisplayName,
} from './detect.js';

// Context
export {
  gatherAttendeeContext,
  formatAttendeeContext,
} from './context.js';

// Agenda generation
export {
  generateAgenda,
  calculateAgendaDuration,
  agendaFitsMeeting,
} from './agenda.js';

// 1:1 scripts
export {
  generate121Script,
  format121Script,
  get121PrepSummary,
} from './one-on-one.js';

// Action items
export {
  get121ActionItems,
  createActionItem,
  completeActionItem,
  linkActionItemToTodo,
  filterActionItems,
  getActionItemStats,
  formatActionItems,
} from './action-items.js';

// History
export {
  findPrevious121Notes,
  parseActionItems,
  extractTopicsFromNote,
  getLastMeetingDate,
  formatPreviousNotesSummary,
} from './history.js';

// Markdown output
export {
  formatMeetingPrepMarkdown,
  saveMeetingPrep,
  formatDailyMeetingOverview,
} from './markdown.js';
