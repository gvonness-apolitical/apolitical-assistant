/**
 * Task Helper - Summarize Mode
 *
 * Mode for summarizing content and extracting insights.
 */

import type { TaskContext, HelperResponse, StructuredOutput } from '../types.js';
import type { TemplateOptions } from '../prompts/templates.js';
import { formatContextForPrompt } from '../prompts/templates.js';

// Import summarize prompts
import {
  buildTechnicalSummaryPrompt,
  buildPRSummaryPrompt,
  buildIncidentSummaryPrompt,
  buildDiscussionSummaryPrompt,
} from '../prompts/summarize/technical.js';
import {
  buildExecutiveSummaryPrompt,
  buildProjectStatusSummaryPrompt,
  buildMeetingSummaryPrompt,
  buildEmailThreadSummaryPrompt,
} from '../prompts/summarize/business.js';

/**
 * Summary type
 */
export type SummaryType =
  | 'general'
  | 'technical'
  | 'executive'
  | 'pr'
  | 'incident'
  | 'discussion'
  | 'project'
  | 'meeting'
  | 'email';

/**
 * Options for summarize mode
 */
export interface SummarizeModeOptions extends TemplateOptions {
  summaryType?: SummaryType;
  maxLength?: 'brief' | 'standard' | 'detailed';
  audience?: string;
}

/**
 * Get the appropriate prompt for summarize mode based on source and type
 */
export function getSummarizePrompt(
  context: TaskContext,
  options: SummarizeModeOptions = {}
): { system: string; user: string } {
  const summaryType = options.summaryType ?? detectSummaryType(context);

  switch (summaryType) {
    case 'technical':
      return buildTechnicalSummaryPrompt(context, options);

    case 'executive':
      return buildExecutiveSummaryPrompt(context, options);

    case 'pr':
      return buildPRSummaryPrompt(context, options);

    case 'incident':
      return buildIncidentSummaryPrompt(context, options);

    case 'discussion':
      return buildDiscussionSummaryPrompt(context, options);

    case 'project':
      return buildProjectStatusSummaryPrompt(context, options);

    case 'meeting':
      return buildMeetingSummaryPrompt(context, options);

    case 'email':
      return buildEmailThreadSummaryPrompt(context, options);

    case 'general':
    default:
      return buildGeneralSummaryPrompt(context, options);
  }
}

/**
 * Detect the appropriate summary type based on context
 */
function detectSummaryType(context: TaskContext): SummaryType {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      if (context.sourceDetails.prNumber) {
        return 'pr';
      }
      return 'technical';

    case 'linear':
      if (context.sourceDetails.projectName) {
        return 'project';
      }
      return 'technical';

    case 'incident-io':
      return 'incident';

    case 'meeting-prep':
    case 'calendar':
      return 'meeting';

    case 'email':
      if (context.thread && context.thread.length > 2) {
        return 'email';
      }
      return 'general';

    case 'slack':
      if (context.thread && context.thread.length > 3) {
        return 'discussion';
      }
      return 'general';

    case 'notion':
      return 'general';

    default:
      return 'general';
  }
}

/**
 * Build a general summary prompt
 */
function buildGeneralSummaryPrompt(
  context: TaskContext,
  options: SummarizeModeOptions = {}
): { system: string; user: string } {
  const lengthInstruction =
    options.maxLength === 'brief'
      ? 'Keep the summary very brief (2-3 sentences).'
      : options.maxLength === 'detailed'
        ? 'Provide a comprehensive summary with all relevant details.'
        : 'Provide a concise but complete summary.';

  const system = `You are an executive assistant helping summarize content and extract key insights.

## Summary Guidelines
- Focus on the most important information
- Organize information logically
- Highlight key decisions, action items, and concerns
- ${lengthInstruction}

## Summary Format
1. **Overview**: Brief summary in 1-2 sentences
2. **Key Points**: Main items to note
3. **Action Items**: Tasks or follow-ups (if any)
4. **Open Questions**: Unresolved items (if any)`;

  const user = `Please summarize this content:

${formatContextForPrompt(context)}

Create a clear, organized summary highlighting the most important information.`;

  return { system, user };
}

/**
 * Execute summarize mode
 *
 * Note: This function builds the prompt and context for summary generation.
 * The actual LLM call would be made by the CLI when this runs in Claude Code.
 */
export async function executeSummarizeMode(
  context: TaskContext,
  options: SummarizeModeOptions = {}
): Promise<HelperResponse> {
  const prompt = getSummarizePrompt(context, options);
  const summaryType = options.summaryType ?? detectSummaryType(context);

  // Build the structured output placeholder
  const structured: StructuredOutput = {
    summary: undefined, // Will be filled by LLM
    keyInsights: undefined,
    openQuestions: undefined,
  };

  // Build the response
  const response: HelperResponse = {
    todoId: context.todo.id,
    mode: 'summarize',
    content: `## Summary (${summaryType})\n\n*Summary will be generated based on the following prompt:*\n\n**System:**\n${prompt.system}\n\n**User:**\n${prompt.user}`,
    structured,
    actions: [
      {
        type: 'display',
        description: 'Summary prompt prepared',
        status: 'completed',
      },
    ],
    contextSummary: buildContextSummary(context, summaryType),
    generatedAt: new Date().toISOString(),
  };

  return response;
}

/**
 * Build a summary of the context used
 */
function buildContextSummary(context: TaskContext, summaryType: SummaryType): string {
  const parts: string[] = [];

  parts.push(`Type: ${summaryType}`);
  parts.push(`Source: ${context.todo.source ?? 'unknown'}`);

  if (context.thread && context.thread.length > 0) {
    parts.push(`Thread: ${context.thread.length} messages`);
  }

  if (context.relatedItems && context.relatedItems.length > 0) {
    parts.push(`Related: ${context.relatedItems.length} items`);
  }

  return parts.join(' | ');
}

/**
 * Get recommended output type for summarize mode
 */
export function getRecommendedOutput(): 'mcp' | 'clipboard' | 'display' {
  return 'display'; // Summaries are typically for viewing
}

/**
 * Format summary output for display
 */
export function formatSummary(output: StructuredOutput): string {
  const lines: string[] = [];

  if (output.summary) {
    lines.push('## Summary');
    lines.push(output.summary);
    lines.push('');
  }

  if (output.keyInsights && output.keyInsights.length > 0) {
    lines.push('## Key Insights');
    for (const insight of output.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  if (output.openQuestions && output.openQuestions.length > 0) {
    lines.push('## Open Questions');
    for (const question of output.openQuestions) {
      lines.push(`- ${question}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
