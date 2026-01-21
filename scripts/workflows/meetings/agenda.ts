/**
 * Agenda Generation
 *
 * Generate agendas for meetings the user is leading.
 */

import type {
  CalendarEvent,
  MeetingPrep,
  AgendaItem,
  AttendeeContext,
  MeetingType,
} from './types.js';
import { loadMeetingConfig, getMeetingPrepPath } from './config.js';
import { gatherAttendeeContext } from './context.js';
import { detectMeetingType, isLeadingMeeting } from './detect.js';
import type { DirectReport } from './types.js';

/**
 * Generate agenda for a meeting
 */
export async function generateAgenda(
  event: CalendarEvent,
  directReports: DirectReport[],
  myEmail: string
): Promise<MeetingPrep> {
  const config = loadMeetingConfig();
  const meetingType = await detectMeetingType(event, directReports, myEmail);
  const leading = isLeadingMeeting(event, myEmail);

  // Gather context for all attendees (excluding self)
  const attendeeEmails = event.attendees
    .filter(a => a.email !== myEmail)
    .map(a => a.email);

  const attendeeContexts: AttendeeContext[] = [];
  for (const email of attendeeEmails) {
    const context = await gatherAttendeeContext(email, directReports);
    attendeeContexts.push(context);
  }

  // Generate agenda items based on meeting type
  const agendaItems = await generateAgendaItems(
    event,
    meetingType,
    attendeeContexts,
    config
  );

  const date = new Date(event.startTime).toISOString().split('T')[0];
  const prepPath = getMeetingPrepPath(date, event.id);

  return {
    id: `prep-${event.id}`,
    calendarEventId: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    meetingType,
    isLeading: leading,
    attendees: attendeeContexts,
    agendaItems,
    generatedAt: new Date().toISOString(),
    filePath: prepPath,
  };
}

/**
 * Generate agenda items based on meeting type and context
 */
async function generateAgendaItems(
  event: CalendarEvent,
  meetingType: MeetingType,
  attendees: AttendeeContext[],
  _config: ReturnType<typeof loadMeetingConfig>
): Promise<AgendaItem[]> {
  const items: AgendaItem[] = [];

  // Add items based on meeting type
  switch (meetingType) {
    case 'team-meeting':
      items.push(...generateTeamMeetingItems(event, attendees));
      break;
    case 'leadership':
      items.push(...generateLeadershipItems(event, attendees));
      break;
    case 'external':
      items.push(...generateExternalItems(event, attendees));
      break;
    case 'one-on-one':
      // 1:1s are handled by one-on-one.ts
      items.push(...generateOneOnOneItems(event, attendees));
      break;
    default:
      items.push(...generateDefaultItems(event, attendees));
  }

  return items;
}

/**
 * Generate items for team meetings (standups, retros, planning)
 */
function generateTeamMeetingItems(
  event: CalendarEvent,
  attendees: AttendeeContext[]
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const title = event.title.toLowerCase();

  // Standup items
  if (title.includes('standup') || title.includes('stand-up') || title.includes('daily')) {
    items.push({
      topic: 'Yesterday\'s Progress',
      context: 'What did each team member accomplish?',
      suggestedDuration: 10,
      sources: [],
    });
    items.push({
      topic: 'Today\'s Plan',
      context: 'What are the priorities for today?',
      suggestedDuration: 10,
      sources: [],
    });
    items.push({
      topic: 'Blockers',
      context: 'Any impediments that need help?',
      suggestedDuration: 5,
      sources: [],
    });
  }

  // Retro items
  if (title.includes('retro') || title.includes('retrospective')) {
    items.push({
      topic: 'What Went Well',
      context: 'Celebrate successes from the sprint',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'What Could Be Improved',
      context: 'Areas for improvement',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Action Items',
      context: 'Concrete actions to implement improvements',
      suggestedDuration: 10,
      sources: [],
    });
  }

  // Planning items
  if (title.includes('planning') || title.includes('sprint')) {
    items.push({
      topic: 'Sprint Goal',
      context: 'Define the primary objective for this sprint',
      suggestedDuration: 10,
      sources: [],
    });
    items.push({
      topic: 'Backlog Review',
      context: 'Review and prioritize items',
      suggestedDuration: 20,
      sources: [],
    });
    items.push({
      topic: 'Capacity Planning',
      context: 'Team availability and commitments',
      suggestedDuration: 10,
      sources: [],
    });
  }

  // Generic team sync
  if (items.length === 0) {
    items.push({
      topic: 'Team Updates',
      context: 'Round-robin updates from each team member',
      suggestedDuration: 15,
      sources: [],
    });

    // Add open action items from attendees
    const openActionItems = attendees.flatMap(a => a.openActionItems || []);
    if (openActionItems.length > 0) {
      items.push({
        topic: 'Action Item Review',
        context: `${openActionItems.length} open action items to review`,
        suggestedDuration: 10,
        sources: [],
      });
    }

    items.push({
      topic: 'Open Discussion',
      context: 'Any other topics or concerns',
      suggestedDuration: 10,
      sources: [],
    });
  }

  return items;
}

/**
 * Generate items for leadership meetings
 */
