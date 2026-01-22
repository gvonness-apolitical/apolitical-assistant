/**
 * Task Helper - Review Mode
 *
 * Mode for reviewing code, documents, and proposals.
 */

import type { TaskContext, HelperResponse, StructuredOutput, ReviewPoint } from '../types.js';
import type { TemplateOptions } from '../prompts/templates.js';

// Import review prompts
import {
  buildCodeReviewPrompt,
  buildSecurityReviewPrompt,
  buildPerformanceReviewPrompt,
  buildArchitectureReviewPrompt,
} from '../prompts/review/code.js';
import {
  buildDocumentReviewPrompt,
  buildTechSpecReviewPrompt,
  buildProposalReviewPrompt,
  buildRFCReviewPrompt,
} from '../prompts/review/document.js';

/**
 * Review focus type
 */
export type ReviewFocus =
  | 'general'
  | 'security'
  | 'performance'
  | 'architecture'
  | 'document'
  | 'spec'
  | 'proposal'
  | 'rfc';

/**
 * Options for review mode
 */
export interface ReviewModeOptions extends TemplateOptions {
  focus?: ReviewFocus;
  strictness?: 'lenient' | 'standard' | 'strict';
}

/**
 * Get the appropriate prompt for review mode based on source and focus
 */
export function getReviewPrompt(
  context: TaskContext,
  options: ReviewModeOptions = {}
): { system: string; user: string } {
  const focus = options.focus ?? detectReviewFocus(context);

  switch (focus) {
    case 'security':
      return buildSecurityReviewPrompt(context, options);

    case 'performance':
      return buildPerformanceReviewPrompt(context, options);

    case 'architecture':
      return buildArchitectureReviewPrompt(context, options);

    case 'document':
      return buildDocumentReviewPrompt(context, options);

    case 'spec':
      return buildTechSpecReviewPrompt(context, options);

    case 'proposal':
      return buildProposalReviewPrompt(context, options);

    case 'rfc':
      return buildRFCReviewPrompt(context, options);

    case 'general':
    default:
      // Default to code review for GitHub PRs, document review for others
      if (context.todo.source === 'github' && context.sourceDetails.prNumber) {
        return buildCodeReviewPrompt(context, options);
      } else {
        return buildDocumentReviewPrompt(context, options);
      }
  }
}

/**
 * Detect the appropriate review focus based on context
 */
function detectReviewFocus(context: TaskContext): ReviewFocus {
  const title = context.sourceDetails.title.toLowerCase();
  const description = (context.sourceDetails.description ?? '').toLowerCase();

  // Check for security-related keywords
  if (
    title.includes('security') ||
    title.includes('auth') ||
    title.includes('vuln') ||
    description.includes('security') ||
    context.sourceDetails.labels?.some((l) => l.toLowerCase().includes('security'))
  ) {
    return 'security';
  }

  // Check for performance-related keywords
  if (
    title.includes('performance') ||
    title.includes('perf') ||
    title.includes('optimize') ||
    title.includes('speed') ||
    description.includes('performance')
  ) {
    return 'performance';
  }

  // Check for architecture-related keywords
  if (
    title.includes('architect') ||
    title.includes('refactor') ||
    title.includes('redesign') ||
    description.includes('architecture')
  ) {
    return 'architecture';
  }

  // Check for RFC
  if (title.includes('rfc') || description.includes('request for comment')) {
    return 'rfc';
  }

  // Check for proposal
  if (title.includes('proposal') || description.includes('proposed')) {
    return 'proposal';
  }

  // Check for spec/specification
  if (
    title.includes('spec') ||
    title.includes('specification') ||
    title.includes('design doc')
  ) {
    return 'spec';
  }

  // Default based on source
  if (context.todo.source === 'github' && context.sourceDetails.prNumber) {
    return 'general'; // Code review
  } else if (context.todo.source === 'notion') {
    return 'document';
  }

  return 'general';
}

