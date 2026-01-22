/**
 * Task Helper - Respond Mode
 *
 * Mode for drafting responses to tasks.
 */

import type { TaskContext, HelperResponse, StructuredOutput } from '../types.js';
import type { TemplateOptions } from '../prompts/templates.js';
import { formatContextForPrompt } from '../prompts/templates.js';

// Import response prompts
import { buildPRCommentPrompt } from '../prompts/respond/github-pr.js';
import { buildIssueResponsePrompt } from '../prompts/respond/github-issue.js';
import { buildEmailReplyPrompt } from '../prompts/respond/email.js';
import { buildSlackResponsePrompt } from '../prompts/respond/slack.js';
import { buildLinearCommentPrompt } from '../prompts/respond/linear.js';

/**
 * Options for respond mode
 */
export interface RespondModeOptions extends TemplateOptions {
  responseType?: 'reply' | 'forward' | 'new';
  urgency?: 'high' | 'normal' | 'low';
}

/**
 * Get the appropriate prompt for respond mode based on source
 */
export function getRespondPrompt(
  context: TaskContext,
  options: RespondModeOptions = {}
): { system: string; user: string } {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      // Check if it's a PR or issue
      if (context.sourceDetails.prNumber) {
        return buildPRCommentPrompt(context, options);
      } else {
        return buildIssueResponsePrompt(context, options);
      }

    case 'email':
      return buildEmailReplyPrompt(context, options);

    case 'slack':
      return buildSlackResponsePrompt(context, options);

    case 'linear':
      return buildLinearCommentPrompt(context, options);

    default:
      // Generic response prompt
      return buildGenericRespondPrompt(context, options);
  }
}

/**
 * Build a generic response prompt for unknown sources
 */
function buildGenericRespondPrompt(
  context: TaskContext,
  options: RespondModeOptions = {}
): { system: string; user: string } {
  const system = `You are an executive assistant helping draft responses to tasks and communications.

## Response Guidelines
- Be clear and concise
- Address all points raised
- Use appropriate tone for the context
- Include clear next steps if applicable
${options.tone === 'professional' ? '- Maintain a professional tone throughout' : ''}
${options.tone === 'casual' ? '- Keep it friendly and approachable' : ''}
${options.tone === 'technical' ? '- Use precise technical language' : ''}`;

  const user = `Please draft a response for this task:

${formatContextForPrompt(context)}

Draft an appropriate response that addresses the task.`;

  return { system, user };
}

/**
 * Execute respond mode
 *
 * Note: This function builds the prompt and context for response generation.
 * The actual LLM call would be made by the CLI when this runs in Claude Code.
 */
export async function executeRespondMode(
  context: TaskContext,
  options: RespondModeOptions = {}
): Promise<HelperResponse> {
  const prompt = getRespondPrompt(context, options);

  // Build the structured output placeholder
  const structured: StructuredOutput = {
    draftResponse: undefined, // Will be filled by LLM
  };

  // Build the response
  const response: HelperResponse = {
    todoId: context.todo.id,
    mode: 'respond',
    content: `## Response Draft\n\n*Response will be generated based on the following prompt:*\n\n**System:**\n${prompt.system}\n\n**User:**\n${prompt.user}`,
    structured,
    actions: [
      {
        type: 'display',
        description: 'Response prompt prepared',
        status: 'completed',
      },
    ],
    contextSummary: buildContextSummary(context),
    generatedAt: new Date().toISOString(),
  };

  return response;
}

/**
 * Build a summary of the context used
 */
function buildContextSummary(context: TaskContext): string {
  const parts: string[] = [];

  parts.push(`Source: ${context.todo.source ?? 'unknown'}`);

  if (context.thread && context.thread.length > 0) {
    parts.push(`Thread: ${context.thread.length} messages`);
  }

  if (context.people && context.people.length > 0) {
    parts.push(`People: ${context.people.map((p) => p.name).join(', ')}`);
  }

  if (context.relatedItems && context.relatedItems.length > 0) {
    parts.push(`Related: ${context.relatedItems.length} items`);
  }

  return parts.join(' | ');
}

/**
 * Get recommended output type for respond mode
 */
export function getRecommendedOutput(context: TaskContext): 'mcp' | 'clipboard' | 'display' {
  const source = context.todo.source;

  switch (source) {
    case 'github':
    case 'linear':
    case 'notion':
      return 'mcp'; // These support direct writes

    case 'email':
    case 'slack':
      return 'clipboard'; // Copy for manual posting

    default:
      return 'display';
  }
}

/**
 * Get the target description for MCP write
 */
export function getMcpWriteTarget(context: TaskContext): string | undefined {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      if (context.sourceDetails.prNumber) {
        return `GitHub PR #${context.sourceDetails.prNumber}`;
      } else if (context.sourceDetails.issueNumber) {
        return `GitHub Issue #${context.sourceDetails.issueNumber}`;
      }
      break;

    case 'linear':
      return `Linear Issue ${context.todo.sourceId ?? context.todo.title}`;

    case 'notion':
      return `Notion Page Comment`;
  }

  return undefined;
}
