/**
 * Task Helper - GitHub PR Response Prompts
 *
 * Prompts for responding to GitHub Pull Requests.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt, getSignature } from '../templates.js';

/**
 * Build prompt for PR review response
 */
export function buildPRReviewPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('review', options)}

## PR Review Guidelines
- Focus on code quality, correctness, and maintainability
- Be constructive - suggest improvements rather than just criticizing
- Acknowledge good patterns and decisions
- Flag any potential bugs, security issues, or performance concerns
- Consider the broader context of the codebase
- Keep comments focused and actionable

## Review Categories
Use these categories for your feedback:
- **Praise**: Acknowledge good code, patterns, or decisions
- **Question**: Ask for clarification when needed
- **Suggestion**: Propose improvements (non-blocking)
- **Concern**: Flag potential issues (may need addressing)
- **Blocker**: Critical issues that must be fixed before merge

## Output Format
Provide your review in this structure:
1. **Summary**: Brief overall assessment (1-2 sentences)
2. **Key Points**: Main observations (bulleted list)
3. **Detailed Comments**: Specific file/line feedback if applicable
4. **Recommendation**: APPROVE, REQUEST_CHANGES, or COMMENT`;

  const user = `Please review this Pull Request and provide feedback:

${formatContextForPrompt(context)}

${context.sourceDetails.prNumber ? `This is PR #${context.sourceDetails.prNumber}` : ''}
${context.sourceDetails.changedFiles ? `Changed files: ${context.sourceDetails.changedFiles}` : ''}
${context.sourceDetails.additions !== undefined ? `Additions: +${context.sourceDetails.additions}` : ''}
${context.sourceDetails.deletions !== undefined ? `Deletions: -${context.sourceDetails.deletions}` : ''}
${context.sourceDetails.ciStatus ? `CI Status: ${context.sourceDetails.ciStatus}` : ''}

Please provide a thorough but constructive review.`;

  return { system, user };
}

/**
 * Build prompt for PR comment response
 */
export function buildPRCommentPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Comment Guidelines
- Address the specific question or feedback in the thread
- Be helpful and collaborative
- If providing code suggestions, make them complete and correct
- Reference relevant documentation or examples when helpful
- Keep responses focused on the topic at hand`;

  const signature = getSignature();
  const user = `Please draft a response to this PR comment thread:

${formatContextForPrompt(context)}

Draft a helpful, appropriate response to continue this conversation.
${signature ? `\nInclude this signature at the end: ${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for PR approval message
 */
export function buildPRApprovalPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Approval Message Guidelines
- Keep it brief but specific
- Mention what you reviewed and why it looks good
- Note any minor suggestions that don't block approval
- Be encouraging to the author`;

  const user = `This PR is ready to approve. Draft a brief approval message:

${formatContextForPrompt(context)}

Write a concise approval message (1-3 sentences) that:
1. Confirms the PR looks good
2. Optionally mentions any positive observations
3. Optionally includes minor non-blocking suggestions`;

  return { system, user };
}

/**
 * Build prompt for requesting PR changes
 */
export function buildPRChangesRequestPrompt(
  context: TaskContext,
  concerns: string[],
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Change Request Guidelines
- Be clear and specific about what needs to change
- Explain WHY changes are needed, not just WHAT
- Provide actionable suggestions
- Prioritize concerns (what's critical vs. nice-to-have)
- Maintain a collaborative, helpful tone`;

  const user = `This PR needs changes before it can be approved. Draft a change request message:

${formatContextForPrompt(context)}

The following concerns were identified:
${concerns.map((c) => `- ${c}`).join('\n')}

Write a clear, constructive change request that:
1. Summarizes the main issues
2. Explains each concern and why it matters
3. Suggests how to address them
4. Offers to help if appropriate`;

  return { system, user };
}
