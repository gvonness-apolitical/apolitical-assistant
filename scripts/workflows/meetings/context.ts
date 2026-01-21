/**
 * Attendee Context Gathering
 *
 * Gather context about meeting attendees from various sources.
 */

import type {
  AttendeeContext,
  DirectReport,
  ActionItemTracking,
} from './types.js';
import { loadMeetingConfig } from './config.js';
import { get121ActionItems } from './action-items.js';

/**
 * Gather context for an attendee
 */
export async function gatherAttendeeContext(
  email: string,
  directReports: DirectReport[],
  lookbackDays?: number
): Promise<AttendeeContext> {
  const config = loadMeetingConfig();
  const days = lookbackDays ?? config.oneOnOneSettings.lookbackDays;

  // Check if this is a direct report
  const directReport = directReports.find(
    dr => dr.email.toLowerCase() === email.toLowerCase()
  );

  const context: AttendeeContext = {
    email,
    name: directReport?.name ?? email.split('@')[0],
    role: directReport?.role,
    team: directReport?.team,
    isDirectReport: !!directReport,
    recentActivity: {},
    previousTopics: [],
    openActionItems: [],
  };

  // Gather context in parallel
  const contextPromises: Promise<void>[] = [];

  // GitHub activity
  if (config.oneOnOneSettings.includeGitHubActivity) {
    contextPromises.push(
      gatherGitHubContext(email, days).then(data => {
        context.recentActivity.prsAndReviews = data;
      }).catch(() => { /* ignore errors */ })
    );
  }

  // Linear issues
  if (config.oneOnOneSettings.includeLinearIssues) {
    contextPromises.push(
      gatherLinearContext(email, days).then(data => {
        context.recentActivity.linearIssues = data;
      }).catch(() => { /* ignore errors */ })
    );
  }

  // Slack highlights
  if (config.oneOnOneSettings.includeSlackHighlights) {
    contextPromises.push(
      gatherSlackContext(email, days).then(data => {
        context.recentActivity.slackHighlights = data;
      }).catch(() => { /* ignore errors */ })
    );
  }

  // Email threads
  if (config.oneOnOneSettings.includeEmailThreads) {
    contextPromises.push(
      gatherEmailContext(email, days).then(data => {
        context.recentActivity.emailThreads = data;
      }).catch(() => { /* ignore errors */ })
    );
  }

  // Time off
  if (config.oneOnOneSettings.includeTimeOff) {
    contextPromises.push(
      gatherTimeOffContext(email).then(data => {
        context.recentActivity.timeOff = data;
      }).catch(() => { /* ignore errors */ })
    );
  }

  // Action items from previous 1:1s
  contextPromises.push(
    get121ActionItems(email).then(items => {
      context.openActionItems = items.filter(i => i.status === 'open');
      context.previousTopics = extractTopics(items);
    }).catch(() => { /* ignore errors */ })
  );

  await Promise.all(contextPromises);

  return context;
}

/**
 * Gather GitHub context for an attendee
 */
async function gatherGitHubContext(_email: string, _days: number): Promise<unknown[]> {
  // This will be implemented to use the GitHub collector
  // For now, return empty array
  // TODO: Implement GitHub context gathering via MCP
  return [];
}

/**
 * Gather Linear context for an attendee
 */
async function gatherLinearContext(_email: string, _days: number): Promise<unknown[]> {
  // This will be implemented to use the Linear collector
  // For now, return empty array
  // TODO: Implement Linear context gathering via MCP
  return [];
}

/**
 * Gather Slack context for an attendee
 */
async function gatherSlackContext(_email: string, _days: number): Promise<unknown[]> {
  // This will be implemented to use the Slack collector
  // For now, return empty array
  // TODO: Implement Slack context gathering via MCP
  return [];
}

/**
 * Gather email context for an attendee
 */
async function gatherEmailContext(_email: string, _days: number): Promise<unknown[]> {
  // This will be implemented to use the Gmail collector
  // For now, return empty array
  // TODO: Implement email context gathering via MCP
  return [];
}

/**
 * Gather time off context for an attendee
 */
async function gatherTimeOffContext(_email: string): Promise<unknown[]> {
  // This will be implemented to use the Humaans collector
  // For now, return empty array
  // TODO: Implement time off context gathering via MCP
  return [];
}

/**
 * Extract topics from action items
 */
function extractTopics(items: ActionItemTracking[]): string[] {
  const topics = new Set<string>();

  for (const item of items) {
    // Extract topic from action item text (simple heuristic)
    const words = item.text.split(' ').slice(0, 5).join(' ');
    if (words.length > 10) {
      topics.add(words + '...');
    }
  }

  return Array.from(topics).slice(0, 5);
}

/**
 * Format attendee context for display
 */
export function formatAttendeeContext(context: AttendeeContext): string {
  const lines: string[] = [];

  lines.push(`## ${context.name}`);
  if (context.role) {
    lines.push(`*${context.role}*`);
  }
  if (context.team) {
    lines.push(`Team: ${context.team}`);
  }

  // Open action items
  if (context.openActionItems && context.openActionItems.length > 0) {
    lines.push('\n### Open Action Items');
    for (const item of context.openActionItems) {
      const staleMarker = item.status === 'stale' ? ' (stale)' : '';
      lines.push(`- [ ] ${item.text}${staleMarker}`);
    }
  }

  // Recent activity summary
  const activity = context.recentActivity;
  const activityItems: string[] = [];

  if (activity.prsAndReviews && activity.prsAndReviews.length > 0) {
    activityItems.push(`${activity.prsAndReviews.length} PRs/reviews`);
  }
  if (activity.linearIssues && activity.linearIssues.length > 0) {
    activityItems.push(`${activity.linearIssues.length} Linear issues`);
  }
  if (activity.slackHighlights && activity.slackHighlights.length > 0) {
    activityItems.push(`${activity.slackHighlights.length} Slack highlights`);
  }

  if (activityItems.length > 0) {
    lines.push(`\n### Recent Activity`);
    lines.push(activityItems.join(', '));
  }

  // Time off
  if (activity.timeOff && activity.timeOff.length > 0) {
    lines.push('\n### Time Off');
    lines.push(`${activity.timeOff.length} upcoming/recent time off entries`);
  }

  return lines.join('\n');
}
