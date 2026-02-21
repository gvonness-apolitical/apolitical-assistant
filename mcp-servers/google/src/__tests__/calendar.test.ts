import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockJsonResponse } from '@apolitical-assistant/mcp-shared/testing';
import type { GoogleAuth } from '../auth.js';
import {
  buildWeeklyRRule,
  buildRecurrenceRules,
  handleCalendarGetEvent,
  handleCalendarListCalendars,
  handleCalendarCreateEvent,
  handleCalendarUpdateEvent,
} from '../handlers/index.js';

function createMockAuth(fetchMock: typeof fetch): GoogleAuth {
  return {
    fetch: async (url: string, options?: RequestInit) => {
      return fetchMock(url, options);
    },
    getAccessToken: async () => 'mock-token',
  } as GoogleAuth;
}

describe('buildWeeklyRRule', () => {
  it('should build an RRULE for a single day', () => {
    expect(buildWeeklyRRule(['MO'])).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
  });

  it('should build an RRULE for multiple days', () => {
    expect(buildWeeklyRRule(['TU', 'WE', 'FR'])).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU,WE,FR');
  });

  it('should build an RRULE for all weekdays', () => {
    expect(buildWeeklyRRule(['MO', 'TU', 'WE', 'TH', 'FR'])).toBe(
      'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    );
  });

  it('should throw on empty days array', () => {
    expect(() => buildWeeklyRRule([])).toThrow('Invalid days');
  });

  it('should filter out invalid day codes and succeed with remaining valid ones', () => {
    expect(buildWeeklyRRule(['MO', 'XX' as 'MO', 'FR'])).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,FR');
  });

  it('should throw when all day codes are invalid', () => {
    expect(() => buildWeeklyRRule(['ZZ' as 'MO', 'YY' as 'MO'])).toThrow('Invalid days');
  });
});

describe('buildRecurrenceRules', () => {
  it('should return undefined when recurrence is undefined', () => {
    expect(buildRecurrenceRules(undefined)).toBeUndefined();
  });

  it('should return raw RRULE strings as-is', () => {
    const rules = ['RRULE:FREQ=DAILY;COUNT=5'];
    expect(buildRecurrenceRules(rules)).toEqual(rules);
  });

  it('should return multiple raw RRULE strings as-is', () => {
    const rules = ['RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE:20240115T100000Z'];
    expect(buildRecurrenceRules(rules)).toEqual(rules);
  });

  it('should build a daily RRULE from object', () => {
    expect(buildRecurrenceRules({ frequency: 'daily', interval: 1 })).toEqual(['RRULE:FREQ=DAILY']);
  });

  it('should include INTERVAL only when greater than 1', () => {
    expect(buildRecurrenceRules({ frequency: 'weekly', interval: 2 })).toEqual([
      'RRULE:FREQ=WEEKLY;INTERVAL=2',
    ]);
  });

  it('should include BYDAY for weekly recurrence with days', () => {
    expect(buildRecurrenceRules({ frequency: 'weekly', days: ['TU', 'TH'], interval: 1 })).toEqual([
      'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
    ]);
  });

  it('should include COUNT when specified', () => {
    expect(buildRecurrenceRules({ frequency: 'monthly', interval: 1, count: 12 })).toEqual([
      'RRULE:FREQ=MONTHLY;COUNT=12',
    ]);
  });

  it('should include UNTIL when specified and count is absent', () => {
    expect(buildRecurrenceRules({ frequency: 'yearly', interval: 1, until: '20261231' })).toEqual([
      'RRULE:FREQ=YEARLY;UNTIL=20261231',
    ]);
  });

  it('should prefer COUNT over UNTIL when both are specified', () => {
    expect(
      buildRecurrenceRules({ frequency: 'daily', interval: 1, count: 5, until: '20261231' })
    ).toEqual(['RRULE:FREQ=DAILY;COUNT=5']);
  });
});

describe('handleCalendarGetEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  it('should return the event JSON from the API', async () => {
    const eventData = {
      id: 'evt-123',
      summary: 'Sprint Review',
      start: { dateTime: '2026-02-21T14:00:00Z' },
      end: { dateTime: '2026-02-21T15:00:00Z' },
    };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(eventData));

    const result = await handleCalendarGetEvent(
      { eventId: 'evt-123', calendarId: 'primary' },
      auth
    );

    expect(result).toEqual(eventData);
  });

  it('should URL-encode calendarId and eventId', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: 'e1' }));

    await handleCalendarGetEvent({ eventId: 'abc/def', calendarId: 'user@example.com' }, auth);

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(encodeURIComponent('user@example.com'));
    expect(url).toContain(encodeURIComponent('abc/def'));
  });

  it('should throw on API error', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

    await expect(
      handleCalendarGetEvent({ eventId: 'bad-id', calendarId: 'primary' }, auth)
    ).rejects.toThrow('Calendar API error: 404');
  });
});

