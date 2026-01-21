/**
 * Meeting Type Detection
 *
 * Auto-detect meeting types based on attendees, title, and patterns.
 */

import type { CalendarEvent, MeetingType, DirectReport } from './types.js';
import { loadMeetingConfig } from './config.js';

/**
 * Keywords for different meeting types
 */
const TEAM_KEYWORDS = [
  'standup', 'stand-up', 'stand up',
  'retro', 'retrospective',
  'sprint', 'planning',
  'sync', 'team sync',
  'team meeting', 'weekly team',
  'daily', 'weekly',
];

const LEADERSHIP_KEYWORDS = [
  'leadership', 'exec', 'executive',
  'director', 'directors',
  'all-hands', 'all hands', 'townhall', 'town hall',
  'steering', 'strategy',
  'board', 'management',
];

const EXTERNAL_KEYWORDS = [
  'external', 'vendor', 'partner',
  'client', 'customer',
  'interview', 'candidate',
  'sales', 'demo',
];

/**
 * Detect meeting type from calendar event
 */
export async function detectMeetingType(
  event: CalendarEvent,
  directReports: DirectReport[],
  myEmail: string
): Promise<MeetingType> {
  const config = loadMeetingConfig();
  const title = event.title.toLowerCase();

  // 1. Check for explicit type overrides in config
  for (const [pattern, type] of Object.entries(config.meetingTypeOverrides)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(event.title)) {
      return type;
    }
  }

  // 2. Check attendee count for 1:1 detection
  const attendeeCount = event.attendees.length;
  if (attendeeCount === 2) {
    const otherAttendee = event.attendees.find(a => a.email !== myEmail);
    if (otherAttendee) {
      const isDirectReport = directReports.some(dr =>
        dr.email.toLowerCase() === otherAttendee.email.toLowerCase()
      );
      if (isDirectReport) {
        return 'one-on-one';
      }
    }
  }

  // 3. Check title keywords
  for (const keyword of TEAM_KEYWORDS) {
    if (title.includes(keyword)) {
      return 'team-meeting';
    }
  }

  for (const keyword of LEADERSHIP_KEYWORDS) {
    if (title.includes(keyword)) {
      return 'leadership';
    }
  }

  for (const keyword of EXTERNAL_KEYWORDS) {
    if (title.includes(keyword)) {
      return 'external';
    }
  }

  // 4. Check recurring patterns for 1:1 detection
  if (event.isRecurring && attendeeCount === 2) {
    // Weekly recurring with 2 people = likely 1:1
    if (event.recurrencePattern?.toLowerCase().includes('weekly')) {
      return 'one-on-one';
    }
  }

  // 5. Check if title contains a person's name (common for 1:1s)
  if (attendeeCount === 2) {
    const otherAttendee = event.attendees.find(a => a.email !== myEmail);
    if (otherAttendee?.name) {
      const nameParts = otherAttendee.name.toLowerCase().split(' ');
      const hasName = nameParts.some(part =>
        title.includes(part) && part.length > 2
      );
      if (hasName) {
        return 'one-on-one';
      }
    }
  }

  // 6. Default to 'other'
  return 'other';
}

/**
 * Check if I'm leading this meeting (organizer)
 */
export function isLeadingMeeting(event: CalendarEvent, myEmail: string): boolean {
  const organizer = event.attendees.find(a => a.isOrganizer);
  return organizer?.email.toLowerCase() === myEmail.toLowerCase();
}

/**
 * Get meeting type display name
 */
export function getMeetingTypeDisplayName(type: MeetingType): string {
  const names: Record<MeetingType, string> = {
    'one-on-one': '1:1',
    'team-meeting': 'Team Meeting',
    'leadership': 'Leadership',
    'external': 'External',
    'other': 'Meeting',
  };
  return names[type];
}
