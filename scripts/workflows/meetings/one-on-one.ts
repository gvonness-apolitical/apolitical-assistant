/**
 * 1:1 Script Generation
 *
 * Generate comprehensive 1:1 scripts for meetings with direct reports.
 */

import type {
  CalendarEvent,
  MeetingPrep,
  OneOnOneScript,
  AttendeeContext,
  DirectReport,
} from './types.js';
import { loadMeetingConfig, get121PrepPath } from './config.js';
import { gatherAttendeeContext } from './context.js';
import { get121ActionItems } from './action-items.js';
import { findPrevious121Notes } from './history.js';

/**
 * Generate a 1:1 script for a direct report
 */
export async function generate121Script(
  event: CalendarEvent,
  attendeeEmail: string,
  directReports: DirectReport[],
  _myEmail: string
): Promise<MeetingPrep> {
  const config = loadMeetingConfig();

  // Get direct report info (kept for future use with delivery metrics)
  const _directReport = directReports.find(
    dr => dr.email.toLowerCase() === attendeeEmail.toLowerCase()
  );

  // Gather comprehensive context
  const attendeeContext = await gatherAttendeeContext(
    attendeeEmail,
    directReports,
    config.oneOnOneSettings.lookbackDays
  );

  // Get action items from previous 1:1s
  const actionItems = await get121ActionItems(attendeeEmail);

  // Get previous 1:1 notes
  const previousNotes = await findPrevious121Notes(attendeeEmail);

  // Generate the script
  const script = generateScript(
    attendeeContext,
    actionItems,
    previousNotes,
    config
  );

  const date = new Date(event.startTime).toISOString().split('T')[0];
  const prepPath = get121PrepPath(date, attendeeEmail);

  return {
    id: `121-${event.id}`,
    calendarEventId: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    meetingType: 'one-on-one',
    isLeading: true,
    attendees: [attendeeContext],
    agendaItems: [], // 1:1s use script instead of agenda
    oneOnOneScript: script,
    generatedAt: new Date().toISOString(),
    filePath: prepPath,
  };
}

/**
 * Generate the structured 1:1 script
 */
function generateScript(
  context: AttendeeContext,
  actionItems: Awaited<ReturnType<typeof get121ActionItems>>,
  previousNotes: Awaited<ReturnType<typeof findPrevious121Notes>>,
  _config: ReturnType<typeof loadMeetingConfig>
): OneOnOneScript {
  const openItems = actionItems.filter(i => i.status === 'open');
  const staleItems = actionItems.filter(i => i.status === 'stale');
  const recentlyCompleted = actionItems.filter(i => i.status === 'completed').slice(0, 3);

  return {
    openingTopics: generateOpeningTopics(context),
    performanceDiscussion: generatePerformanceTopics(context),
    developmentTopics: generateDevelopmentTopics(context, previousNotes),
    actionItemReview: generateActionItemReview(openItems, staleItems, recentlyCompleted),
    closingItems: generateClosingItems(context),
  };
}

/**
 * Generate opening/check-in topics
 */
function generateOpeningTopics(context: AttendeeContext): string[] {
  const topics: string[] = [];

  topics.push('How are you doing? How was your week?');

  // Check for time off
  if (context.recentActivity.timeOff && context.recentActivity.timeOff.length > 0) {
    topics.push('How was your time off? Feeling refreshed?');
  }

  // Check for any recent activity that might be worth celebrating
  if (
    context.recentActivity.prsAndReviews &&
    context.recentActivity.prsAndReviews.length > 3
  ) {
    topics.push('Looks like you\'ve been busy with code reviews - how\'s that going?');
  }

  topics.push('Anything on your mind you want to start with?');

  return topics;
}

/**
 * Generate performance discussion topics
 */
function generatePerformanceTopics(context: AttendeeContext): string[] {
  const topics: string[] = [];

  // Recent work from activity
  if (
    context.recentActivity.linearIssues &&
    context.recentActivity.linearIssues.length > 0
  ) {
    topics.push(
      `You've been working on ${context.recentActivity.linearIssues.length} Linear issues recently - any highlights or challenges?`
    );
  }

  if (
    context.recentActivity.prsAndReviews &&
    context.recentActivity.prsAndReviews.length > 0
  ) {
    topics.push(
      `${context.recentActivity.prsAndReviews.length} PRs/reviews in the last period - anything notable?`
    );
  }

  // General performance topics
  topics.push('What\'s your current focus? How do you feel about progress?');
  topics.push('Any blockers or areas where you need support?');
  topics.push('How is your workload? Sustainable pace?');

  return topics;
}

/**
 * Generate development/growth topics
 */
function generateDevelopmentTopics(
  context: AttendeeContext,
  previousNotes: Awaited<ReturnType<typeof findPrevious121Notes>>
): string[] {
  const topics: string[] = [];

  // Check for recurring themes from previous notes
  if (previousNotes.length > 0) {
    const previousTopics = previousNotes
      .slice(0, 3)
      .flatMap(n => n.topics);

    const uniqueTopics = [...new Set(previousTopics)].slice(0, 3);
    if (uniqueTopics.length > 0) {
      topics.push(`Previously discussed: ${uniqueTopics.join(', ')} - any updates?`);
    }
  }

  // General development topics
  topics.push('What skills are you looking to develop?');
  topics.push('Any projects or areas you\'d like to explore?');
  topics.push('How can I better support your growth?');

  // Role-specific
  if (context.role?.toLowerCase().includes('senior')) {
    topics.push('Any mentorship or leadership opportunities you\'re interested in?');
  }

  return topics;
}

