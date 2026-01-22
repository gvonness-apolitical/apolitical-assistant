/**
 * Calendar Collector Tests
 *
 * Tests the CalendarCollector class for Google Calendar event collection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CalendarCollector, type CalendarEvent } from '../calendar.js';

// Mock dependencies
vi.mock('@apolitical-assistant/shared', async () => {
  const actual = await vi.importActual('@apolitical-assistant/shared');
  return {
    ...actual,
    getCredential: vi.fn(),
    generateFingerprint: vi.fn((title: string) => `fp-${title.slice(0, 10)}`),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
      setLevel: vi.fn(),
    })),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../config.js', () => ({
  getCachePath: vi.fn(() => '/tmp/test-cache'),
  loadTodoConfig: vi.fn(() => ({
    archiveAfterDays: 14,
    staleDays: 14,
    deduplication: { enabled: true, fuzzyThreshold: 0.85 },
    notifications: { dayBefore: true, dayOf: true, overdue: true },
  })),
  getCollectionStartDate: vi.fn(() => null),
}));

// Import after mocking
import { getCredential } from '@apolitical-assistant/shared';

const mockGetCredential = vi.mocked(getCredential);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CalendarCollector', () => {
  let collector: CalendarCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new CalendarCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('returns true when google-refresh-token exists', () => {
      mockGetCredential.mockReturnValue('test-refresh-token');

      expect(collector.isEnabled()).toBe(true);
    });

    it('returns false when google-refresh-token is missing', () => {
      mockGetCredential.mockReturnValue(null);

      expect(collector.isEnabled()).toBe(false);
    });

    it('returns false when google-refresh-token is undefined', () => {
      mockGetCredential.mockReturnValue(undefined);

      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('classifyMeeting', () => {
    it('classifies focus time events', () => {
      const focusEvents: CalendarEvent[] = [
        createEvent({ summary: 'Focus Time' }),
        createEvent({ summary: 'Blocked - Deep Work' }),
        createEvent({ summary: 'Do Not Book' }),
        createEvent({ summary: 'Meeting', attendees: [] }), // No attendees
      ];

      for (const event of focusEvents) {
        expect(collector.classifyMeeting(event)).toBe('focus');
      }
    });

    it('classifies 1:1 meetings', () => {
      const oneOnOneEvents: CalendarEvent[] = [
        createEvent({ summary: '1:1 with John' }),
        createEvent({ summary: 'Weekly 1-1' }),
        createEvent({ summary: 'One on One catch-up' }),
        createEvent({ summary: '1on1 Sync' }),
        createEvent({
          summary: 'Chat with Alice',
          attendees: [
            { email: 'me@company.com', self: true },
            { email: 'alice@company.com' },
          ],
        }),
      ];

      for (const event of oneOnOneEvents) {
        expect(collector.classifyMeeting(event)).toBe('one-on-one');
      }
    });

    it('classifies team meetings', () => {
      // Team meetings need 2+ non-self attendees to avoid 1:1 classification
      const multipleAttendees = [
        { email: 'me@company.com', self: true },
        { email: 'alice@company.com' },
        { email: 'bob@company.com' },
      ];
      const teamMeetings: CalendarEvent[] = [
        createEvent({ summary: 'Daily Standup', attendees: multipleAttendees }),
        createEvent({ summary: 'Sprint Retro', attendees: multipleAttendees }),
        createEvent({ summary: 'Retrospective', attendees: multipleAttendees }),
        createEvent({ summary: 'Sprint Planning', attendees: multipleAttendees }),
        createEvent({ summary: 'Team Sync', attendees: multipleAttendees }),
        createEvent({ summary: 'Team Lunch', attendees: multipleAttendees }),
      ];

      for (const event of teamMeetings) {
        expect(collector.classifyMeeting(event)).toBe('team-meeting');
      }
    });

    it('classifies leadership meetings', () => {
      // Leadership meetings need 2+ non-self attendees to avoid 1:1 classification
      // Note: avoid keywords that match team-meeting patterns (e.g., 'sync')
      const multipleAttendees = [
        { email: 'me@company.com', self: true },
        { email: 'ceo@company.com' },
        { email: 'cto@company.com' },
      ];
      const leadershipMeetings: CalendarEvent[] = [
        createEvent({ summary: 'Leadership Meeting', attendees: multipleAttendees }),
        createEvent({ summary: 'Exec Update', attendees: multipleAttendees }),
        createEvent({ summary: 'Director Check-in', attendees: multipleAttendees }),
        createEvent({ summary: 'All-Hands', attendees: multipleAttendees }),
        createEvent({ summary: 'Town Hall', attendees: multipleAttendees }),
        createEvent({ summary: 'Staff Meeting', attendees: multipleAttendees }),
      ];

      for (const event of leadershipMeetings) {
        expect(collector.classifyMeeting(event)).toBe('leadership');
      }
    });

    it('classifies external meetings by keywords', () => {
      // External meetings need 2+ non-self attendees to avoid 1:1 classification
      const multipleAttendees = [
        { email: 'me@company.com', self: true },
        { email: 'person1@company.com' },
        { email: 'person2@company.com' },
      ];
      const externalMeetings: CalendarEvent[] = [
        createEvent({ summary: 'External Partner Call', attendees: multipleAttendees }),
        createEvent({ summary: 'Vendor Demo', attendees: multipleAttendees }),
        createEvent({ summary: 'Partner Discussion', attendees: multipleAttendees }),
        createEvent({ summary: 'Client Meeting', attendees: multipleAttendees }),
        createEvent({ summary: 'Interview - Senior Dev', attendees: multipleAttendees }),
        createEvent({ summary: 'Candidate Screening', attendees: multipleAttendees }),
      ];

      for (const event of externalMeetings) {
        expect(collector.classifyMeeting(event)).toBe('external');
      }
    });

    it('classifies external meetings by attendee domain', () => {
      const event = createEvent({
        summary: 'Project Discussion',
        attendees: [
          { email: 'me@company.com', self: true },
          { email: 'partner@external.com' },
          { email: 'colleague@company.com' },
        ],
      });

      expect(collector.classifyMeeting(event)).toBe('external');
    });

    it('classifies meetings with same-domain attendees as other', () => {
      const event = createEvent({
        summary: 'Project Discussion',
        attendees: [
          { email: 'me@company.com', self: true },
          { email: 'alice@company.com' },
          { email: 'bob@company.com' },
        ],
      });

      expect(collector.classifyMeeting(event)).toBe('other');
    });

    it('handles events with no summary', () => {
      // With no summary and no attendees, should be focus
      const event = createEvent({ summary: '', attendees: [] });
      event.summary = undefined as unknown as string;

      expect(collector.classifyMeeting(event)).toBe('focus');
    });

    it('handles events with no attendees array', () => {
      const event = createEvent({ summary: 'General Meeting' });
      delete event.attendees;

      expect(collector.classifyMeeting(event)).toBe('focus');
    });
  });

  describe('collect', () => {
    beforeEach(() => {
      // Set up credentials
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });
    });

    it('returns empty result when disabled', async () => {
      mockGetCredential.mockReturnValue(null);

      const result = await collector.collect();

      expect(result.source).toBe('calendar');
      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('returns empty result when access token cannot be obtained', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        if (key === 'google-refresh-token') return 'refresh-token';
        return null;
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('creates prep TODOs for 1:1 meetings', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: '1:1 with Alice',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'alice@company.com', displayName: 'Alice' },
                ],
                start: { dateTime: '2024-01-15T10:00:00Z' },
                htmlLink: 'https://calendar.google.com/event/1',
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Prep: 1:1 with Alice');
      expect(result.todos[0].basePriority).toBe(2);
      expect(result.todos[0].urgency).toBe(2);
      expect(result.todos[0].tags).toContain('one-on-one');
      expect(result.todos[0].tags).toContain('meeting-prep');
      expect(result.todos[0].sourceUrl).toBe('https://calendar.google.com/event/1');
    });

    it('creates prep TODOs for meetings where user is organizer', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Team Discussion',
                organizer: { email: 'me@company.com', self: true },
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'bob@company.com' },
                  { email: 'charlie@company.com' },
                ],
                start: { dateTime: '2024-01-15T14:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Prep: Team Discussion');
    });

    it('creates prep TODOs for leadership meetings', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Leadership Meeting',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'ceo@company.com' },
                  { email: 'cto@company.com' },
                ],
                start: { dateTime: '2024-01-15T09:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].tags).toContain('leadership');
    });

    it('creates prep TODOs for external meetings', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Vendor Demo',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'sales@vendor.com' },
                  { email: 'support@vendor.com' },
                ],
                start: { dateTime: '2024-01-15T11:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].tags).toContain('external');
    });

    it('does not create prep TODO for focus time', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Focus Time',
                attendees: [],
                start: { dateTime: '2024-01-15T08:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('does not create prep TODO for regular team meetings where user is not organizer', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'General Project Sync',
                organizer: { email: 'manager@company.com', self: false },
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'manager@company.com' },
                  { email: 'teammate@company.com' },
                ],
                start: { dateTime: '2024-01-15T15:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('handles API errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      const result = await collector.collect();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Calendar API error');
    });

    it('handles network errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await collector.collect();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Network error');
    });

    it('handles all-day events (date without time)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: '1:1 with Bob',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'bob@company.com' },
                ],
                start: { date: '2024-01-15' },
                end: { date: '2024-01-16' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].dueDate).toBe('2024-01-15');
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });
    });

    it('fetches events with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const timeMin = '2024-01-15T00:00:00Z';
      const timeMax = '2024-01-16T00:00:00Z';

      await collector.getEvents('test-token', timeMin, timeMax);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/calendars\/primary\/events\?/),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get('timeMin')).toBe(timeMin);
      expect(url.searchParams.get('timeMax')).toBe(timeMax);
      expect(url.searchParams.get('singleEvents')).toBe('true');
      expect(url.searchParams.get('orderBy')).toBe('startTime');
      expect(url.searchParams.get('maxResults')).toBe('100');
    });

    it('returns empty array when API returns no items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const events = await collector.getEvents('test-token', '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z');

      expect(events).toEqual([]);
    });

    it('returns events from API response', async () => {
      const mockEvents = [
        createEvent({ id: 'event-1', summary: 'Meeting 1' }),
        createEvent({ id: 'event-2', summary: 'Meeting 2' }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockEvents }),
      });

      const events = await collector.getEvents('test-token', '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z');

      expect(events).toEqual(mockEvents);
    });

    it('throws error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        collector.getEvents('test-token', '2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z')
      ).rejects.toThrow('Calendar API error: 401 Unauthorized');
    });
  });

  describe('getEventsForDate', () => {
    beforeEach(() => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });
    });

    it('returns empty array when no access token', async () => {
      mockGetCredential.mockReturnValue(null);

      const events = await collector.getEventsForDate('2024-01-15');

      expect(events).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches events for the specified date', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [createEvent({ summary: 'Test' })] }),
        });

      const events = await collector.getEventsForDate('2024-01-15');

      expect(events).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUpcomingEvents', () => {
    beforeEach(() => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });
    });

    it('returns empty array when no access token', async () => {
      mockGetCredential.mockReturnValue(null);

      const events = await collector.getUpcomingEvents();

      expect(events).toEqual([]);
    });

    it('fetches events for next 7 days by default', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        });

      await collector.getUpcomingEvents();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('fetches events for specified number of days', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        });

      await collector.getUpcomingEvents(14);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generatePrepDescription', () => {
    it('includes time for datetime events', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: '1:1 with Alice',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'alice@company.com', displayName: 'Alice' },
                ],
                start: { dateTime: '2024-01-15T10:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos[0].description).toContain('Time:');
      expect(result.todos[0].description).toContain('Attendees: Alice');
    });

    it('includes meeting link when available', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: '1:1 with Alice',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'alice@company.com' },
                ],
                start: { dateTime: '2024-01-15T10:00:00Z' },
                conferenceData: {
                  entryPoints: [
                    { entryPointType: 'video', uri: 'https://meet.google.com/abc-def-ghi' },
                  ],
                },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos[0].description).toContain('Meeting link: https://meet.google.com/abc-def-ghi');
    });

    it('includes 1:1 prep notes', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: '1:1 with Alice',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'alice@company.com' },
                ],
                start: { dateTime: '2024-01-15T10:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos[0].description).toContain('Review recent activity');
      expect(result.todos[0].description).toContain('Check previous 1:1 notes');
      expect(result.todos[0].description).toContain('Prepare talking points');
    });

    it('includes leadership meeting prep notes', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Leadership Meeting',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'ceo@company.com' },
                  { email: 'cto@company.com' },
                ],
                start: { dateTime: '2024-01-15T09:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos[0].description).toContain('Review team updates');
      expect(result.todos[0].description).toContain('Prepare status report');
    });

    it('includes external meeting prep notes', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Vendor Demo',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'sales@vendor.com' },
                  { email: 'support@vendor.com' },
                ],
                start: { dateTime: '2024-01-15T11:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      expect(result.todos[0].description).toContain('Review attendee background');
      expect(result.todos[0].description).toContain('Prepare agenda');
    });

    it('limits attendees shown to 5', async () => {
      mockGetCredential.mockImplementation((key: string) => {
        const creds: Record<string, string> = {
          'google-refresh-token': 'test-refresh-token',
          'google-oauth-client-id': 'test-client-id',
          'google-oauth-client-secret': 'test-client-secret',
        };
        return creds[key] ?? null;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              createEvent({
                id: 'event-1',
                summary: 'Leadership Meeting',
                attendees: [
                  { email: 'me@company.com', self: true },
                  { email: 'a@company.com', displayName: 'Alice' },
                  { email: 'b@company.com', displayName: 'Bob' },
                  { email: 'c@company.com', displayName: 'Charlie' },
                  { email: 'd@company.com', displayName: 'Diana' },
                  { email: 'e@company.com', displayName: 'Eve' },
                  { email: 'f@company.com', displayName: 'Frank' },
                ],
                start: { dateTime: '2024-01-15T09:00:00Z' },
              }),
            ],
          }),
        });

      const result = await collector.collect();

      // Should not contain the 6th attendee (Frank)
      expect(result.todos[0].description).toContain('Alice');
      expect(result.todos[0].description).toContain('Eve');
      expect(result.todos[0].description).not.toContain('Frank');
    });
  });
});

/**
 * Helper to create a test calendar event
 */
function createEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    summary: 'Test Meeting',
    start: { dateTime: '2024-01-15T10:00:00Z' },
    end: { dateTime: '2024-01-15T11:00:00Z' },
    attendees: [
      { email: 'me@company.com', self: true },
      { email: 'other@company.com' },
    ],
    ...overrides,
  };
}