describe('handleCalendarListCalendars', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  it('should format calendar entries with isRoom detection', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        items: [
          {
            id: 'user@example.com',
            summary: 'My Calendar',
            primary: true,
            accessRole: 'owner',
          },
          {
            id: 'room-abc@resource.calendar.google.com',
            summary: 'Meeting Room A',
            accessRole: 'reader',
            description: 'Ground floor',
          },
        ],
      })
    );

    const result = (await handleCalendarListCalendars({ showHidden: false }, auth)) as Array<{
      id: string;
      name: string;
      primary: boolean;
      isRoom: boolean;
      description?: string;
    }>;

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('My Calendar');
    expect(result[0]?.primary).toBe(true);
    expect(result[0]?.isRoom).toBe(false);
    expect(result[1]?.name).toBe('Meeting Room A');
    expect(result[1]?.isRoom).toBe(true);
    expect(result[1]?.description).toBe('Ground floor');
  });

  it('should pass showHidden parameter when true', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ items: [] }));

    await handleCalendarListCalendars({ showHidden: true }, auth);

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('showHidden=true');
  });

  it('should not include showHidden param when false', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ items: [] }));

    await handleCalendarListCalendars({ showHidden: false }, auth);

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).not.toContain('showHidden');
  });

  it('should throw on API error', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));

    await expect(handleCalendarListCalendars({ showHidden: false }, auth)).rejects.toThrow(
      'Calendar API error: 500'
    );
  });
});