/**
 * Generate action item review section
 */
function generateActionItemReview(
  openItems: Awaited<ReturnType<typeof get121ActionItems>>,
  staleItems: Awaited<ReturnType<typeof get121ActionItems>>,
  completedItems: Awaited<ReturnType<typeof get121ActionItems>>
): string[] {
  const topics: string[] = [];

  // Recently completed - acknowledge
  if (completedItems.length > 0) {
    topics.push(`Completed since last time: ${completedItems.map(i => i.text).join(', ')}`);
  }

  // Open items - check status
  if (openItems.length > 0) {
    topics.push('Open action items:');
    for (const item of openItems) {
      topics.push(`  - ${item.text}`);
    }
  }

  // Stale items - need discussion
  if (staleItems.length > 0) {
    topics.push('Stale items (need decision - keep, drop, or modify):');
    for (const item of staleItems) {
      const days = daysSince(item.createdAt);
      topics.push(`  - ${item.text} (${days} days old)`);
    }
  }

  if (openItems.length === 0 && staleItems.length === 0) {
    topics.push('No open action items from previous 1:1s');
  }

  return topics;
}

/**
 * Generate closing items
 */
function generateClosingItems(context: AttendeeContext): string[] {
  const topics: string[] = [];

  topics.push('What support do you need from me this week?');
  topics.push('Anything else you want to discuss?');
  topics.push('New action items to capture:');

  // Team-related if they have team info
  if (context.team) {
    topics.push(`Any feedback on how the ${context.team} team is doing?`);
  }

  return topics;
}

/**
 * Calculate days since a date
 */
function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format the 1:1 script for display
 */
export function format121Script(prep: MeetingPrep): string {
  const lines: string[] = [];
  const script = prep.oneOnOneScript;
  const attendee = prep.attendees[0];

  if (!script) {
    return 'No 1:1 script generated';
  }

  lines.push(`# 1:1 with ${attendee.name}`);
  lines.push(`**Date:** ${new Date(prep.startTime).toLocaleDateString()}`);
  lines.push(`**Time:** ${new Date(prep.startTime).toLocaleTimeString()} - ${new Date(prep.endTime).toLocaleTimeString()}`);

  if (attendee.role) {
    lines.push(`**Role:** ${attendee.role}`);
  }
  if (attendee.team) {
    lines.push(`**Team:** ${attendee.team}`);
  }

  lines.push('\n---\n');

  // Opening
  lines.push('## Check-in');
  for (const topic of script.openingTopics) {
    lines.push(`- ${topic}`);
  }

  // Performance
  lines.push('\n## Current Work & Performance');
  for (const topic of script.performanceDiscussion) {
    lines.push(`- ${topic}`);
  }

  // Development
  lines.push('\n## Development & Growth');
  for (const topic of script.developmentTopics) {
    lines.push(`- ${topic}`);
  }

  // Action items
  lines.push('\n## Action Item Review');
  for (const topic of script.actionItemReview) {
    lines.push(topic.startsWith('  ') ? topic : `- ${topic}`);
  }

  // Closing
  lines.push('\n## Wrap-up');
  for (const topic of script.closingItems) {
    lines.push(`- ${topic}`);
  }

  // Recent activity summary
  if (attendee.recentActivity) {
    lines.push('\n---\n');
    lines.push('## Recent Activity (Reference)');

    const activity = attendee.recentActivity;
    if (activity.prsAndReviews && activity.prsAndReviews.length > 0) {
      lines.push(`- **GitHub:** ${activity.prsAndReviews.length} PRs/reviews`);
    }
    if (activity.linearIssues && activity.linearIssues.length > 0) {
      lines.push(`- **Linear:** ${activity.linearIssues.length} issues`);
    }
    if (activity.slackHighlights && activity.slackHighlights.length > 0) {
      lines.push(`- **Slack:** ${activity.slackHighlights.length} highlights`);
    }
    if (activity.timeOff && activity.timeOff.length > 0) {
      lines.push(`- **Time Off:** ${activity.timeOff.length} entries`);
    }
  }

  return lines.join('\n');
}

/**
 * Get summary of 1:1 prep for briefings
 */
export function get121PrepSummary(prep: MeetingPrep): string {
  const attendee = prep.attendees[0];
  const script = prep.oneOnOneScript;

  if (!script) {
    return `1:1 with ${attendee.name}`;
  }

  const actionItemCount =
    script.actionItemReview.filter(item =>
      item.startsWith('  -')
    ).length;

  let summary = `1:1 with ${attendee.name}`;
  if (attendee.role) {
    summary += ` (${attendee.role})`;
  }
  if (actionItemCount > 0) {
    summary += ` - ${actionItemCount} action items to review`;
  }

  return summary;
}