function generateLeadershipItems(
  event: CalendarEvent,
  _attendees: AttendeeContext[]
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const title = event.title.toLowerCase();

  // All-hands
  if (title.includes('all-hands') || title.includes('town hall')) {
    items.push({
      topic: 'Company Updates',
      context: 'Key announcements and news',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Team Highlights',
      context: 'Notable achievements from teams',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Q&A',
      context: 'Open questions from attendees',
      suggestedDuration: 15,
      sources: [],
    });
  }

  // Leadership sync
  if (title.includes('leadership') || title.includes('director')) {
    items.push({
      topic: 'Strategic Updates',
      context: 'Progress on key initiatives',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Cross-Team Dependencies',
      context: 'Coordination needs between teams',
      suggestedDuration: 10,
      sources: [],
    });
    items.push({
      topic: 'Risks and Concerns',
      context: 'Items requiring leadership attention',
      suggestedDuration: 10,
      sources: [],
    });
    items.push({
      topic: 'Decisions Needed',
      context: 'Items requiring consensus or approval',
      suggestedDuration: 10,
      sources: [],
    });
  }

  // Default leadership items
  if (items.length === 0) {
    items.push({
      topic: 'Updates',
      context: 'Key updates since last meeting',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Discussion Items',
      context: 'Topics requiring group input',
      suggestedDuration: 20,
      sources: [],
    });
    items.push({
      topic: 'Next Steps',
      context: 'Actions and owners',
      suggestedDuration: 10,
      sources: [],
    });
  }

  return items;
}

/**
 * Generate items for external meetings
 */
function generateExternalItems(
  event: CalendarEvent,
  _attendees: AttendeeContext[]
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const title = event.title.toLowerCase();

  // Interview
  if (title.includes('interview') || title.includes('candidate')) {
    items.push({
      topic: 'Introductions',
      context: 'Brief intro to company and role',
      suggestedDuration: 5,
      sources: [],
    });
    items.push({
      topic: 'Candidate Background',
      context: 'Review experience and motivations',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Technical Discussion',
      context: 'Assess relevant skills',
      suggestedDuration: 25,
      sources: [],
    });
    items.push({
      topic: 'Questions from Candidate',
      context: 'Answer candidate questions',
      suggestedDuration: 10,
      sources: [],
    });
  }

  // Vendor/partner meeting
  if (title.includes('vendor') || title.includes('partner') || title.includes('demo')) {
    items.push({
      topic: 'Context',
      context: 'Background on our needs',
      suggestedDuration: 5,
      sources: [],
    });
    items.push({
      topic: 'Presentation/Demo',
      context: 'Vendor presents solution',
      suggestedDuration: 20,
      sources: [],
    });
    items.push({
      topic: 'Questions',
      context: 'Technical and commercial questions',
      suggestedDuration: 15,
      sources: [],
    });
    items.push({
      topic: 'Next Steps',
      context: 'Follow-up actions',
      suggestedDuration: 5,
      sources: [],
    });
  }

  // Default external meeting
  if (items.length === 0) {
    items.push({
      topic: 'Introductions',
      context: 'Brief introductions if needed',
      suggestedDuration: 5,
      sources: [],
    });
    items.push({
      topic: 'Discussion',
      context: 'Main meeting topics',
      suggestedDuration: 30,
      sources: [],
    });
    items.push({
      topic: 'Action Items',
      context: 'Agree on next steps',
      suggestedDuration: 5,
      sources: [],
    });
  }

  return items;
}

/**
 * Generate basic items for 1:1s (detailed script is in one-on-one.ts)
 */
function generateOneOnOneItems(
  _event: CalendarEvent,
  attendees: AttendeeContext[]
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const attendee = attendees[0]; // 1:1 has only one other attendee

  items.push({
    topic: 'Check-in',
    context: 'How are things going?',
    suggestedDuration: 5,
    sources: [],
  });

  // Add open action items
  if (attendee?.openActionItems && attendee.openActionItems.length > 0) {
    items.push({
      topic: 'Action Item Review',
      context: `${attendee.openActionItems.length} open items from previous 1:1s`,
      suggestedDuration: 10,
      sources: [],
    });
  }

  items.push({
    topic: 'Updates',
    context: 'Recent work and progress',
    suggestedDuration: 15,
    sources: [],
  });

  items.push({
    topic: 'Discussion',
    context: 'Topics for deeper conversation',
    suggestedDuration: 15,
    sources: [],
  });

  items.push({
    topic: 'Action Items',
    context: 'Capture follow-ups',
    suggestedDuration: 5,
    sources: [],
  });

  return items;
}

/**
 * Generate default items for unclassified meetings
 */
function generateDefaultItems(
  _event: CalendarEvent,
  attendees: AttendeeContext[]
): AgendaItem[] {
  const items: AgendaItem[] = [];

  items.push({
    topic: 'Meeting Objective',
    context: 'Confirm the purpose of this meeting',
    suggestedDuration: 5,
    sources: [],
  });

  items.push({
    topic: 'Discussion',
    context: 'Main topics',
    suggestedDuration: 30,
    sources: [],
  });

  // Check for open action items across attendees
  const totalOpenItems = attendees.reduce(
    (sum, a) => sum + (a.openActionItems?.length || 0),
    0
  );
  if (totalOpenItems > 0) {
    items.push({
      topic: 'Previous Action Items',
      context: `${totalOpenItems} open items to review`,
      suggestedDuration: 10,
      sources: [],
    });
  }

  items.push({
    topic: 'Next Steps',
    context: 'Capture action items and owners',
    suggestedDuration: 5,
    sources: [],
  });

  return items;
}

/**
 * Calculate total agenda duration
 */
export function calculateAgendaDuration(items: AgendaItem[]): number {
  return items.reduce((total, item) => total + (item.suggestedDuration || 0), 0);
}

/**
 * Check if agenda fits meeting duration
 */
export function agendaFitsMeeting(
  items: AgendaItem[],
  event: CalendarEvent
): { fits: boolean; agendaMinutes: number; meetingMinutes: number } {
  const agendaMinutes = calculateAgendaDuration(items);
  const meetingMinutes =
    (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
    (1000 * 60);

  return {
    fits: agendaMinutes <= meetingMinutes,
    agendaMinutes,
    meetingMinutes,
  };
}
