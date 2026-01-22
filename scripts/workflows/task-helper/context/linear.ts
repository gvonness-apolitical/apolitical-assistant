/**
 * Task Helper - Linear Context Gatherer
 *
 * Gathers context from Linear issues and projects.
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
 * Linear context result
 */
export interface LinearContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse Linear URL to extract issue identifier
 */
function parseLinearUrl(url: string): { identifier: string; issueId?: string } | null {
  // Match patterns like:
  // https://linear.app/workspace/issue/TEAM-123
  // https://linear.app/workspace/issue/TEAM-123/issue-title
  const match = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
  if (match) {
    return {
      identifier: match[1].toUpperCase(),
    };
  }

  return null;
}

/**
 * Gather context from Linear
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherLinearContext(
  todo: Todo,
  options: GatherOptions
): Promise<LinearContextResult> {
  const startTime = Date.now();

  // Parse the Linear URL
  const url = todo.sourceUrl;
  const parsed = url ? parseLinearUrl(url) : null;

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };

  // Extract identifier from URL or sourceId
  const identifier = parsed?.identifier ?? todo.sourceId;
  if (identifier) {
    sourceDetails.metadata = {
      ...sourceDetails.metadata,
      identifier,
    };
  }

  // Extract labels from tags if available
  if (todo.tags && todo.tags.length > 0) {
    sourceDetails.labels = todo.tags;
  }

  // Build thread from description
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: sourceDetails.author ?? sourceDetails.assignee ?? 'unknown',
      content: todo.description,
      date: todo.createdAt,
      type: 'comment',
    });
  }

  // Related items would be populated via MCP calls
  const relatedItems: RelatedItem[] = [];

  // People context would be populated via MCP calls
  const people: PersonContext[] = [];

  return {
    sourceDetails,
    thread: options.includeThread ? thread : undefined,
    relatedItems: options.includeRelated ? relatedItems : undefined,
    people: options.includePeople ? people : undefined,
    status: {
      source: 'linear',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get project context for a Linear issue
 */
export function getProjectContext(sourceDetails: SourceDetails): {
  hasProject: boolean;
  projectName: string | undefined;
  teamName: string | undefined;
  cycleName: string | undefined;
  estimate: number | undefined;
} {
  return {
    hasProject: sourceDetails.projectName !== undefined,
    projectName: sourceDetails.projectName,
    teamName: sourceDetails.teamName,
    cycleName: sourceDetails.cycleName,
    estimate: sourceDetails.estimate,
  };
}

/**
 * Format Linear context for prompt
 */
export function formatLinearContextForPrompt(result: LinearContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Linear Context');
  lines.push('');

  // Basic info
  const identifier = (sourceDetails.metadata as { identifier?: string })?.identifier;
  if (identifier) {
    lines.push(`**Issue:** ${identifier}`);
  }
  lines.push(`**Title:** ${sourceDetails.title}`);

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  if (sourceDetails.status) {
    lines.push(`**Status:** ${sourceDetails.status}`);
  }

  if (sourceDetails.assignee) {
    lines.push(`**Assignee:** ${sourceDetails.assignee}`);
  }

  if (sourceDetails.projectName) {
    lines.push(`**Project:** ${sourceDetails.projectName}`);
  }

  if (sourceDetails.teamName) {
    lines.push(`**Team:** ${sourceDetails.teamName}`);
  }

  if (sourceDetails.cycleName) {
    lines.push(`**Cycle:** ${sourceDetails.cycleName}`);
  }

  if (sourceDetails.estimate !== undefined) {
    lines.push(`**Estimate:** ${sourceDetails.estimate} points`);
  }

  if (sourceDetails.labels && sourceDetails.labels.length > 0) {
    lines.push(`**Labels:** ${sourceDetails.labels.join(', ')}`);
  }

  // Description
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Description');
    lines.push(sourceDetails.description);
  }

  // Thread
  if (thread && thread.length > 0) {
    lines.push('');
    lines.push('### Comments');
    for (const item of thread) {
      lines.push(`**${item.author}** (${item.date}):`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Issues');
    for (const item of relatedItems) {
      lines.push(`- [${item.type}] ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  // People
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### People');
    for (const person of people) {
      lines.push(`- **${person.name}**${person.role ? ` (${person.role})` : ''}`);
    }
  }

  return lines.join('\n');
}
