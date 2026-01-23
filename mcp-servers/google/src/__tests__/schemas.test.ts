import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
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
  // Calendar schemas
  CalendarListEventsSchema,
  CalendarGetEventSchema,
  CalendarListCalendarsSchema,
  CalendarGetFreeBusySchema,
  CalendarCreateEventSchema,
  CalendarUpdateEventSchema,
  // Drive schemas
  DriveSearchSchema,
  DriveGetFileSchema,
  // Docs schemas
  DocsGetContentSchema,
  DocsGetCommentsSchema,
  // Sheets schemas
  SheetsGetValuesSchema,
  SheetsGetMetadataSchema,
  // Slides schemas
  SlidesGetPresentationSchema,
} from '../handlers/index.js';

describe('Gmail Schemas', () => {
  describe('GmailSearchSchema', () => {
    it('should validate with required query', () => {
      const result = GmailSearchSchema.parse({ query: 'is:unread' });
      expect(result.query).toBe('is:unread');
      expect(result.maxResults).toBe(10); // default
    });

    it('should accept custom maxResults', () => {
      const result = GmailSearchSchema.parse({ query: 'from:test@example.com', maxResults: 25 });
      expect(result.maxResults).toBe(25);
    });

    it('should reject missing query', () => {
      expect(() => GmailSearchSchema.parse({})).toThrow(ZodError);
    });

    it('should reject non-string query', () => {
      expect(() => GmailSearchSchema.parse({ query: 123 })).toThrow(ZodError);
    });
  });

  describe('GmailGetMessageSchema', () => {
    it('should validate with messageId', () => {
      const result = GmailGetMessageSchema.parse({ messageId: 'abc123' });
      expect(result.messageId).toBe('abc123');
    });

    it('should reject missing messageId', () => {
      expect(() => GmailGetMessageSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('GmailListLabelsSchema', () => {
    it('should accept empty object', () => {
      const result = GmailListLabelsSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('GmailTrashSchema', () => {
    it('should validate with messageIds array', () => {
      const result = GmailTrashSchema.parse({ messageIds: ['msg1', 'msg2'] });
      expect(result.messageIds).toEqual(['msg1', 'msg2']);
    });

    it('should accept empty array', () => {
      const result = GmailTrashSchema.parse({ messageIds: [] });
      expect(result.messageIds).toEqual([]);
    });

    it('should reject non-array messageIds', () => {
      expect(() => GmailTrashSchema.parse({ messageIds: 'msg1' })).toThrow(ZodError);
    });
  });

  describe('GmailDeleteSchema', () => {
    it('should validate with messageIds array', () => {
      const result = GmailDeleteSchema.parse({ messageIds: ['msg1'] });
      expect(result.messageIds).toEqual(['msg1']);
    });
  });

  describe('GmailArchiveSchema', () => {
    it('should validate with messageIds array', () => {
      const result = GmailArchiveSchema.parse({ messageIds: ['msg1', 'msg2', 'msg3'] });
      expect(result.messageIds).toHaveLength(3);
    });
  });

  describe('GmailSendMessageSchema', () => {
    it('should validate with required fields', () => {
      const result = GmailSendMessageSchema.parse({
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test body content',
      });
      expect(result.to).toEqual(['recipient@example.com']);
      expect(result.subject).toBe('Test Subject');
      expect(result.body).toBe('Test body content');
    });

    it('should accept optional cc and bcc', () => {
      const result = GmailSendMessageSchema.parse({
        to: ['to@example.com'],
        subject: 'Test',
        body: 'Body',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      });
      expect(result.cc).toEqual(['cc@example.com']);
      expect(result.bcc).toEqual(['bcc@example.com']);
    });

    it('should accept reply fields', () => {
      const result = GmailSendMessageSchema.parse({
        to: ['to@example.com'],
        subject: 'Re: Test',
        body: 'Reply body',
        replyToMessageId: '<original-msg-id>',
        threadId: 'thread123',
      });
      expect(result.replyToMessageId).toBe('<original-msg-id>');
      expect(result.threadId).toBe('thread123');
    });

    it('should reject missing required fields', () => {
      expect(() => GmailSendMessageSchema.parse({ to: ['a@b.com'] })).toThrow(ZodError);
      expect(() => GmailSendMessageSchema.parse({ subject: 'Test' })).toThrow(ZodError);
    });
  });

  describe('GmailCreateDraftSchema', () => {
    it('should validate with required fields', () => {
      const result = GmailCreateDraftSchema.parse({
        to: ['draft@example.com'],
        subject: 'Draft Subject',
        body: 'Draft body',
      });
      expect(result.to).toEqual(['draft@example.com']);
    });

    it('should accept optional fields', () => {
      const result = GmailCreateDraftSchema.parse({
        to: ['to@example.com'],
        subject: 'Test',
        body: 'Body',
        cc: ['cc@example.com'],
        replyToMessageId: 'msg-id',
      });
      expect(result.cc).toEqual(['cc@example.com']);
      expect(result.replyToMessageId).toBe('msg-id');
    });
  });

  describe('GmailGetAttachmentsSchema', () => {
    it('should validate with messageId', () => {
      const result = GmailGetAttachmentsSchema.parse({ messageId: 'msg-with-attachments' });
      expect(result.messageId).toBe('msg-with-attachments');
    });
  });
});

describe('Calendar Schemas', () => {
  describe('CalendarListEventsSchema', () => {
    it('should validate with defaults', () => {
      const result = CalendarListEventsSchema.parse({});
      expect(result.maxResults).toBe(20);
      expect(result.calendarId).toBe('primary');
    });

    it('should accept time range', () => {
      const result = CalendarListEventsSchema.parse({
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-31T23:59:59Z',
      });
      expect(result.timeMin).toBe('2024-01-01T00:00:00Z');
      expect(result.timeMax).toBe('2024-01-31T23:59:59Z');
    });

    it('should accept custom calendar', () => {
      const result = CalendarListEventsSchema.parse({
        calendarId: 'team@group.calendar.google.com',
      });
      expect(result.calendarId).toBe('team@group.calendar.google.com');
    });
  });

  describe('CalendarGetEventSchema', () => {
    it('should validate with required eventId', () => {
      const result = CalendarGetEventSchema.parse({ eventId: 'event123' });
      expect(result.eventId).toBe('event123');
      expect(result.calendarId).toBe('primary');
    });

    it('should accept custom calendarId', () => {
      const result = CalendarGetEventSchema.parse({
        eventId: 'event123',
        calendarId: 'other@calendar.google.com',
      });
      expect(result.calendarId).toBe('other@calendar.google.com');
    });

    it('should reject missing eventId', () => {
      expect(() => CalendarGetEventSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('CalendarListCalendarsSchema', () => {
    it('should validate with defaults', () => {
      const result = CalendarListCalendarsSchema.parse({});
      expect(result.showHidden).toBe(false);
    });

    it('should accept showHidden flag', () => {
      const result = CalendarListCalendarsSchema.parse({ showHidden: true });
      expect(result.showHidden).toBe(true);
    });
  });

  describe('CalendarGetFreeBusySchema', () => {
    it('should validate with required fields', () => {
      const result = CalendarGetFreeBusySchema.parse({
        timeMin: '2024-01-15T09:00:00Z',
        timeMax: '2024-01-15T17:00:00Z',
        calendarIds: ['user1@example.com', 'user2@example.com'],
      });
      expect(result.timeMin).toBe('2024-01-15T09:00:00Z');
      expect(result.calendarIds).toHaveLength(2);
    });

    it('should reject missing required fields', () => {
      expect(() => CalendarGetFreeBusySchema.parse({ timeMin: '2024-01-01' })).toThrow(ZodError);
    });
  });

  describe('CalendarCreateEventSchema', () => {
    it('should validate with required fields', () => {
      const result = CalendarCreateEventSchema.parse({
        summary: 'Team Meeting',
        start: '2024-01-20T10:00:00Z',
        end: '2024-01-20T11:00:00Z',
      });
      expect(result.summary).toBe('Team Meeting');
      expect(result.calendarId).toBe('primary');
      expect(result.sendNotifications).toBe(true);
      expect(result.conferenceData).toBe(false);
    });

    it('should accept all optional fields', () => {
      const result = CalendarCreateEventSchema.parse({
        summary: 'Project Review',
        start: '2024-01-20T14:00:00Z',
        end: '2024-01-20T15:00:00Z',
        description: 'Quarterly project review meeting',
        attendees: ['alice@example.com', 'bob@example.com'],
        location: 'Conference Room A',
        conferenceData: true,
        calendarId: 'team@group.calendar.google.com',
        sendNotifications: false,
      });
      expect(result.description).toBe('Quarterly project review meeting');
      expect(result.attendees).toHaveLength(2);
      expect(result.conferenceData).toBe(true);
      expect(result.sendNotifications).toBe(false);
    });
  });

  describe('CalendarUpdateEventSchema', () => {
    it('should validate with required eventId', () => {
      const result = CalendarUpdateEventSchema.parse({ eventId: 'event-to-update' });
      expect(result.eventId).toBe('event-to-update');
      expect(result.calendarId).toBe('primary');
    });

    it('should accept partial updates', () => {
      const result = CalendarUpdateEventSchema.parse({
        eventId: 'event123',
        summary: 'Updated Title',
        start: '2024-01-20T15:00:00Z',
      });
      expect(result.summary).toBe('Updated Title');
      expect(result.start).toBe('2024-01-20T15:00:00Z');
      expect(result.end).toBeUndefined();
    });
  });
});

describe('Drive Schemas', () => {
  describe('DriveSearchSchema', () => {
    it('should validate with required query', () => {
      const result = DriveSearchSchema.parse({ query: 'project report' });
      expect(result.query).toBe('project report');
      expect(result.maxResults).toBe(10);
    });

    it('should accept mimeType filter', () => {
      const result = DriveSearchSchema.parse({
        query: 'budget',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      });
      expect(result.mimeType).toBe('application/vnd.google-apps.spreadsheet');
    });

    it('should accept custom maxResults', () => {
      const result = DriveSearchSchema.parse({ query: 'test', maxResults: 50 });
      expect(result.maxResults).toBe(50);
    });
  });

  describe('DriveGetFileSchema', () => {
    it('should validate with fileId', () => {
      const result = DriveGetFileSchema.parse({ fileId: '1abc123xyz' });
      expect(result.fileId).toBe('1abc123xyz');
    });

    it('should reject missing fileId', () => {
      expect(() => DriveGetFileSchema.parse({})).toThrow(ZodError);
    });
  });
});

describe('Docs Schemas', () => {
  describe('DocsGetContentSchema', () => {
    it('should validate with documentId', () => {
      const result = DocsGetContentSchema.parse({ documentId: 'doc-id-123' });
      expect(result.documentId).toBe('doc-id-123');
    });

    it('should reject missing documentId', () => {
      expect(() => DocsGetContentSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('DocsGetCommentsSchema', () => {
    it('should validate with required documentId', () => {
      const result = DocsGetCommentsSchema.parse({ documentId: 'doc-123' });
      expect(result.documentId).toBe('doc-123');
      expect(result.includeResolved).toBe(false);
    });

    it('should accept includeResolved flag', () => {
      const result = DocsGetCommentsSchema.parse({
        documentId: 'doc-123',
        includeResolved: true,
      });
      expect(result.includeResolved).toBe(true);
    });
  });
});

describe('Sheets Schemas', () => {
  describe('SheetsGetValuesSchema', () => {
    it('should validate with required fields', () => {
      const result = SheetsGetValuesSchema.parse({
        spreadsheetId: 'sheet-123',
        range: 'Sheet1!A1:D10',
      });
      expect(result.spreadsheetId).toBe('sheet-123');
      expect(result.range).toBe('Sheet1!A1:D10');
    });

    it('should reject missing fields', () => {
      expect(() => SheetsGetValuesSchema.parse({ spreadsheetId: 'sheet-123' })).toThrow(ZodError);
      expect(() => SheetsGetValuesSchema.parse({ range: 'A1:B2' })).toThrow(ZodError);
    });
  });

  describe('SheetsGetMetadataSchema', () => {
    it('should validate with spreadsheetId', () => {
      const result = SheetsGetMetadataSchema.parse({ spreadsheetId: 'sheet-456' });
      expect(result.spreadsheetId).toBe('sheet-456');
    });
  });
});

describe('Slides Schemas', () => {
  describe('SlidesGetPresentationSchema', () => {
    it('should validate with presentationId', () => {
      const result = SlidesGetPresentationSchema.parse({ presentationId: 'presentation-123' });
      expect(result.presentationId).toBe('presentation-123');
    });

    it('should reject missing presentationId', () => {
      expect(() => SlidesGetPresentationSchema.parse({})).toThrow(ZodError);
    });
  });
});
