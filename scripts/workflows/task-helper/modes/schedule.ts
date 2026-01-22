/**
 * Task Helper - Schedule Mode
 *
 * Mode for scheduling meetings and managing calendar.
 */

import type { TaskContext, HelperResponse, StructuredOutput, SuggestedTime } from '../types.js';
import type { TemplateOptions } from '../prompts/templates.js';

// Import schedule prompts
import {
  buildMeetingSchedulePrompt,
  buildMeetingInvitePrompt,
  buildReschedulePrompt,
  buildMeetingPrepPrompt,
  buildMeetingDeclinePrompt,
} from '../prompts/schedule/meeting.js';

/**
 * Schedule action type
 */
export type ScheduleAction = 'schedule' | 'invite' | 'reschedule' | 'prepare' | 'decline';

/**
 * Options for schedule mode
 */
export interface ScheduleModeOptions extends TemplateOptions {
  action?: ScheduleAction;
  duration?: number; // minutes
  purpose?: string;
  suggestedTime?: string;
  declineReason?: string;
  rescheduleReason?: string;
}

/**
 * Get the appropriate prompt for schedule mode based on action
 */
export function getSchedulePrompt(
  context: TaskContext,
  options: ScheduleModeOptions = {}
): { system: string; user: string } {
  const action = options.action ?? detectScheduleAction(context);

  switch (action) {
    case 'invite':
      return buildMeetingInvitePrompt(
        context,
        options.purpose ?? context.sourceDetails.title,
        options.suggestedTime ?? 'To be determined',
        options.duration ?? 30,
        options
      );

    case 'reschedule':
      return buildReschedulePrompt(
        context,
        options.rescheduleReason ?? 'Conflict with another commitment',
        options
      );

    case 'prepare':
      return buildMeetingPrepPrompt(context, options);

    case 'decline':
      return buildMeetingDeclinePrompt(
        context,
        options.declineReason ?? 'Unable to attend',
        options
      );

    case 'schedule':
    default:
      return buildMeetingSchedulePrompt(
        context,
        options.purpose ?? context.sourceDetails.title,
        options.duration ?? 30,
        options
      );
  }
}

/**
 * Detect the appropriate schedule action based on context
 */
function detectScheduleAction(context: TaskContext): ScheduleAction {
  const title = context.sourceDetails.title.toLowerCase();
  const description = (context.sourceDetails.description ?? '').toLowerCase();

  // Check for reschedule keywords
  if (
    title.includes('reschedule') ||
    description.includes('reschedule') ||
    title.includes('move') ||
    description.includes('move the meeting')
  ) {
    return 'reschedule';
  }

  // Check for decline keywords
  if (
    title.includes('decline') ||
    title.includes('cancel') ||
    description.includes("can't attend") ||
    description.includes('unable to attend')
  ) {
    return 'decline';
  }

  // Check for prep keywords
  if (
    title.includes('prep') ||
    title.includes('prepare') ||
    description.includes('prepare for') ||
    description.includes('preparation')
  ) {
    return 'prepare';
  }

  // Check if this looks like an existing meeting (has calendar event)
  if (context.calendar?.relevantEvents && context.calendar.relevantEvents.length > 0) {
    return 'prepare';
  }

  // Default to scheduling
  return 'schedule';
}

/**
 * Execute schedule mode
 *
 * Note: This function builds the prompt and context for schedule assistance.
 * The actual LLM call would be made by the CLI when this runs in Claude Code.
 */
export async function executeScheduleMode(
  context: TaskContext,
  options: ScheduleModeOptions = {}
): Promise<HelperResponse> {
  const prompt = getSchedulePrompt(context, options);
  const action = options.action ?? detectScheduleAction(context);

  // Build the structured output placeholder
  const structured: StructuredOutput = {
    suggestedTimes: undefined, // Will be filled by LLM if scheduling
    meetingAgenda: undefined,
  };

  // Build the response
  const response: HelperResponse = {
    todoId: context.todo.id,
    mode: 'schedule',
    content: `## Schedule (${action})\n\n*Scheduling assistance will be generated based on the following prompt:*\n\n**System:**\n${prompt.system}\n\n**User:**\n${prompt.user}`,
    structured,
    actions: [
      {
        type: 'display',
        description: 'Schedule prompt prepared',
        status: 'completed',
      },
    ],
    contextSummary: buildContextSummary(context, action),
    generatedAt: new Date().toISOString(),
  };

  return response;
}

/**
 * Build a summary of the context used
 */
function buildContextSummary(context: TaskContext, action: ScheduleAction): string {
  const parts: string[] = [];

  parts.push(`Action: ${action}`);

  if (context.people && context.people.length > 0) {
    const available = context.people.filter((p) => !p.isOutOfOffice).length;
    const ooo = context.people.filter((p) => p.isOutOfOffice).length;
    parts.push(`People: ${available} available${ooo > 0 ? `, ${ooo} OOO` : ''}`);
  }

  if (context.calendar?.availability && context.calendar.availability.length > 0) {
    parts.push(`Available slots: ${context.calendar.availability.length}`);
  }

  return parts.join(' | ');
}

/**
 * Get recommended output type for schedule mode
 */
export function getRecommendedOutput(action: ScheduleAction): 'mcp' | 'clipboard' | 'display' {
  switch (action) {
    case 'invite':
    case 'reschedule':
    case 'decline':
      return 'clipboard'; // For pasting into calendar/email

    case 'prepare':
    case 'schedule':
    default:
      return 'display';
  }
}

/**
 * Format suggested times for display
 */
export function formatSuggestedTimes(times: SuggestedTime[]): string {
  if (times.length === 0) {
    return 'No suggested times available.';
  }

  const lines: string[] = ['## Suggested Times', ''];

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    lines.push(`### Option ${i + 1}`);
    lines.push(`- **Time:** ${time.start} - ${time.end}`);
    lines.push(`- **Duration:** ${time.duration} minutes`);

    if (time.attendeesAvailable && time.attendeesAvailable.length > 0) {
      lines.push(`- **Available:** ${time.attendeesAvailable.join(', ')}`);
    }

    if (time.conflicts && time.conflicts.length > 0) {
      lines.push(`- **Conflicts:** ${time.conflicts.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format meeting agenda for display
 */
export function formatMeetingAgenda(agenda: string[]): string {
  if (agenda.length === 0) {
    return 'No agenda items.';
  }

  const lines: string[] = ['## Meeting Agenda', ''];

  for (let i = 0; i < agenda.length; i++) {
    lines.push(`${i + 1}. ${agenda[i]}`);
  }

  return lines.join('\n');
}