describe('handleCalendarCreateEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  it('should create a timed event', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'new-evt',
        htmlLink: 'https://calendar.google.com/event/new-evt',
        summary: 'Standup',
        start: { dateTime: '2026-02-21T09:00:00Z' },
        end: { dateTime: '2026-02-21T09:30:00Z' },
      })
    );

    const result = (await handleCalendarCreateEvent(
      {
        summary: 'Standup',
        start: '2026-02-21T09:00:00Z',
        end: '2026-02-21T09:30:00Z',
        allDay: false,
        conferenceData: false,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    )) as { success: boolean; eventId: string; title: string; start: string; end: string };

    expect(result.success).toBe(true);
    expect(result.eventId).toBe('new-evt');
    expect(result.title).toBe('Standup');
    expect(result.start).toBe('2026-02-21T09:00:00Z');

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.start).toEqual({ dateTime: '2026-02-21T09:00:00Z' });
    expect(body.end).toEqual({ dateTime: '2026-02-21T09:30:00Z' });
  });

  it('should create an all-day event with allDay flag', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'allday-evt',
        htmlLink: 'https://calendar.google.com/event/allday-evt',
        summary: 'Holiday',
        start: { date: '2026-12-25' },
        end: { date: '2026-12-26' },
      })
    );

    await handleCalendarCreateEvent(
      {
        summary: 'Holiday',
        start: '2026-12-25',
        end: '2026-12-26',
        allDay: true,
        conferenceData: false,
        calendarId: 'primary',
        sendNotifications: false,
      },
      auth
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.start).toEqual({ date: '2026-12-25' });
    expect(body.end).toEqual({ date: '2026-12-26' });
  });

  it('should auto-detect all-day events from date-only start string', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'auto-allday',
        htmlLink: 'https://calendar.google.com/event/auto-allday',
        summary: 'Off-site',
        start: { date: '2026-03-01' },
        end: { date: '2026-03-02' },
      })
    );

    await handleCalendarCreateEvent(
      {
        summary: 'Off-site',
        start: '2026-03-01',
        end: '2026-03-02',
        allDay: false,
        conferenceData: false,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.start).toEqual({ date: '2026-03-01' });
  });

  it('should include attendees when provided', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'att-evt',
        htmlLink: 'https://calendar.google.com/event/att-evt',
        summary: 'Sync',
        start: { dateTime: '2026-02-21T10:00:00Z' },
        end: { dateTime: '2026-02-21T10:30:00Z' },
      })
    );

    await handleCalendarCreateEvent(
      {
        summary: 'Sync',
        start: '2026-02-21T10:00:00Z',
        end: '2026-02-21T10:30:00Z',
        attendees: ['alice@example.com', 'bob@example.com'],
        allDay: false,
        conferenceData: false,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.attendees).toEqual([{ email: 'alice@example.com' }, { email: 'bob@example.com' }]);
  });

  it('should include recurrence rules from simplified object', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'rec-evt',
        htmlLink: 'https://calendar.google.com/event/rec-evt',
        summary: 'Weekly Standup',
        start: { dateTime: '2026-02-24T09:00:00Z' },
        end: { dateTime: '2026-02-24T09:30:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
      })
    );

    const result = (await handleCalendarCreateEvent(
      {
        summary: 'Weekly Standup',
        start: '2026-02-24T09:00:00Z',
        end: '2026-02-24T09:30:00Z',
        recurrence: { frequency: 'weekly', days: ['MO', 'WE', 'FR'], interval: 1 },
        allDay: false,
        conferenceData: false,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    )) as { recurrence: string[] };

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']);
    expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']);
  });

  it('should add conferenceData and conferenceDataVersion when requested', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'meet-evt',
        htmlLink: 'https://calendar.google.com/event/meet-evt',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        summary: 'Video Call',
        start: { dateTime: '2026-02-21T11:00:00Z' },
        end: { dateTime: '2026-02-21T12:00:00Z' },
      })
    );

    const result = (await handleCalendarCreateEvent(
      {
        summary: 'Video Call',
        start: '2026-02-21T11:00:00Z',
        end: '2026-02-21T12:00:00Z',
        conferenceData: true,
        allDay: false,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    )) as { meetLink: string };

    expect(result.meetLink).toBe('https://meet.google.com/abc-defg-hij');

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('conferenceDataVersion=1');

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
  });

  it('should throw on API error with response text', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ error: 'Forbidden' }, false, 403));

    await expect(
      handleCalendarCreateEvent(
        {
          summary: 'Fail',
          start: '2026-02-21T09:00:00Z',
          end: '2026-02-21T10:00:00Z',
          allDay: false,
          conferenceData: false,
          calendarId: 'primary',
          sendNotifications: true,
        },
        auth
      )
    ).rejects.toThrow('Calendar create error: 403');
  });
});

