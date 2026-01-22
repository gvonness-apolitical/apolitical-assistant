/**
 * Task Helper - Linear Response Prompts
 *
 * Prompts for responding to Linear issues.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for Linear issue comment
 */
export function buildLinearCommentPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Linear Comment Guidelines
- Keep comments focused on the issue at hand
- Be clear and actionable
- Use markdown formatting appropriately
- Reference related issues or PRs when relevant
- Update the issue status if your comment reflects progress`;

  const user = `Please draft a comment for this Linear issue:

${formatContextForPrompt(context)}

${context.sourceDetails.projectName ? `Project: ${context.sourceDetails.projectName}` : ''}
${context.sourceDetails.teamName ? `Team: ${context.sourceDetails.teamName}` : ''}
${context.sourceDetails.estimate !== undefined ? `Estimate: ${context.sourceDetails.estimate} points` : ''}

Draft an appropriate comment for this issue.`;

  return { system, user };
}

/**
 * Build prompt for Linear issue status update
 */
export function buildLinearStatusUpdatePrompt(
  context: TaskContext,
  newStatus: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Status Update Guidelines
- Explain why the status is changing
- Summarize what's been done or what's blocking
- Set expectations for next steps
- Keep it concise`;

  const user = `Please draft a status update comment for this Linear issue:

${formatContextForPrompt(context)}

Changing status to: ${newStatus}

Draft a brief comment explaining this status change.`;

  return { system, user };
}

/**
 * Build prompt for Linear issue breakdown
 */
export function buildLinearBreakdownPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Issue Breakdown Guidelines
- Break the task into smaller, manageable sub-tasks
- Each sub-task should be independently completable
- Include estimates if possible
- Consider dependencies between sub-tasks
- Make sure the breakdown covers the full scope`;

  const user = `Please help break down this Linear issue into sub-tasks:

${formatContextForPrompt(context)}

Create a breakdown that:
1. Lists clear, actionable sub-tasks
2. Notes any dependencies
3. Suggests rough estimates if possible
4. Covers the full scope of the original issue`;

  return { system, user };
}

/**
 * Build prompt for Linear issue clarification request
 */
export function buildLinearClarificationPrompt(
  context: TaskContext,
  uncertainties: string[],
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Clarification Request Guidelines
- Be specific about what's unclear
- Suggest possible interpretations if you have ideas
- List questions in order of importance
- Make it easy for the requester to respond
- Keep it constructive and collaborative`;

  const user = `Please draft a clarification request for this Linear issue:

${formatContextForPrompt(context)}

Uncertainties to address:
${uncertainties.map((u) => `- ${u}`).join('\n')}

Draft a comment that:
1. Acknowledges the task
2. Lists specific questions that need answers
3. Suggests possible approaches if relevant
4. Offers to discuss further if needed`;

  return { system, user };
}

/**
 * Build prompt for Linear issue completion summary
 */
export function buildLinearCompletionPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('complete', options)}

## Completion Summary Guidelines
- Summarize what was done
- Link to relevant PRs or documentation
- Note any follow-up items or related work
- Thank collaborators if applicable
- Keep it brief but complete`;

  const user = `Please draft a completion comment for this Linear issue:

${formatContextForPrompt(context)}

Draft a brief completion summary that:
1. Confirms what was completed
2. Links to relevant PRs or deliverables
3. Notes any follow-up items
4. Thanks anyone who helped`;

  return { system, user };
}
