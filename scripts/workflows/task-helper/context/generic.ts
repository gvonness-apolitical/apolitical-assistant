/**
 * Task Helper - Generic Context Gatherer
 *
 * Fallback gatherer for unknown or unsupported sources.
 */

import type { Todo } from '@apolitical-assistant/shared';
import type {
  GatherOptions,
  GatheringStatus,
  SourceDetails,
  ThreadItem,
  RelatedItem,
  PersonContext,
} from '../types.js';

/**
 * Generic context result
 */
export interface GenericContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Gather context from a generic/unknown source
 *
 * This is the fallback gatherer when no specific gatherer exists for a source.
 * It extracts what it can from the TODO itself.
 */
export async function gatherGenericContext(
  todo: Todo,
  options: GatherOptions
): Promise<GenericContextResult> {
  const startTime = Date.now();

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    metadata: {
      source: todo.source,
      sourceId: todo.sourceId,
    },
  };

  // Extract labels from tags if available
  if (todo.tags && todo.tags.length > 0) {
    sourceDetails.labels = todo.tags;
  }

  // Build thread from description
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: 'unknown',
      content: todo.description,
      date: todo.createdAt,
      type: 'note',
    });
  }

  // No related items for generic source
  const relatedItems: RelatedItem[] = [];

  // No people context for generic source
  const people: PersonContext[] = [];

  return {
    sourceDetails,
    thread: options.includeThread ? thread : undefined,
    relatedItems: options.includeRelated ? relatedItems : undefined,
    people: options.includePeople ? people : undefined,
    status: {
      source: todo.source ?? 'unknown',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Format generic context for prompt
 */
export function formatGenericContextForPrompt(result: GenericContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Task Context');
  lines.push('');

  // Basic info
  lines.push(`**Title:** ${sourceDetails.title}`);

  const metadata = sourceDetails.metadata as { source?: string; sourceId?: string } | undefined;
  if (metadata?.source) {
    lines.push(`**Source:** ${metadata.source}`);
  }

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  if (sourceDetails.status) {
    lines.push(`**Status:** ${sourceDetails.status}`);
  }

  if (sourceDetails.labels && sourceDetails.labels.length > 0) {
    lines.push(`**Tags:** ${sourceDetails.labels.join(', ')}`);
  }

  if (sourceDetails.createdAt) {
    lines.push(`**Created:** ${sourceDetails.createdAt}`);
  }

  if (sourceDetails.updatedAt) {
    lines.push(`**Updated:** ${sourceDetails.updatedAt}`);
  }

  // Description
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Description');
    lines.push(sourceDetails.description);
  }

  // Thread
  if (thread && thread.length > 1) {
    lines.push('');
    lines.push('### Notes');
    for (const item of thread.slice(1)) {
      lines.push(`**${item.author}** (${item.date}):`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Items');
    for (const item of relatedItems) {
      lines.push(`- [${item.type}] ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  // People
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### People');
    for (const person of people) {
      let line = `- **${person.name}**`;
      if (person.role) {
        line += ` (${person.role})`;
      }
      lines.push(line);
    }
  }

  return lines.join('\n');
}

/**
 * Extract potential people from text content
 */
export function extractPotentialPeople(text: string): string[] {
  const people: string[] = [];

  // Extract email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  people.push(...emails);

  // Extract @mentions
  const mentionRegex = /@([A-Za-z0-9_-]+)/g;
  const mentions = text.match(mentionRegex) || [];
  people.push(...mentions.map((m) => m.substring(1)));

  return [...new Set(people)];
}

/**
 * Extract potential URLs from text content
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const urls = text.match(urlRegex) || [];
  return [...new Set(urls)];
}
