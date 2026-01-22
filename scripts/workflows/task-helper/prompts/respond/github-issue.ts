/**
 * Task Helper - GitHub Issue Response Prompts
 *
 * Prompts for responding to GitHub Issues.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt, getSignature } from '../templates.js';

/**
 * Build prompt for issue response
 */
export function buildIssueResponsePrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Issue Response Guidelines
- Address the specific question or problem raised
- Be helpful and solution-oriented
- If you need more information, ask specific questions
- Reference relevant documentation, code, or examples
- Set appropriate expectations for resolution timeline if known
- Thank the reporter for the detailed report if applicable`;

  const signature = getSignature();
  const user = `Please draft a response to this GitHub issue:

${formatContextForPrompt(context)}

${context.sourceDetails.issueNumber ? `This is Issue #${context.sourceDetails.issueNumber}` : ''}

Draft a helpful response that addresses the issue.
${signature ? `\nInclude this signature at the end: ${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for bug triage response
 */
export function buildBugTriagePrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Bug Triage Guidelines
- Acknowledge the bug report
- Ask for reproduction steps if missing
- Request environment details if needed
- Indicate priority/severity assessment if appropriate
- Set expectations for investigation timeline
- Thank the reporter for helping improve the software`;

  const user = `Please help triage this bug report:

${formatContextForPrompt(context)}

Draft a response that:
1. Acknowledges the issue
2. Asks clarifying questions if needed (reproduction steps, environment, etc.)
3. Indicates next steps for investigation`;

  return { system, user };
}

/**
 * Build prompt for feature request response
 */
export function buildFeatureRequestPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Feature Request Response Guidelines
- Acknowledge the suggestion and thank the requester
- Indicate whether this aligns with project goals
- Ask for use cases if not clear
- Mention any related existing features or workarounds
- Set appropriate expectations about timeline and priority
- Be honest if the feature is unlikely to be implemented`;

  const user = `Please draft a response to this feature request:

${formatContextForPrompt(context)}

Draft a response that:
1. Thanks them for the suggestion
2. Asks clarifying questions about use cases if needed
3. Provides context about feasibility or timing if known
4. Suggests alternatives or workarounds if applicable`;

  return { system, user };
}

/**
 * Build prompt for closing an issue
 */
export function buildIssueClosePrompt(
  context: TaskContext,
  reason: 'resolved' | 'duplicate' | 'wont-fix' | 'stale',
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Issue Close Guidelines
- Be clear about why the issue is being closed
- Thank contributors for their input
- Provide links to relevant PRs, duplicates, or documentation
- Invite reopening if the issue persists (for resolved issues)
- Be respectful when declining to implement features`;

  const reasonInstructions: Record<string, string> = {
    resolved: 'This issue has been resolved. Link to the fix if available.',
    duplicate: 'This is a duplicate of another issue. Reference the original issue.',
    'wont-fix': 'This will not be fixed/implemented. Explain why respectfully.',
    stale: 'This issue has been inactive. Invite reopening if still relevant.',
  };

  const user = `Please draft a closing comment for this issue:

${formatContextForPrompt(context)}

Reason for closing: ${reason}
${reasonInstructions[reason]}

Draft a brief, courteous closing message.`;

  return { system, user };
}
