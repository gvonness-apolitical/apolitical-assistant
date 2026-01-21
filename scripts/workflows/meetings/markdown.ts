/**
 * Markdown Output Formatting
 *
 * Format meeting preps and agendas as markdown documents.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MeetingPrep, AgendaItem, AttendeeContext } from './types.js';
import { format121Script } from './one-on-one.js';
import { getMeetingTypeDisplayName } from './detect.js';
import { calculateAgendaDuration, agendaFitsMeeting } from './agenda.js';

/**
 * Format meeting prep as markdown
 */
export function formatMeetingPrepMarkdown(prep: MeetingPrep): string {
  // Use specialized formatting for 1:1s
  if (prep.meetingType === 'one-on-one' && prep.oneOnOneScript) {
    return format121Script(prep);
  }

  // Standard meeting agenda format
  return formatStandardMeetingMarkdown(prep);
}

/**
 * Format standard meeting (non-1:1) as markdown
 */
function formatStandardMeetingMarkdown(prep: MeetingPrep): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${prep.title}`);
  lines.push('');
  lines.push(`**Type:** ${getMeetingTypeDisplayName(prep.meetingType)}`);
  lines.push(`**Date:** ${formatDate(prep.startTime)}`);
  lines.push(`**Time:** ${formatTime(prep.startTime)} - ${formatTime(prep.endTime)}`);
  lines.push(`**Role:** ${prep.isLeading ? 'Leading' : 'Attending'}`);
  lines.push('');

  // Attendees
  if (prep.attendees.length > 0) {
    lines.push('## Attendees');
    lines.push('');
    for (const attendee of prep.attendees) {
      lines.push(formatAttendeeShort(attendee));
    }
    lines.push('');
  }

  // Agenda
  if (prep.agendaItems.length > 0) {
    lines.push('## Agenda');
    lines.push('');

    // Duration check
    const duration = calculateAgendaDuration(prep.agendaItems);
    const fit = agendaFitsMeeting(prep.agendaItems, {
      id: prep.calendarEventId,
      title: prep.title,
      startTime: prep.startTime,
      endTime: prep.endTime,
      attendees: [],
      isRecurring: false,
    });

    if (!fit.fits) {
      lines.push(`> **Warning:** Agenda (${fit.agendaMinutes}min) exceeds meeting time (${fit.meetingMinutes}min)`);
      lines.push('');
    }

    for (let i = 0; i < prep.agendaItems.length; i++) {
      const item = prep.agendaItems[i];
      lines.push(formatAgendaItem(item, i + 1));
    }

    lines.push('');
    lines.push(`**Total Duration:** ~${duration} minutes`);
    lines.push('');
  }

  // Attendee context (detailed)
  if (prep.attendees.length > 0 && hasAttendeeContext(prep.attendees)) {
    lines.push('---');
    lines.push('');
    lines.push('## Attendee Context');
    lines.push('');

    for (const attendee of prep.attendees) {
      const context = formatAttendeeContext(attendee);
      if (context) {
        lines.push(context);
        lines.push('');
      }
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated: ${formatDateTime(prep.generatedAt)}*`);

  return lines.join('\n');
}

/**
 * Format a single agenda item
 */
