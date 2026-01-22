/**
 * Task Helper - GitHub Context Gatherer
 *
 * Gathers context from GitHub PRs and issues.
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
 * GitHub PR/Issue context result
 */
export interface GitHubContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse GitHub URL to extract owner, repo, and number
 */
function parseGitHubUrl(url: string): { owner: string; repo: string; number: number; type: 'pr' | 'issue' } | null {
  // Match patterns like:
  // https://github.com/owner/repo/pull/123
  // https://github.com/owner/repo/issues/123
  const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (prMatch) {
    return {
      owner: prMatch[1],
      repo: prMatch[2],
      number: parseInt(prMatch[3], 10),
      type: 'pr',
    };
  }

  const issueMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (issueMatch) {
    return {
      owner: issueMatch[1],
      repo: issueMatch[2],
      number: parseInt(issueMatch[3], 10),
      type: 'issue',
    };
  }

  return null;
}

/**
 * Gather context from GitHub
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherGitHubContext(
  todo: Todo,
  options: GatherOptions
): Promise<GitHubContextResult> {
  const startTime = Date.now();

  // Parse the GitHub URL
  const url = todo.sourceUrl;
  const parsed = url ? parseGitHubUrl(url) : null;

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };

  // If we have a parsed URL, add GitHub-specific details
  if (parsed) {
    sourceDetails.repo = `${parsed.owner}/${parsed.repo}`;
    if (parsed.type === 'pr') {
      sourceDetails.prNumber = parsed.number;
    } else {
      sourceDetails.issueNumber = parsed.number;
    }
  }

  // Extract labels from tags if available
  if (todo.tags && todo.tags.length > 0) {
    sourceDetails.labels = todo.tags;
  }

  // Build thread from description
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: sourceDetails.author ?? 'unknown',
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
      source: 'github',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get review-specific context for a PR
 */
export function getReviewContext(sourceDetails: SourceDetails): {
  isPR: boolean;
  hasChanges: boolean;
  ciStatus: string;
  changedFilesCount: number;
  additions: number;
  deletions: number;
} {
  return {
    isPR: sourceDetails.prNumber !== undefined,
    hasChanges: (sourceDetails.changedFiles ?? 0) > 0,
    ciStatus: sourceDetails.ciStatus ?? 'unknown',
    changedFilesCount: sourceDetails.changedFiles ?? 0,
    additions: sourceDetails.additions ?? 0,
    deletions: sourceDetails.deletions ?? 0,
  };
}

/**
 * Format GitHub context for prompt
 */
export function formatGitHubContextForPrompt(result: GitHubContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## GitHub Context');
  lines.push('');

  // Basic info
  if (sourceDetails.repo) {
    lines.push(`**Repository:** ${sourceDetails.repo}`);
  }
  if (sourceDetails.prNumber) {
    lines.push(`**PR #${sourceDetails.prNumber}:** ${sourceDetails.title}`);
  } else if (sourceDetails.issueNumber) {
    lines.push(`**Issue #${sourceDetails.issueNumber}:** ${sourceDetails.title}`);
  } else {
    lines.push(`**Title:** ${sourceDetails.title}`);
  }

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  if (sourceDetails.status) {
    lines.push(`**Status:** ${sourceDetails.status}`);
  }

  if (sourceDetails.ciStatus) {
    lines.push(`**CI Status:** ${sourceDetails.ciStatus}`);
  }

  if (sourceDetails.labels && sourceDetails.labels.length > 0) {
    lines.push(`**Labels:** ${sourceDetails.labels.join(', ')}`);
  }

  if (sourceDetails.changedFiles !== undefined) {
    lines.push(`**Changed Files:** ${sourceDetails.changedFiles} (+${sourceDetails.additions ?? 0}/-${sourceDetails.deletions ?? 0})`);
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
      lines.push(`- **${person.name}**${person.role ? ` (${person.role})` : ''}`);
    }
  }

  return lines.join('\n');
}
