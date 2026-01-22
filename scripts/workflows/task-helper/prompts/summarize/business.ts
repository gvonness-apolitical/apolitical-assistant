/**
 * Task Helper - Business Summarization Prompts
 *
 * Prompts for summarizing business content.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for executive summary
 */
export function buildExecutiveSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Executive Summary Guidelines
- Lead with the most important information
- Focus on business impact and outcomes
- Avoid technical jargon unless necessary
- Include clear recommendations or decisions needed
- Keep it brief - executives are busy

## Summary Format
1. **Bottom Line**: Key takeaway in one sentence
2. **Situation**: Brief context
3. **Impact**: Business implications
4. **Recommendation**: Suggested action
5. **Next Steps**: What needs to happen`;

  const user = `Please create an executive summary:

${formatContextForPrompt(context)}

Create a concise summary suitable for executive/leadership review. Focus on business impact and key decisions.`;

  return { system, user };
}

/**
 * Build prompt for project status summary
 */
export function buildProjectStatusSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Project Status Summary Guidelines
- State overall project health clearly
- Highlight progress against milestones
- Flag risks and blockers prominently
- Note resource needs if any
- Keep it scannable with clear sections

## Summary Format
1. **Status**: Green/Yellow/Red with brief explanation
2. **Progress**: What's been accomplished
3. **Upcoming**: Next milestones
4. **Risks**: Current concerns
5. **Needs**: Resources or decisions required`;

  const user = `Please summarize the project status:

${formatContextForPrompt(context)}

${context.sourceDetails.projectName ? `Project: ${context.sourceDetails.projectName}` : ''}

Create a clear status summary that shows overall health, progress, and any concerns.`;

  return { system, user };
}

/**
 * Build prompt for meeting summary
 */
export function buildMeetingSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Meeting Summary Guidelines
- Start with purpose and outcome of the meeting
- Capture key decisions made
- List action items with clear owners and due dates
- Note topics that need follow-up discussion
- Keep it concise and actionable

## Summary Format
1. **Purpose**: Why the meeting was held
2. **Attendees**: Who was there
3. **Decisions**: What was decided
4. **Actions**: Tasks with owners and dates
5. **Follow-ups**: Items for next meeting`;

  const user = `Please summarize this meeting:

${formatContextForPrompt(context)}

${context.people && context.people.length > 0 ? `Attendees: ${context.people.map((p) => p.name).join(', ')}` : ''}

Create a clear meeting summary with decisions and action items.`;

  return { system, user };
}

/**
 * Build prompt for email thread summary
 */
export function buildEmailThreadSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Email Thread Summary Guidelines
- Identify the main topic and question
- Summarize the conversation flow
- Note who said what (when relevant)
- Highlight decisions or commitments made
- Identify what action is needed now

## Summary Format
1. **Topic**: What the thread is about
2. **Key Points**: Main items discussed
3. **Decisions**: Conclusions reached
4. **Action Needed**: What needs to happen
5. **Participants**: Who's involved`;

  const user = `Please summarize this email thread:

${formatContextForPrompt(context)}

${context.sourceDetails.subject ? `Subject: ${context.sourceDetails.subject}` : ''}

Summarize the conversation and identify what action is needed.`;

  return { system, user };
}

/**
 * Build prompt for stakeholder update
 */
export function buildStakeholderUpdatePrompt(
  context: TaskContext,
  audience: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Stakeholder Update Guidelines
- Tailor the message for the specific audience
- Lead with what matters to them
- Be transparent about challenges
- Include clear next steps
- Offer to provide more details if needed

## Update Format
1. **Headline**: Key message in one line
2. **Progress**: What's happened
3. **Impact**: What it means for them
4. **Challenges**: Current issues (if any)
5. **Next Steps**: What's coming`;

  const user = `Please create a stakeholder update:

${formatContextForPrompt(context)}

Audience: ${audience}

Create an update appropriate for this audience, focusing on what matters to them.`;

  return { system, user };
}