function formatAgendaItem(item: AgendaItem, index: number): string {
  const lines: string[] = [];

  const durationStr = item.suggestedDuration ? ` (${item.suggestedDuration}min)` : '';
  lines.push(`### ${index}. ${item.topic}${durationStr}`);

  if (item.context) {
    lines.push('');
    lines.push(item.context);
  }

  if (item.sources && item.sources.length > 0) {
    lines.push('');
    lines.push('**Sources:**');
    for (const source of item.sources) {
      if (source.url) {
        lines.push(`- [${source.title || source.type}](${source.url})`);
      } else {
        lines.push(`- ${source.title || source.type}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format attendee short summary (for list)
 */
function formatAttendeeShort(attendee: AttendeeContext): string {
  let line = `- **${attendee.name}**`;

  if (attendee.role) {
    line += ` - ${attendee.role}`;
  }

  if (attendee.team) {
    line += ` (${attendee.team})`;
  }

  if (attendee.isDirectReport) {
    line += ' [Direct Report]';
  }

  return line;
}

/**
 * Format attendee detailed context
 */
function formatAttendeeContext(attendee: AttendeeContext): string | null {
  const lines: string[] = [];
  const activity = attendee.recentActivity;

  // Skip if no meaningful context
  if (!hasContextData(attendee)) {
    return null;
  }

  lines.push(`### ${attendee.name}`);

  if (attendee.role) {
    lines.push(`*${attendee.role}*`);
  }

  // Open action items
  if (attendee.openActionItems && attendee.openActionItems.length > 0) {
    lines.push('');
    lines.push('**Open Action Items:**');
    for (const item of attendee.openActionItems) {
      const staleMarker = item.status === 'stale' ? ' *(stale)*' : '';
      lines.push(`- [ ] ${item.text}${staleMarker}`);
    }
  }

  // Recent activity
  const activityItems: string[] = [];

  if (activity.prsAndReviews && activity.prsAndReviews.length > 0) {
    activityItems.push(`${activity.prsAndReviews.length} GitHub PRs/reviews`);
  }

  if (activity.linearIssues && activity.linearIssues.length > 0) {
    activityItems.push(`${activity.linearIssues.length} Linear issues`);
  }

  if (activity.slackHighlights && activity.slackHighlights.length > 0) {
    activityItems.push(`${activity.slackHighlights.length} Slack highlights`);
  }

  if (activity.emailThreads && activity.emailThreads.length > 0) {
    activityItems.push(`${activity.emailThreads.length} email threads`);
  }

  if (activityItems.length > 0) {
    lines.push('');
    lines.push(`**Recent Activity:** ${activityItems.join(', ')}`);
  }

  // Time off
  if (activity.timeOff && activity.timeOff.length > 0) {
    lines.push('');
    lines.push(`**Time Off:** ${activity.timeOff.length} upcoming/recent`);
  }

  // Previous topics
  if (attendee.previousTopics && attendee.previousTopics.length > 0) {
    lines.push('');
    lines.push(`**Previous Topics:** ${attendee.previousTopics.slice(0, 3).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Check if any attendee has context worth showing
 */
function hasAttendeeContext(attendees: AttendeeContext[]): boolean {
  return attendees.some(a => hasContextData(a));
}

/**
 * Check if attendee has meaningful context data
 */
function hasContextData(attendee: AttendeeContext): boolean {
  const activity = attendee.recentActivity;

  return (
    (attendee.openActionItems && attendee.openActionItems.length > 0) ||
    (attendee.previousTopics && attendee.previousTopics.length > 0) ||
    (activity.prsAndReviews && activity.prsAndReviews.length > 0) ||
    (activity.linearIssues && activity.linearIssues.length > 0) ||
    (activity.slackHighlights && activity.slackHighlights.length > 0) ||
    (activity.emailThreads && activity.emailThreads.length > 0) ||
    (activity.timeOff && activity.timeOff.length > 0)
  );
}

/**
 * Save meeting prep to file
 */
export function saveMeetingPrep(prep: MeetingPrep): void {
  const content = formatMeetingPrepMarkdown(prep);

  // Ensure directory exists
  const dir = dirname(prep.filePath);
  mkdirSync(dir, { recursive: true });

  // Write file
  writeFileSync(prep.filePath, content, 'utf-8');
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format datetime for display
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format multiple meeting preps as a daily overview
 */
export function formatDailyMeetingOverview(preps: MeetingPrep[]): string {
  if (preps.length === 0) {
    return 'No meetings scheduled.';
  }

  const lines: string[] = [];
  const date = formatDate(preps[0].startTime);

  lines.push(`# Meetings for ${date}`);
  lines.push('');

  // Sort by start time
  const sorted = [...preps].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  for (const prep of sorted) {
    const time = formatTime(prep.startTime);
    const type = getMeetingTypeDisplayName(prep.meetingType);
    const attendeeNames = prep.attendees.map(a => a.name).join(', ');
    const roleMarker = prep.isLeading ? ' [Leading]' : '';

    lines.push(`## ${time} - ${prep.title}${roleMarker}`);
    lines.push('');
    lines.push(`**Type:** ${type}`);

    if (attendeeNames) {
      lines.push(`**With:** ${attendeeNames}`);
    }

    // Quick summary
    if (prep.meetingType === 'one-on-one' && prep.oneOnOneScript) {
      const actionCount = prep.oneOnOneScript.actionItemReview.filter(
        item => item.startsWith('  -')
      ).length;
      if (actionCount > 0) {
        lines.push(`**Note:** ${actionCount} action items to review`);
      }
    } else if (prep.agendaItems.length > 0) {
      const duration = calculateAgendaDuration(prep.agendaItems);
      lines.push(`**Agenda:** ${prep.agendaItems.length} items (~${duration}min)`);
    }

    lines.push(`**Prep:** [View full prep](${prep.filePath})`);
    lines.push('');
  }

  return lines.join('\n');
}
