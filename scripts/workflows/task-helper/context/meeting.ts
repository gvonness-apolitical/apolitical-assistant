/**
 * Task Helper - Meeting Context Gatherer
 *
 * Gathers context from calendar events and meeting prep.
 */

import type { Todo } from '@apolitical-assistant/shared';
import type {
  GatherOptions,
  GatheringStatus,
  SourceDetails,
  ThreadItem,
  RelatedItem,
  PersonContext,
  AvailabilitySlot,
} from '../types.js';

/**
 * Meeting context result
 */
export interface MeetingContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  calendar?: {
    relevantEvents?: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      attendees?: string[];
    }>;
    availability?: AvailabilitySlot[];
  };
  status: GatheringStatus;
}

/**
 * Parse meeting details from TODO
 */
function parseMeetingDetails(todo: Todo): {
  eventId?: string;
  attendees?: string[];
  startTime?: string;
  endTime?: string;
} {
  const details: ReturnType<typeof parseMeetingDetails> = {};

  // Extract from sourceId if available
  if (todo.sourceId) {
    details.eventId = todo.sourceId;
  }

  // Try to extract time from title or description
  const timeMatch = todo.title.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i);
  if (timeMatch) {
    // Basic time extraction - would need more context for full parsing
  }

  return details;
}

/**
 * Gather context from meeting/calendar
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherMeetingContext(
  todo: Todo,
  options: GatherOptions
): Promise<MeetingContextResult> {
  const startTime = Date.now();

  // Parse meeting details
  const meetingDetails = parseMeetingDetails(todo);

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    metadata: meetingDetails.eventId
      ? {
          eventId: meetingDetails.eventId,
        }
      : undefined,
  };

  // Build thread from description (meeting notes, agenda)
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: 'meeting-prep',
      content: todo.description,
      date: todo.createdAt,
      type: 'note',
    });
  }

  // Related items would be populated via MCP calls
  const relatedItems: RelatedItem[] = [];

  // People context from attendees
  const people: PersonContext[] = [];
  if (meetingDetails.attendees) {
    for (const attendee of meetingDetails.attendees) {
      people.push({
        name: attendee,
        email: attendee.includes('@') ? attendee : undefined,
      });
    }
  }

  // Calendar context
  const calendar: MeetingContextResult['calendar'] = {};
  if (options.includeCalendar) {
    // Would be populated via MCP calls to get availability
    calendar.relevantEvents = [];
    calendar.availability = [];
  }

  return {
    sourceDetails,
    thread: options.includeThread ? thread : undefined,
    relatedItems: options.includeRelated ? relatedItems : undefined,
    people: options.includePeople ? people : undefined,
    calendar: options.includeCalendar ? calendar : undefined,
    status: {
      source: todo.source ?? 'meeting-prep',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get scheduling context for meeting
 */
export function getSchedulingContext(
  result: MeetingContextResult
): {
  hasEvent: boolean;
  attendeeCount: number;
  hasAvailability: boolean;
  availableSlots: number;
} {
  return {
    hasEvent: (result.sourceDetails.metadata as { eventId?: string })?.eventId !== undefined,
    attendeeCount: result.people?.length ?? 0,
    hasAvailability: (result.calendar?.availability?.length ?? 0) > 0,
    availableSlots: result.calendar?.availability?.length ?? 0,
  };
}

/**
 * Format meeting context for prompt
 */
export function formatMeetingContextForPrompt(result: MeetingContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people, calendar } = result;

  // Header
  lines.push('## Meeting Context');
  lines.push('');

  // Basic info
  lines.push(`**Meeting:** ${sourceDetails.title}`);

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  const metadata = sourceDetails.metadata as { eventId?: string } | undefined;
  if (metadata?.eventId) {
    lines.push(`**Event ID:** ${metadata.eventId}`);
  }

  // Attendees
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### Attendees');
    for (const person of people) {
      let line = `- **${person.name}**`;
      if (person.role) {
        line += ` (${person.role})`;
      }
      if (person.department) {
        line += ` - ${person.department}`;
      }
      if (person.isOutOfOffice) {
        line += ' \u{1F4A4} OOO';
      }
      lines.push(line);
    }
  }

  // Meeting notes/agenda
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Agenda / Notes');
    lines.push(sourceDetails.description);
  }

  // Previous notes
  if (thread && thread.length > 1) {
    lines.push('');
    lines.push('### Previous Meeting Notes');
    for (const item of thread.slice(1)) {
      lines.push(`**${item.date}:**`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related events
  if (calendar?.relevantEvents && calendar.relevantEvents.length > 0) {
    lines.push('');
    lines.push('### Related Events');
    for (const event of calendar.relevantEvents) {
      lines.push(`- ${event.title} (${event.start} - ${event.end})`);
    }
  }

  // Availability
  if (calendar?.availability && calendar.availability.length > 0) {
    lines.push('');
    lines.push('### Available Time Slots');
    for (const slot of calendar.availability) {
      lines.push(`- ${slot.start} - ${slot.end} (${slot.duration} min)`);
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Items');
    for (const item of relatedItems) {
      lines.push(`- [${item.type}] ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  return lines.join('\n');
}
