/**
 * Task Helper - Email Response Prompts
 *
 * Prompts for responding to emails.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt, getSignature } from '../templates.js';

/**
 * Build prompt for email reply
 */
export function buildEmailReplyPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Email Reply Guidelines
- Address all questions or points raised in the original email
- Be clear and concise
- Use appropriate greetings and closings based on the relationship
- Include necessary context for those CC'd who may not have full background
- End with clear next steps or a call to action if appropriate
- Maintain the appropriate level of formality for the audience`;

  const signature = getSignature();
  const user = `Please draft a reply to this email:

${formatContextForPrompt(context)}

${context.sourceDetails.from ? `From: ${context.sourceDetails.from}` : ''}
${context.sourceDetails.to ? `To: ${context.sourceDetails.to.join(', ')}` : ''}
${context.sourceDetails.cc ? `Cc: ${context.sourceDetails.cc.join(', ')}` : ''}
${context.sourceDetails.subject ? `Subject: ${context.sourceDetails.subject}` : ''}

Draft an appropriate reply that addresses all points raised.
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for meeting request email
 */
export function buildMeetingRequestEmailPrompt(
  context: TaskContext,
  purpose: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Meeting Request Email Guidelines
- Clearly state the purpose of the meeting
- Suggest specific times or ask for availability
- Include expected duration
- List who should attend and why
- Provide any preparation needed
- Keep it concise - details can be discussed in the meeting`;

  const signature = getSignature();
  const user = `Please draft a meeting request email:

Context:
${formatContextForPrompt(context)}

Meeting purpose: ${purpose}

${context.people && context.people.length > 0 ? `Potential attendees:\n${context.people.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`).join('\n')}` : ''}

Draft an email that:
1. Explains why we need to meet
2. Suggests times or asks for availability
3. Lists the agenda or topics to cover
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for follow-up email
 */
export function buildFollowUpEmailPrompt(
  context: TaskContext,
  daysSinceOriginal: number,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Follow-Up Email Guidelines
- Reference the original email/conversation
- Be polite and not pushy
- Provide a brief summary of what you're following up on
- Make it easy for them to respond (specific questions, simple asks)
- Acknowledge they may be busy
- Include a clear call to action`;

  const signature = getSignature();
  const urgencyNote =
    daysSinceOriginal > 7
      ? 'This follow-up is after a week or more, so be understanding but clear about the need for a response.'
      : 'This is a recent follow-up, so keep it light and friendly.';

  const user = `Please draft a follow-up email:

${formatContextForPrompt(context)}

Days since original: ${daysSinceOriginal}
${urgencyNote}

Draft a polite follow-up that:
1. References the original conversation
2. Reminds them what you need
3. Makes it easy to respond
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}

/**
 * Build prompt for delegation email
 */
export function buildDelegationEmailPrompt(
  context: TaskContext,
  delegateTo: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('delegate', options)}

## Delegation Email Guidelines
- Clearly explain what task is being delegated
- Provide all necessary context and background
- Include relevant links, documents, or references
- Set clear expectations for timeline and deliverables
- Offer to answer questions or provide support
- Express confidence in their ability to handle it`;

  const signature = getSignature();
  const user = `Please draft a delegation email:

Task to delegate:
${formatContextForPrompt(context)}

Delegating to: ${delegateTo}

Draft an email that:
1. Clearly explains the task and its importance
2. Provides all necessary context
3. Sets expectations for completion
4. Offers support
${signature ? `\nInclude this signature at the end:\n${signature}` : ''}`;

  return { system, user };
}