describe('handleCalendarUpdateEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let auth: GoogleAuth;

  beforeEach(() => {
    fetchMock = vi.fn();
    auth = createMockAuth(fetchMock as typeof fetch);
  });

  it('should update only provided fields on an existing event', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-1',
        summary: 'Old Title',
        description: 'Keep this',
        start: { dateTime: '2026-02-21T09:00:00Z' },
        end: { dateTime: '2026-02-21T10:00:00Z' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-1',
        htmlLink: 'https://calendar.google.com/event/evt-1',
        summary: 'New Title',
      })
    );

    const result = (await handleCalendarUpdateEvent(
      {
        eventId: 'evt-1',
        summary: 'New Title',
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    )) as { success: boolean; title: string };

    expect(result.success).toBe(true);
    expect(result.title).toBe('New Title');

    const putBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
    expect(putBody.summary).toBe('New Title');
    expect(putBody.description).toBe('Keep this');
  });

  it('should convert a timed event to all-day', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-2',
        summary: 'Sprint Day',
        start: { dateTime: '2026-02-21T09:00:00Z' },
        end: { dateTime: '2026-02-21T17:00:00Z' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-2',
        htmlLink: 'https://calendar.google.com/event/evt-2',
        summary: 'Sprint Day',
      })
    );

    await handleCalendarUpdateEvent(
      {
        eventId: 'evt-2',
        start: '2026-02-21',
        end: '2026-02-22',
        allDay: true,
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    );

    const putBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
    expect(putBody.start).toEqual({ date: '2026-02-21' });
    expect(putBody.end).toEqual({ date: '2026-02-22' });
  });

  it('should preserve all-day format when updating an existing all-day event', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-3',
        summary: 'Conference',
        start: { date: '2026-03-10' },
        end: { date: '2026-03-12' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-3',
        htmlLink: 'https://calendar.google.com/event/evt-3',
        summary: 'Tech Conference',
      })
    );

    await handleCalendarUpdateEvent(
      {
        eventId: 'evt-3',
        summary: 'Tech Conference',
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    );

    const putBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
    expect(putBody.start).toEqual({ date: '2026-03-10' });
    expect(putBody.summary).toBe('Tech Conference');
  });

  it('should add recurrence to an existing event', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-4',
        summary: 'Standup',
        start: { dateTime: '2026-02-24T09:00:00Z' },
        end: { dateTime: '2026-02-24T09:15:00Z' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-4',
        htmlLink: 'https://calendar.google.com/event/evt-4',
        summary: 'Standup',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=10'],
      })
    );

    const result = (await handleCalendarUpdateEvent(
      {
        eventId: 'evt-4',
        recurrence: { frequency: 'daily', interval: 1, count: 10 },
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    )) as { recurrence: string[] };

    const putBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
    expect(putBody.recurrence).toEqual(['RRULE:FREQ=DAILY;COUNT=10']);
    expect(result.recurrence).toEqual(['RRULE:FREQ=DAILY;COUNT=10']);
  });

  it('should remove recurrence when passed an empty array', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-5',
        summary: 'Was Recurring',
        start: { dateTime: '2026-02-24T09:00:00Z' },
        end: { dateTime: '2026-02-24T09:15:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-5',
        htmlLink: 'https://calendar.google.com/event/evt-5',
        summary: 'Was Recurring',
      })
    );

    await handleCalendarUpdateEvent(
      {
        eventId: 'evt-5',
        recurrence: [],
        calendarId: 'primary',
        sendNotifications: true,
      },
      auth
    );

    const putBody = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string);
    expect(putBody.recurrence).toBeUndefined();
  });

  it('should use PUT method with sendUpdates param', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-6',
        summary: 'Test',
        start: { dateTime: '2026-02-21T09:00:00Z' },
        end: { dateTime: '2026-02-21T10:00:00Z' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-6',
        htmlLink: 'https://calendar.google.com/event/evt-6',
        summary: 'Test Updated',
      })
    );

    await handleCalendarUpdateEvent(
      {
        eventId: 'evt-6',
        summary: 'Test Updated',
        calendarId: 'primary',
        sendNotifications: false,
      },
      auth
    );

    const putUrl = fetchMock.mock.calls[1]![0] as string;
    expect(putUrl).toContain('sendUpdates=none');
    expect(fetchMock.mock.calls[1]![1]?.method).toBe('PUT');
  });

  it('should throw when the initial GET fails', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 404));

    await expect(
      handleCalendarUpdateEvent(
        {
          eventId: 'missing',
          summary: 'Nope',
          calendarId: 'primary',
          sendNotifications: true,
        },
        auth
      )
    ).rejects.toThrow('Calendar API error: 404');
  });

  it('should throw when the PUT fails', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 'evt-7',
        summary: 'Existing',
        start: { dateTime: '2026-02-21T09:00:00Z' },
        end: { dateTime: '2026-02-21T10:00:00Z' },
      })
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ error: 'Conflict' }, false, 409));

    await expect(
      handleCalendarUpdateEvent(
        {
          eventId: 'evt-7',
          summary: 'Conflict',
          calendarId: 'primary',
          sendNotifications: true,
        },
        auth
      )
    ).rejects.toThrow('Calendar update error: 409');
  });
});
