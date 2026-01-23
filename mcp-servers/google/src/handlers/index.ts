import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GoogleAuth } from '../auth.js';

// Import tools and handlers from each module
import {
  gmailTools,
  GmailSearchSchema,
  GmailGetMessageSchema,
  GmailListLabelsSchema,
  GmailTrashSchema,
  GmailDeleteSchema,
  GmailArchiveSchema,
  GmailSendMessageSchema,
  GmailCreateDraftSchema,
  GmailGetAttachmentsSchema,
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

import {
  calendarTools,
  CalendarListEventsSchema,
  CalendarGetEventSchema,
  CalendarListCalendarsSchema,
  CalendarGetFreeBusySchema,
  CalendarCreateEventSchema,
  CalendarUpdateEventSchema,
  handleCalendarListEvents,
  handleCalendarGetEvent,
  handleCalendarListCalendars,
  handleCalendarGetFreeBusy,
  handleCalendarCreateEvent,
  handleCalendarUpdateEvent,
} from './calendar.js';

import {
  driveTools,
  DriveSearchSchema,
  DriveGetFileSchema,
  handleDriveSearch,
  handleDriveGetFile,
} from './drive.js';

import {
  docsTools,
  DocsGetContentSchema,
  DocsGetCommentsSchema,
  handleDocsGetContent,
  handleDocsGetComments,
} from './docs.js';

import {
  sheetsTools,
  SheetsGetValuesSchema,
  SheetsGetMetadataSchema,
  handleSheetsGetValues,
  handleSheetsGetMetadata,
} from './sheets.js';

import {
  slidesTools,
  SlidesGetPresentationSchema,
  handleSlidesGetPresentation,
} from './slides.js';

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
  // Drive schemas
  DriveSearchSchema,
  DriveGetFileSchema,
  // Drive handlers
  handleDriveSearch,
  handleDriveGetFile,
  // Docs schemas
  DocsGetContentSchema,
  DocsGetCommentsSchema,
  // Docs handlers
  handleDocsGetContent,
  handleDocsGetComments,
  // Sheets schemas
  SheetsGetValuesSchema,
  SheetsGetMetadataSchema,
  // Sheets handlers
  handleSheetsGetValues,
  handleSheetsGetMetadata,
  // Slides schemas
  SlidesGetPresentationSchema,
  // Slides handlers
  handleSlidesGetPresentation,
};

// Combine all tools into a single array
export const allTools: Tool[] = [
  ...gmailTools,
  ...calendarTools,
  ...driveTools,
  ...docsTools,
  ...sheetsTools,
  ...slidesTools,
];

// Handler type definition
type Handler = (args: Record<string, unknown>, auth: GoogleAuth) => Promise<unknown>;

// Handler registry maps tool names to their handler functions
export const handlerRegistry: Record<string, Handler> = {
  // Gmail handlers
  gmail_search: (args, auth) => handleGmailSearch(GmailSearchSchema.parse(args), auth),
  gmail_get_message: (args, auth) => handleGmailGetMessage(GmailGetMessageSchema.parse(args), auth),
  gmail_list_labels: (_, auth) => handleGmailListLabels(auth),
  gmail_trash: (args, auth) => handleGmailTrash(GmailTrashSchema.parse(args), auth),
  gmail_delete: (args, auth) => handleGmailDelete(GmailDeleteSchema.parse(args), auth),
  gmail_archive: (args, auth) => handleGmailArchive(GmailArchiveSchema.parse(args), auth),
  gmail_send_message: (args, auth) => handleGmailSendMessage(GmailSendMessageSchema.parse(args), auth),
  gmail_create_draft: (args, auth) => handleGmailCreateDraft(GmailCreateDraftSchema.parse(args), auth),
  gmail_get_attachments: (args, auth) => handleGmailGetAttachments(GmailGetAttachmentsSchema.parse(args), auth),

  // Calendar handlers
  calendar_list_events: (args, auth) => handleCalendarListEvents(CalendarListEventsSchema.parse(args), auth),
  calendar_get_event: (args, auth) => handleCalendarGetEvent(CalendarGetEventSchema.parse(args), auth),
  calendar_list_calendars: (args, auth) => handleCalendarListCalendars(CalendarListCalendarsSchema.parse(args), auth),
  calendar_get_freebusy: (args, auth) => handleCalendarGetFreeBusy(CalendarGetFreeBusySchema.parse(args), auth),
  calendar_create_event: (args, auth) => handleCalendarCreateEvent(CalendarCreateEventSchema.parse(args), auth),
  calendar_update_event: (args, auth) => handleCalendarUpdateEvent(CalendarUpdateEventSchema.parse(args), auth),

  // Drive handlers
  drive_search: (args, auth) => handleDriveSearch(DriveSearchSchema.parse(args), auth),
  drive_get_file: (args, auth) => handleDriveGetFile(DriveGetFileSchema.parse(args), auth),

  // Docs handlers
  docs_get_content: (args, auth) => handleDocsGetContent(DocsGetContentSchema.parse(args), auth),
  docs_get_comments: (args, auth) => handleDocsGetComments(DocsGetCommentsSchema.parse(args), auth),

  // Sheets handlers
  sheets_get_values: (args, auth) => handleSheetsGetValues(SheetsGetValuesSchema.parse(args), auth),
  sheets_get_metadata: (args, auth) => handleSheetsGetMetadata(SheetsGetMetadataSchema.parse(args), auth),

  // Slides handlers
  slides_get_presentation: (args, auth) => handleSlidesGetPresentation(SlidesGetPresentationSchema.parse(args), auth),
};
