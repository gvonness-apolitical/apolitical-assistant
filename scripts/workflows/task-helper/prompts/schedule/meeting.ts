/**
 * Task Helper - Meeting Scheduling Prompts
 *
 * Prompts for scheduling meetings.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt, getSignature } from '../templates.js';

/**
 * Build prompt for meeting scheduling
 */
export function buildMeetingSchedulePrompt(
  context: TaskContext,
  purpose: string,
  duration: number,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('schedule', options)}

## Meeting Scheduling Guidelines
- Consider all attendees' availability
- Suggest multiple time options when possible
- Respect time zones
- Avoid back-to-back meetings when possible
- Consider the urgency of the meeting
- Default to shorter meetings when possible`;

  const user = `Please help schedule a meeting:

Context:
${formatContextForPrompt(context)}

Meeting purpose: ${purpose}
Duration: ${duration} minutes

${context.people && context.people.length > 0 ? `Attendees:\n${context.people.map((p) => `- ${p.name}${p.isOutOfOffice ? ' (Out of Office)' : ''}`).join('\n')}` : ''}

${context.calendar?.availability && context.calendar.availability.length > 0 ? `Available slots:\n${context.calendar.availability.map((s) => `- ${s.start} to ${s.end} (${s.duration} min)`).join('\n')}` : ''}

Suggest appropriate meeting times and help draft a meeting invite.`;

  return { system, user };
}

/**
 * Build prompt for meeting invite
 */
export function buildMeetingInvitePrompt(
  context: TaskContext,
  purpose: string,
  suggestedTime: string,
  duration: number,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('schedule', options)}

## Meeting Invite Guidelines
- Clear, specific title
- Concise but complete description
- Include agenda items if known
- State expected outcomes
- Include any prep work needed
- Keep it professional`;

  const signature = getSignature();
  const user = `Please draft a meeting invite:

Context:
${formatContextForPrompt(context)}

Meeting purpose: ${purpose}
Suggested time: ${suggestedTime}
Duration: ${duration} minutes

${context.people && context.people.length > 0 ? `Attendees:\n${context.people.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`).join('\n')}` : ''}

Draft a meeting invite with:
1. Clear, specific title
2. Purpose and expected outcomes
3. Agenda items
4. Any prep work needed
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for rescheduling request
 */
export function buildReschedulePrompt(
  context: TaskContext,
  reason: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('schedule', options)}

## Rescheduling Guidelines
- Be apologetic but professional
- Clearly state the reason (briefly)
- Propose alternative times
- Keep the original meeting context
- Make it easy for attendees to respond`;

  const signature = getSignature();
  const user = `Please draft a reschedule request:

Original meeting context:
${formatContextForPrompt(context)}

Reason for rescheduling: ${reason}

${context.calendar?.availability && context.calendar.availability.length > 0 ? `Alternative times available:\n${context.calendar.availability.map((s) => `- ${s.start} to ${s.end}`).join('\n')}` : ''}

Draft a polite reschedule message with alternative times.
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for meeting preparation
 */
export function buildMeetingPrepPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('schedule', options)}

## Meeting Prep Guidelines
- Summarize relevant context for each attendee
- List topics to discuss
- Prepare key questions
- Note any decisions needed
- Identify potential challenges or sensitivities`;

  const user = `Please help prepare for this meeting:

${formatContextForPrompt(context)}

${context.people && context.people.length > 0 ? `Attendees:\n${context.people.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}${p.recentActivity ? `\n  Recent: ${p.recentActivity}` : ''}`).join('\n')}` : ''}

Provide:
1. Key context to review
2. Suggested talking points
3. Questions to ask
4. Decisions needed
5. Potential challenges`;

  return { system, user };
}

/**
 * Build prompt for declining a meeting
 */
export function buildMeetingDeclinePrompt(
  context: TaskContext,
  reason: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('schedule', options)}

## Meeting Decline Guidelines
- Be polite and professional
- Briefly explain why you can't attend
- Suggest alternatives (delegate, async, reschedule)
- Offer to contribute in another way if possible
- Keep it brief`;

  const signature = getSignature();
  const user = `Please draft a meeting decline message:

Meeting context:
${formatContextForPrompt(context)}

Reason for declining: ${reason}

Draft a polite decline message that offers alternatives if possible.
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}
