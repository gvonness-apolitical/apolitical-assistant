/**
 * Task Helper - Slack Response Prompts
 *
 * Prompts for responding to Slack messages.
 */

import type { TaskContext } from '../../types.js';
import type { PromptTemplate, TemplateOptions } from '../templates.js';
import { buildBaseSystemPrompt, formatContextForPrompt } from '../templates.js';

/**
 * Build prompt for Slack message response
 */
export function buildSlackResponsePrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Slack Message Guidelines
- Keep messages concise - Slack is for quick communication
- Use appropriate formatting (bold, bullet points, code blocks)
- Use emoji reactions where appropriate instead of full replies
- Thread replies to keep channels organized
- Tag people only when necessary
- Be friendly but efficient`;

  const user = `Please draft a Slack response:

${formatContextForPrompt(context)}

${context.sourceDetails.channel ? `Channel: #${context.sourceDetails.channel}` : ''}
${context.sourceDetails.threadTs ? 'This is a thread reply' : 'This is a channel message'}

Draft an appropriate Slack response. Keep it concise and conversational.`;

  return { system, user };
}

/**
 * Build prompt for Slack thread summary
 */
export function buildSlackThreadSummaryPrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('summarize', options)}

## Slack Thread Summary Guidelines
- Summarize the key points and decisions
- Note any action items or follow-ups
- Keep it brief - bullet points work well
- Identify who is responsible for what
- Highlight any unresolved questions`;

  const user = `Please summarize this Slack thread:

${formatContextForPrompt(context)}

Create a brief summary that captures:
1. Main topic/question
2. Key points discussed
3. Decisions made
4. Action items (with owners if clear)
5. Unresolved items`;

  return { system, user };
}

/**
 * Build prompt for Slack announcement
 */
export function buildSlackAnnouncementPrompt(
  context: TaskContext,
  topic: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Slack Announcement Guidelines
- Start with a clear headline or TL;DR
- Use formatting to make it scannable
- Include all necessary details
- End with clear next steps or call to action
- Use appropriate emoji to catch attention
- Keep it as concise as possible while being complete`;

  const user = `Please draft a Slack announcement:

Topic: ${topic}

Context:
${formatContextForPrompt(context)}

Draft an announcement that:
1. Has a clear headline
2. Explains the key information
3. Includes relevant links or resources
4. Has clear next steps`;

  return { system, user };
}

/**
 * Build prompt for Slack status update
 */
export function buildSlackStatusUpdatePrompt(
  context: TaskContext,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Status Update Guidelines
- Lead with the most important information
- Use a consistent format (progress, blockers, next steps)
- Be specific about progress and blockers
- Include links to relevant items
- Keep it brief but informative`;

  const user = `Please draft a status update message:

${formatContextForPrompt(context)}

Draft a status update that includes:
1. Current progress/status
2. Key accomplishments
3. Any blockers or concerns
4. Next steps`;

  return { system, user };
}

/**
 * Build prompt for asking a question in Slack
 */
export function buildSlackQuestionPrompt(
  context: TaskContext,
  question: string,
  options: TemplateOptions = {}
): PromptTemplate {
  const system = `${buildBaseSystemPrompt('respond', options)}

## Slack Question Guidelines
- Be specific about what you're asking
- Provide necessary context upfront
- Show what you've already tried or researched
- Make it easy for people to help
- Tag relevant people if appropriate`;

  const user = `Please draft a question for Slack:

Question: ${question}

Context:
${formatContextForPrompt(context)}

Draft a well-formed question that:
1. Provides enough context
2. Is specific about what you need
3. Makes it easy for someone to help`;

  return { system, user };
}