/**
 * Execute review mode
 *
 * Note: This function builds the prompt and context for review generation.
 * The actual LLM call would be made by the CLI when this runs in Claude Code.
 */
export async function executeReviewMode(
  context: TaskContext,
  options: ReviewModeOptions = {}
): Promise<HelperResponse> {
  const prompt = getReviewPrompt(context, options);
  const focus = options.focus ?? detectReviewFocus(context);

  // Build the structured output placeholder
  const structured: StructuredOutput = {
    reviewPoints: undefined, // Will be filled by LLM
    reviewSummary: undefined,
    approvalRecommendation: undefined,
  };

  // Build the response
  const response: HelperResponse = {
    todoId: context.todo.id,
    mode: 'review',
    content: `## Review (${focus})\n\n*Review will be generated based on the following prompt:*\n\n**System:**\n${prompt.system}\n\n**User:**\n${prompt.user}`,
    structured,
    actions: [
      {
        type: 'display',
        description: 'Review prompt prepared',
        status: 'completed',
      },
    ],
    contextSummary: buildContextSummary(context, focus),
    generatedAt: new Date().toISOString(),
  };

  return response;
}

/**
 * Build a summary of the context used
 */
function buildContextSummary(context: TaskContext, focus: ReviewFocus): string {
  const parts: string[] = [];

  parts.push(`Focus: ${focus}`);
  parts.push(`Source: ${context.todo.source ?? 'unknown'}`);

  if (context.sourceDetails.changedFiles !== undefined) {
    parts.push(`Files: ${context.sourceDetails.changedFiles}`);
  }

  if (context.sourceDetails.additions !== undefined && context.sourceDetails.deletions !== undefined) {
    parts.push(`Changes: +${context.sourceDetails.additions}/-${context.sourceDetails.deletions}`);
  }

  return parts.join(' | ');
}

/**
 * Get recommended output type for review mode
 */
export function getRecommendedOutput(context: TaskContext): 'mcp' | 'clipboard' | 'display' {
  const source = context.todo.source;

  if (source === 'github' && context.sourceDetails.prNumber) {
    return 'mcp'; // Can post review directly
  }

  return 'display';
}

/**
 * Format review points for display
 */
export function formatReviewPoints(points: ReviewPoint[]): string {
  const groups: Record<string, ReviewPoint[]> = {
    blocker: [],
    concern: [],
    suggestion: [],
    question: [],
    praise: [],
  };

  for (const point of points) {
    groups[point.type]?.push(point);
  }

  const lines: string[] = [];

  if (groups.blocker.length > 0) {
    lines.push('### \u{1F6D1} Blockers');
    for (const p of groups.blocker) {
      lines.push(`- ${p.content}${p.file ? ` (${p.file}:${p.line ?? ''})` : ''}`);
    }
    lines.push('');
  }

  if (groups.concern.length > 0) {
    lines.push('### \u{26A0}\u{FE0F} Concerns');
    for (const p of groups.concern) {
      const severity = p.severity ? ` [${p.severity}]` : '';
      lines.push(`- ${p.content}${severity}${p.file ? ` (${p.file}:${p.line ?? ''})` : ''}`);
    }
    lines.push('');
  }

  if (groups.suggestion.length > 0) {
    lines.push('### \u{1F4A1} Suggestions');
    for (const p of groups.suggestion) {
      lines.push(`- ${p.content}${p.file ? ` (${p.file}:${p.line ?? ''})` : ''}`);
    }
    lines.push('');
  }

  if (groups.question.length > 0) {
    lines.push('### \u{2753} Questions');
    for (const p of groups.question) {
      lines.push(`- ${p.content}`);
    }
    lines.push('');
  }

  if (groups.praise.length > 0) {
    lines.push('### \u{1F44D} Positive');
    for (const p of groups.praise) {
      lines.push(`- ${p.content}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
