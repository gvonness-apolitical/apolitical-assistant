import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from '../auth.js';

// Import handler bundles
import { gmailTools, gmailHandlers } from './gmail.js';
import { calendarDefs } from './calendar.js';
import { driveDefs } from './drive.js';
import { docsDefs } from './docs.js';
import { sheetsDefs } from './sheets.js';
import { slidesDefs } from './slides.js';

// Re-export all schemas and handlers for testing
export {
  // Gmail schemas
  GmailSearchSchema,
  GmailGetMessageSchema,
  GmailListLabelsSchema,
  GmailTrashSchema,
  GmailDeleteSchema,
  GmailArchiveSchema,
  GmailSendMessageSchema,
  GmailCreateDraftSchema,
  GmailGetAttachmentsSchema,
  // Gmail handlers
  handleGmailSearch,
  handleGmailGetMessage,
  handleGmailListLabels,
  handleGmailTrash,
  handleGmailDelete,
  handleGmailArchive,
  handleGmailSendMessage,
  handleGmailCreateDraft,
  handleGmailGetAttachments,
} from './gmail.js';

export {
  // Calendar schemas
  CalendarListEventsSchema,
  CalendarGetEventSchema,
  CalendarListCalendarsSchema,
  CalendarGetFreeBusySchema,
  CalendarCreateEventSchema,
  CalendarUpdateEventSchema,
  // Calendar handlers
  handleCalendarListEvents,
  handleCalendarGetEvent,
  handleCalendarListCalendars,
  handleCalendarGetFreeBusy,
  handleCalendarCreateEvent,
  handleCalendarUpdateEvent,
} from './calendar.js';

export {
  // Drive schemas
  DriveSearchSchema,
  DriveGetFileSchema,
  // Drive handlers
  handleDriveSearch,
  handleDriveGetFile,
} from './drive.js';

export {
  // Docs schemas
  DocsGetContentSchema,
  DocsGetCommentsSchema,
  DocsCreateSchema,
  DocsUpdateSchema,
  // Docs handlers
  handleDocsGetContent,
  handleDocsGetComments,
  handleDocsCreate,
  handleDocsUpdate,
} from './docs.js';

export {
  // Sheets schemas
  SheetsGetValuesSchema,
  SheetsGetMetadataSchema,
  // Sheets handlers
  handleSheetsGetValues,
  handleSheetsGetMetadata,
} from './sheets.js';

export {
  // Slides schemas
  SlidesGetPresentationSchema,
  // Slides handlers
  handleSlidesGetPresentation,
} from './slides.js';

// Combine all tools from handler bundles
export const allTools: Tool[] = [
  ...gmailTools,
  ...calendarDefs.tools,
  ...driveDefs.tools,
  ...docsDefs.tools,
  ...sheetsDefs.tools,
  ...slidesDefs.tools,
];

// Combine all handler registries from bundles
export const handlerRegistry: Record<
  string,
  (args: Record<string, unknown>, auth: GoogleAuth) => Promise<unknown>
> = {
  ...gmailHandlers,
  ...calendarDefs.handlers,
  ...driveDefs.handlers,
  ...docsDefs.handlers,
  ...sheetsDefs.handlers,
  ...slidesDefs.handlers,
};
