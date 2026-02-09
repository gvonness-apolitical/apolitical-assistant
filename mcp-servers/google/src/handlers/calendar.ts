import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import type { GoogleAuth } from '../auth.js';

// ==================== RECURRENCE HELPERS ====================

/**
 * Valid day codes for weekly recurrence (RFC 5545)
 */
const VALID_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
type DayCode = (typeof VALID_DAYS)[number];

/**
 * Build an RRULE string from a simple weekly pattern.
 * @example buildWeeklyRRule(['TU', 'WE', 'FR']) => 'RRULE:FREQ=WEEKLY;BYDAY=TU,WE,FR'
 */
export function buildWeeklyRRule(days: DayCode[]): string {
  const validDays = days.filter((d) => VALID_DAYS.includes(d));
  if (validDays.length === 0) {
    throw new Error(`Invalid days: ${days.join(', ')}. Must be one of: ${VALID_DAYS.join(', ')}`);
  }
  return `RRULE:FREQ=WEEKLY;BYDAY=${validDays.join(',')}`;
}

/**
 * Schema for recurrence - supports both raw RRULE strings and simplified weekly pattern
 */
const RecurrenceSchema = z
  .union([
    z.array(z.string()).describe('Array of RRULE/EXDATE strings (RFC 5545 format)'),
    z
      .object({
        frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe('Recurrence frequency'),
        days: z
          .array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']))
          .optional()
          .describe('Days of week for weekly recurrence (e.g., ["TU", "WE", "FR"])'),
        interval: z.number().optional().default(1).describe('Interval between occurrences'),
        count: z.number().optional().describe('Number of occurrences (optional)'),
        until: z.string().optional().describe('End date in YYYYMMDD format (optional)'),
      })
      .describe('Simplified recurrence pattern'),
  ])
  .optional();

/**
 * Convert simplified recurrence object to RRULE array
 */
export function buildRecurrenceRules(
  recurrence: z.infer<typeof RecurrenceSchema>
): string[] | undefined {
  if (!recurrence) return undefined;

  // If already an array of strings, return as-is
  if (Array.isArray(recurrence) && typeof recurrence[0] === 'string') {
    return recurrence as string[];
  }

  // Build RRULE from simplified object
  const rec = recurrence as {
    frequency: string;
    days?: string[];
    interval?: number;
    count?: number;
    until?: string;
  };

  const parts: string[] = [`FREQ=${rec.frequency.toUpperCase()}`];

  if (rec.interval && rec.interval > 1) {
    parts.push(`INTERVAL=${rec.interval}`);
  }

  if (rec.days && rec.days.length > 0) {
    parts.push(`BYDAY=${rec.days.join(',')}`);
  }

  if (rec.count) {
    parts.push(`COUNT=${rec.count}`);
  } else if (rec.until) {
    parts.push(`UNTIL=${rec.until}`);
  }

  return [`RRULE:${parts.join(';')}`];
}

// ==================== ZOD SCHEMAS ====================

export const CalendarListEventsSchema = z.object({
  timeMin: z.string().optional().describe('Start time (ISO format, defaults to now)'),
  timeMax: z.string().optional().describe('End time (ISO format, defaults to 7 days from now)'),
  maxResults: z.number().optional().default(20).describe('Maximum number of events to return'),
  calendarId: z
    .string()
    .optional()
    .default('primary')
    .describe('Calendar ID (defaults to primary)'),
});

export const CalendarGetEventSchema = z.object({
  eventId: z.string().describe('The calendar event ID'),
  calendarId: z
    .string()
    .optional()
    .default('primary')
    .describe('Calendar ID (defaults to primary)'),
});

export const CalendarListCalendarsSchema = z.object({
  showHidden: z.boolean().optional().default(false).describe('Include hidden calendars'),
});

export const CalendarGetFreeBusySchema = z.object({
  timeMin: z.string().describe('Start of time range (ISO format)'),
  timeMax: z.string().describe('End of time range (ISO format)'),
  calendarIds: z
    .array(z.string())
    .describe(
      'Array of calendar IDs to check (use email addresses for people, resource IDs for rooms)'
    ),
});

export const CalendarCreateEventSchema = z.object({
  summary: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  start: z.string().describe('Start time (ISO format) or date (YYYY-MM-DD for all-day events)'),
  end: z.string().describe('End time (ISO format) or date (YYYY-MM-DD for all-day events)'),
  allDay: z.boolean().optional().default(false).describe('Create as all-day event'),
  attendees: z.array(z.string()).optional().describe('Array of attendee email addresses'),
  location: z.string().optional().describe('Event location or meeting room'),
  conferenceData: z.boolean().optional().default(false).describe('Generate a Google Meet link'),
  calendarId: z.string().optional().default('primary').describe('Calendar to create event on'),
  sendNotifications: z
    .boolean()
    .optional()
    .default(true)
    .describe('Send email invitations to attendees'),
  recurrence: RecurrenceSchema.describe(
    'Recurrence rule - either RRULE strings or simplified pattern like {frequency: "weekly", days: ["TU", "WE", "FR"]}'
  ),
});

