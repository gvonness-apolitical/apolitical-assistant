/**
 * Task Helper - Prompt Templates Base
 *
 * Base utilities for building LLM prompts.
 */

import type { TaskContext, HelperMode } from '../types.js';
import { loadConfig } from '../config.js';

/**
 * Prompt template result
 */
export interface PromptTemplate {
  system: string;
  user: string;
}

/**
 * Template options
 */
export interface TemplateOptions {
  tone?: 'professional' | 'casual' | 'technical';
  includeSignature?: boolean;
  customInstructions?: string;
}

/**
 * Get the default tone from config
 */
export function getDefaultTone(): 'professional' | 'casual' | 'technical' {
  const config = loadConfig();
  return config.prompts.tone;
}

/**
 * Get tone-specific instructions
 */
export function getToneInstructions(tone: 'professional' | 'casual' | 'technical'): string {
  switch (tone) {
    case 'professional':
      return `
Write in a professional, clear, and concise manner. Use formal language appropriate for business communication.
Avoid jargon unless necessary, and explain technical terms when used.
Be direct but courteous. Focus on actionable information.`;

    case 'casual':
      return `
Write in a friendly, approachable tone while remaining respectful and clear.
It's okay to use contractions and conversational language.
Keep things concise but personable.`;

    case 'technical':
      return `
Write in a precise, technical manner. Use appropriate technical terminology.
Be thorough in technical explanations. Include relevant code, commands, or specifications where helpful.
Prioritize accuracy and completeness over brevity.`;
  }
}

/**
 * Format context for inclusion in prompt
 */
export function formatContextForPrompt(context: TaskContext): string {
  const sections: string[] = [];

  // Source details
  sections.push('## Task Details');
  sections.push(`**Title:** ${context.sourceDetails.title}`);

  if (context.sourceDetails.url) {
    sections.push(`**URL:** ${context.sourceDetails.url}`);
  }

  if (context.sourceDetails.status) {
    sections.push(`**Status:** ${context.sourceDetails.status}`);
  }

  if (context.sourceDetails.author) {
    sections.push(`**Author:** ${context.sourceDetails.author}`);
  }

  if (context.sourceDetails.assignee) {
    sections.push(`**Assignee:** ${context.sourceDetails.assignee}`);
  }

  if (context.sourceDetails.labels && context.sourceDetails.labels.length > 0) {
    sections.push(`**Labels:** ${context.sourceDetails.labels.join(', ')}`);
  }

  // Description
  if (context.sourceDetails.description) {
    sections.push('');
    sections.push('## Description');
    sections.push(context.sourceDetails.description);
  }

  // Thread
  if (context.thread && context.thread.length > 0) {
    sections.push('');
    sections.push('## Conversation Thread');
    for (const item of context.thread) {
      sections.push(`**${item.author}** (${item.date}):`);
      sections.push(item.content);
      sections.push('');
    }
  }

  // Related items
  if (context.relatedItems && context.relatedItems.length > 0) {
    sections.push('');
    sections.push('## Related Items');
    for (const item of context.relatedItems) {
      sections.push(`- [${item.type}] ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  // People
  if (context.people && context.people.length > 0) {
    sections.push('');
    sections.push('## People Involved');
    for (const person of context.people) {
      let line = `- **${person.name}**`;
      if (person.role) line += ` (${person.role})`;
      if (person.department) line += ` - ${person.department}`;
      if (person.isOutOfOffice) line += ' [Out of Office]';
      sections.push(line);
    }
  }

  // Wider context
  if (context.widerContext) {
    const { relatedPRs, relatedIssues, relatedDocs, slackDiscussions, recentSummaries } =
      context.widerContext;

    if (relatedPRs && relatedPRs.length > 0) {
      sections.push('');
      sections.push('## Related PRs');
      for (const item of relatedPRs) {
        sections.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      }
    }

    if (relatedIssues && relatedIssues.length > 0) {
      sections.push('');
      sections.push('## Related Issues');
      for (const item of relatedIssues) {
        sections.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      }
    }

    if (relatedDocs && relatedDocs.length > 0) {
      sections.push('');
      sections.push('## Related Documentation');
      for (const item of relatedDocs) {
        sections.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      }
    }

    if (slackDiscussions && slackDiscussions.length > 0) {
      sections.push('');
      sections.push('## Related Slack Discussions');
      for (const item of slackDiscussions) {
        sections.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      }
    }

    if (recentSummaries && recentSummaries.length > 0) {
      sections.push('');
      sections.push('## From Recent Summaries');
      for (const summary of recentSummaries) {
        sections.push(`- ${summary}`);
      }
    }
  }

  return sections.join('\n');
}

/**
 * Build the base system prompt for a mode
 */
export function buildBaseSystemPrompt(mode: HelperMode, options: TemplateOptions = {}): string {
  const tone = options.tone ?? getDefaultTone();
  const toneInstructions = getToneInstructions(tone);

  const modeDescriptions: Record<HelperMode, string> = {
    respond:
      'You are helping draft a response to a task or communication. Your goal is to create a clear, appropriate reply.',
    review:
      'You are helping review content (code, document, proposal). Your goal is to provide constructive, actionable feedback.',
    summarize:
      'You are helping summarize and extract insights from context. Your goal is to create a clear, concise summary with key points.',
    schedule:
      'You are helping schedule meetings or coordinate times. Your goal is to suggest appropriate times and draft meeting invites.',
    research:
      'You are helping research and gather information. Your goal is to answer questions and provide relevant context.',
    complete:
      'You are helping complete or close a task. Your goal is to identify remaining steps and help mark the task as done.',
    delegate:
      'You are helping delegate a task. Your goal is to draft a clear delegation message with all necessary context.',
    custom:
      'You are helping with a custom task. Follow the specific instructions provided.',
  };

  return `You are an executive assistant helping with task management.

${modeDescriptions[mode]}

## Tone and Style
${toneInstructions}

## Guidelines
- Be concise and actionable
- Focus on the specific task at hand
- Use the context provided to inform your response
- If information is missing, note what would be helpful
${options.customInstructions ? `\n## Custom Instructions\n${options.customInstructions}` : ''}`;
}

/**
 * Get signature if configured
 */
export function getSignature(): string | undefined {
  const config = loadConfig();
  if (config.prompts.includeSignature && config.prompts.signature) {
    return config.prompts.signature;
  }
  return undefined;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extract key points from text
 */
export function extractKeyPoints(text: string, maxPoints: number = 5): string[] {
  // Split by common separators and filter
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !l.startsWith('#'));

  // Return first N meaningful lines
  return lines.slice(0, maxPoints);
}
