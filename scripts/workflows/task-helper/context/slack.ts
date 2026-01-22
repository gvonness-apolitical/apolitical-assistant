/**
 * Task Helper - Slack Context Gatherer
 *
 * Gathers context from Slack messages and threads.
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
 * Slack context result
 */
export interface SlackContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse Slack URL to extract channel and thread info
 */
function parseSlackUrl(url: string): { channel?: string; channelId?: string; threadTs?: string } | null {
  // Match patterns like:
  // https://workspace.slack.com/archives/C12345678/p1234567890123456
  // https://workspace.slack.com/archives/C12345678/p1234567890123456?thread_ts=1234567890.123456
  const archiveMatch = url.match(/slack\.com\/archives\/([A-Z0-9]+)\/p(\d+)/i);
  if (archiveMatch) {
    const result: ReturnType<typeof parseSlackUrl> = {
      channelId: archiveMatch[1],
    };

    // Check for thread_ts in URL
    const threadMatch = url.match(/thread_ts=(\d+\.\d+)/);
    if (threadMatch) {
      result.threadTs = threadMatch[1];
    }

    return result;
  }

  return null;
}

/**
 * Gather context from Slack
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherSlackContext(
  todo: Todo,
  options: GatherOptions
): Promise<SlackContextResult> {
  const startTime = Date.now();

  // Parse Slack URL
  const url = todo.sourceUrl;
  const parsed = url ? parseSlackUrl(url) : null;

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    channel: parsed?.channel,
    channelId: parsed?.channelId,
    threadTs: parsed?.threadTs,
  };

  // Build thread from description
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: sourceDetails.author ?? 'unknown',
      content: todo.description,
      date: todo.createdAt,
      type: 'message',
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
      source: 'slack',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get thread context for Slack message
 */
export function getThreadContext(sourceDetails: SourceDetails): {
  isThread: boolean;
  channel: string | undefined;
  channelId: string | undefined;
  threadTs: string | undefined;
} {
  return {
    isThread: sourceDetails.threadTs !== undefined,
    channel: sourceDetails.channel,
    channelId: sourceDetails.channelId,
    threadTs: sourceDetails.threadTs,
  };
}

/**
 * Format Slack context for prompt
 */
export function formatSlackContextForPrompt(result: SlackContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Slack Context');
  lines.push('');

  // Basic info
  if (sourceDetails.channel) {
    lines.push(`**Channel:** #${sourceDetails.channel}`);
  } else if (sourceDetails.channelId) {
    lines.push(`**Channel ID:** ${sourceDetails.channelId}`);
  }

  if (sourceDetails.threadTs) {
    lines.push(`**Thread:** Yes`);
  }

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  lines.push(`**Title:** ${sourceDetails.title}`);

  // Message content
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Message');
    lines.push(sourceDetails.description);
  }

  // Thread
  if (thread && thread.length > 0) {
    lines.push('');
    lines.push('### Thread Replies');
    for (const item of thread) {
      lines.push(`**${item.author}** (${item.date}):`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Discussions');
    for (const item of relatedItems) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  // People
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### Participants');
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