export const CalendarUpdateEventSchema = z.object({
  eventId: z
    .string()
    .describe(
      'The event ID to update. For recurring events, use base ID (without date suffix) to update the series, or instance ID to update single occurrence'
    ),
  summary: z.string().optional().describe('New event title'),
  description: z.string().optional().describe('New event description'),
  start: z
    .string()
    .optional()
    .describe('New start time (ISO format) or date (YYYY-MM-DD for all-day events)'),
  end: z
    .string()
    .optional()
    .describe('New end time (ISO format) or date (YYYY-MM-DD for all-day events)'),
  allDay: z.boolean().optional().describe('Convert to/from all-day event'),
  attendees: z
    .array(z.string())
    .optional()
    .describe('Array of attendee email addresses (replaces existing)'),
  location: z.string().optional().describe('New location'),
  calendarId: z.string().optional().default('primary').describe('Calendar the event is on'),
  sendNotifications: z
    .boolean()
    .optional()
    .default(true)
    .describe('Send update notifications to attendees'),
  recurrence: RecurrenceSchema.describe(
    'New recurrence rule - either RRULE strings or simplified pattern. Set to empty array to remove recurrence.'
  ),
});

// ==================== HANDLER FUNCTIONS ====================

export async function handleCalendarListEvents(
  args: z.infer<typeof CalendarListEventsSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const timeMin = args.timeMin || new Date().toISOString();
  const timeMax = args.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events`
  );
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', args.maxResults.toString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await auth.fetch(url.toString());
  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

  const data = (await response.json()) as {
    items: Array<{
      id: string;
      summary: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string; displayName?: string; responseStatus: string }>;
      location?: string;
      hangoutLink?: string;
    }>;
  };

  return data.items.map((event) => ({
    id: event.id,
    title: event.summary,
    description: event.description,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    location: event.location,
    meetLink: event.hangoutLink,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      name: a.displayName,
      status: a.responseStatus,
    })),
  }));
}

export async function handleCalendarGetEvent(
  args: z.infer<typeof CalendarGetEventSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.eventId)}`;
  const response = await auth.fetch(url);
  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

  return await response.json();
}

export async function handleCalendarListCalendars(
  args: z.infer<typeof CalendarListCalendarsSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  if (args.showHidden) url.searchParams.set('showHidden', 'true');

  const response = await auth.fetch(url.toString());
  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

  const data = (await response.json()) as {
    items: Array<{
      id: string;
      summary: string;
      description?: string;
      primary?: boolean;
      accessRole: string;
      backgroundColor?: string;
    }>;
  };

  return data.items.map((cal) => ({
    id: cal.id,
    name: cal.summary,
    description: cal.description,
    primary: cal.primary || false,
    accessRole: cal.accessRole,
    isRoom: cal.id.includes('resource.calendar.google.com'),
  }));
}

export async function handleCalendarGetFreeBusy(
  args: z.infer<typeof CalendarGetFreeBusySchema>,
  auth: GoogleAuth
): Promise<unknown> {
  const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
  const response = await auth.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      items: args.calendarIds.map((id) => ({ id })),
    }),
  });

  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);

  const data = (await response.json()) as {
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  };

  // Transform to more usable format
  const availability: Record<
    string,
    { busy: Array<{ start: string; end: string }>; busyCount: number }
  > = {};
  for (const [calId, info] of Object.entries(data.calendars)) {
    availability[calId] = {
      busy: info.busy,
      busyCount: info.busy.length,
    };
  }

  return {
    timeRange: { start: args.timeMin, end: args.timeMax },
    calendars: availability,
  };
}

