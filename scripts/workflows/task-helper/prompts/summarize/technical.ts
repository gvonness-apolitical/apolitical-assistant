/**
 * Task Helper - Technical Summarization Prompts
 *
 * Prompts for summarizing technical content.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for technical summary
 */
export function buildTechnicalSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Technical Summary Guidelines
- Focus on key technical decisions and their rationale
- Highlight any architectural implications
- Note dependencies and integration points
- Identify potential risks or concerns
- Keep it concise but complete

## Summary Structure
1. **Overview**: One sentence summary
2. **Key Points**: Main technical details
3. **Decisions**: Important decisions made
4. **Risks/Concerns**: Potential issues to watch
5. **Next Steps**: What needs to happen next`;

  const user = `Please provide a technical summary:

${formatContextForPrompt(context)}

Create a concise technical summary that captures the key information, decisions, and implications.`;

  return { system, user };
}

/**
 * Build prompt for PR summary
 */
export function buildPRSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## PR Summary Guidelines
- Explain what changes were made and why
- Note any breaking changes
- Highlight key implementation decisions
- Mention testing approach
- Keep it scannable for reviewers

## Summary Format
1. **What**: Brief description of changes
2. **Why**: Motivation for the changes
3. **How**: Key implementation details
4. **Testing**: How it was tested
5. **Notes**: Anything reviewers should know`;

  const user = `Please summarize this Pull Request:

${formatContextForPrompt(context)}

${context.sourceDetails.changedFiles ? `Files changed: ${context.sourceDetails.changedFiles}` : ''}
${context.sourceDetails.additions !== undefined ? `Lines added: ${context.sourceDetails.additions}` : ''}
${context.sourceDetails.deletions !== undefined ? `Lines removed: ${context.sourceDetails.deletions}` : ''}

Create a clear summary that helps reviewers understand the changes quickly.`;

  return { system, user };
}

/**
 * Build prompt for incident summary
 */
export function buildIncidentSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Incident Summary Guidelines
- State the impact clearly upfront
- Summarize the timeline of events
- Explain root cause (if known)
- List actions taken to resolve
- Identify follow-up items
- Keep it factual and concise

## Summary Format
1. **Impact**: What was affected and for how long
2. **Timeline**: Key events in chronological order
3. **Root Cause**: What caused the incident
4. **Resolution**: How it was fixed
5. **Follow-ups**: Actions to prevent recurrence`;

  const user = `Please summarize this incident:

${formatContextForPrompt(context)}

${context.sourceDetails.severity ? `Severity: ${context.sourceDetails.severity}` : ''}
${context.sourceDetails.incidentStatus ? `Status: ${context.sourceDetails.incidentStatus}` : ''}

Create a clear incident summary covering impact, timeline, root cause, resolution, and follow-ups.`;

  return { system, user };
}

/**
 * Build prompt for discussion summary
 */
export function buildDiscussionSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Discussion Summary Guidelines
- Capture the main topic and question
- Summarize different viewpoints presented
- Note any decisions or conclusions reached
- List action items with owners
- Highlight unresolved items

## Summary Format
1. **Topic**: What was discussed
2. **Key Points**: Main arguments/perspectives
3. **Decisions**: Conclusions reached
4. **Actions**: Tasks with owners
5. **Open Items**: Unresolved questions`;

  const user = `Please summarize this discussion:

${formatContextForPrompt(context)}

Capture the key points, decisions, and action items from the discussion.`;

  return { system, user };
}