export async function handleCalendarCreateEvent(
  args: z.infer<typeof CalendarCreateEventSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // Handle all-day vs timed events
  const isAllDay = args.allDay || (!args.start.includes('T') && !args.start.includes(':'));
  const eventBody: Record<string, unknown> = {
    summary: args.summary,
    start: isAllDay ? { date: args.start.split('T')[0] } : { dateTime: args.start },
    end: isAllDay ? { date: args.end.split('T')[0] } : { dateTime: args.end },
  };

  if (args.description) eventBody.description = args.description;
  if (args.location) eventBody.location = args.location;
  if (args.attendees && args.attendees.length > 0) {
    eventBody.attendees = args.attendees.map((email) => ({ email }));
  }

  // Add recurrence rules
  const recurrenceRules = buildRecurrenceRules(args.recurrence);
  if (recurrenceRules && recurrenceRules.length > 0) {
    eventBody.recurrence = recurrenceRules;
  }

  // Add Google Meet link if requested
  if (args.conferenceData) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events`
  );
  url.searchParams.set('sendUpdates', args.sendNotifications ? 'all' : 'none');
  if (args.conferenceData) url.searchParams.set('conferenceDataVersion', '1');

  const response = await auth.fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Calendar create error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    id: string;
    htmlLink: string;
    hangoutLink?: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    recurrence?: string[];
  };

  return {
    success: true,
    eventId: data.id,
    title: data.summary,
    start: data.start.dateTime || data.start.date,
    end: data.end.dateTime || data.end.date,
    link: data.htmlLink,
    meetLink: data.hangoutLink,
    recurrence: data.recurrence,
  };
}

export async function handleCalendarUpdateEvent(
  args: z.infer<typeof CalendarUpdateEventSchema>,
  auth: GoogleAuth
): Promise<unknown> {
  // First get existing event to preserve fields not being updated
  const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.eventId)}`;
  const getResponse = await auth.fetch(getUrl);
  if (!getResponse.ok) throw new Error(`Calendar API error: ${getResponse.status}`);

  const existingEvent = (await getResponse.json()) as Record<string, unknown>;

  // Detect if this is an all-day event (existing or requested)
  const existingStart = existingEvent.start as { date?: string; dateTime?: string } | undefined;
  const wasAllDay = existingStart?.date !== undefined;
  const isAllDay =
    args.allDay ?? (args.start ? !args.start.includes('T') && !args.start.includes(':') : wasAllDay);

  // Update only provided fields
  if (args.summary !== undefined) existingEvent.summary = args.summary;
  if (args.description !== undefined) existingEvent.description = args.description;
  if (args.start !== undefined) {
    existingEvent.start = isAllDay
      ? { date: args.start.split('T')[0] }
      : { dateTime: args.start };
  }
  if (args.end !== undefined) {
    existingEvent.end = isAllDay ? { date: args.end.split('T')[0] } : { dateTime: args.end };
  }
  if (args.location !== undefined) existingEvent.location = args.location;
  if (args.attendees !== undefined) {
    existingEvent.attendees = args.attendees.map((email) => ({ email }));
  }

  // Handle recurrence updates
  if (args.recurrence !== undefined) {
    const recurrenceRules = buildRecurrenceRules(args.recurrence);
    if (recurrenceRules && recurrenceRules.length > 0) {
      existingEvent.recurrence = recurrenceRules;
    } else {
      // Empty array means remove recurrence
      delete existingEvent.recurrence;
    }
  }

  const url = new URL(getUrl);
  url.searchParams.set('sendUpdates', args.sendNotifications ? 'all' : 'none');

  const response = await auth.fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(existingEvent),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Calendar update error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    id: string;
    htmlLink: string;
    summary: string;
    recurrence?: string[];
  };

  return {
    success: true,
    eventId: data.id,
    title: data.summary,
    link: data.htmlLink,
    recurrence: data.recurrence,
  };
}

// ==================== HANDLER BUNDLE ====================

export const calendarDefs = defineHandlers<GoogleAuth>()({
  calendar_list_events: {
    description: 'List calendar events within a time range',
    schema: CalendarListEventsSchema,
    handler: handleCalendarListEvents,
  },
  calendar_get_event: {
    description: 'Get details of a specific calendar event',
    schema: CalendarGetEventSchema,
    handler: handleCalendarGetEvent,
  },
  calendar_list_calendars: {
    description:
      'List all calendars the user has access to, including meeting rooms and shared calendars',
    schema: CalendarListCalendarsSchema,
    handler: handleCalendarListCalendars,
  },
  calendar_get_freebusy: {
    description:
      'Check availability (free/busy) for multiple calendars within a time range. Useful for finding meeting slots.',
    schema: CalendarGetFreeBusySchema,
    handler: handleCalendarGetFreeBusy,
  },
  calendar_create_event: {
    description: 'Create a new calendar event with attendees and optional meeting room',
    schema: CalendarCreateEventSchema,
    handler: handleCalendarCreateEvent,
  },
  calendar_update_event: {
    description: 'Update an existing calendar event',
    schema: CalendarUpdateEventSchema,
    handler: handleCalendarUpdateEvent,
  },
});
