/**
 * Task Helper - Email Context Gatherer
 *
 * Gathers context from email threads.
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
 * Email context result
 */
export interface EmailContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse email details from TODO
 */
function parseEmailDetails(todo: Todo): {
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  threadId?: string;
} {
  // Try to extract from description or metadata
  const details: ReturnType<typeof parseEmailDetails> = {};

  // Extract subject from title (common pattern: "RE: Subject" or "FW: Subject")
  const subjectMatch = todo.title.match(/^(?:RE:|FW:|Fwd:)?\s*(.+)$/i);
  if (subjectMatch) {
    details.subject = subjectMatch[1];
  }

  // Extract from sourceId if it's a Gmail message ID format
  if (todo.sourceId) {
    details.threadId = todo.sourceId;
  }

  return details;
}

/**
 * Gather context from email
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherEmailContext(
  todo: Todo,
  options: GatherOptions
): Promise<EmailContextResult> {
  const startTime = Date.now();

  // Parse email details
  const emailDetails = parseEmailDetails(todo);

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    subject: emailDetails.subject ?? todo.title,
    from: emailDetails.from,
    to: emailDetails.to,
    cc: emailDetails.cc,
    threadId: emailDetails.threadId,
  };

  // Build thread from description
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: sourceDetails.from ?? 'unknown',
      content: todo.description,
      date: todo.createdAt,
      type: 'email',
    });
  }

  // Related items would be populated via MCP calls
  const relatedItems: RelatedItem[] = [];

  // People context from email addresses
  const people: PersonContext[] = [];

  if (sourceDetails.from) {
    people.push({
      name: sourceDetails.from,
      email: sourceDetails.from,
    });
  }

  if (sourceDetails.to) {
    for (const email of sourceDetails.to) {
      if (!people.some((p) => p.email === email)) {
        people.push({
          name: email,
          email,
        });
      }
    }
  }

  return {
    sourceDetails,
    thread: options.includeThread ? thread : undefined,
    relatedItems: options.includeRelated ? relatedItems : undefined,
    people: options.includePeople ? people : undefined,
    status: {
      source: 'email',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get email reply context
 */
export function getReplyContext(sourceDetails: SourceDetails): {
  hasThread: boolean;
  isReply: boolean;
  isForward: boolean;
  recipientCount: number;
} {
  const isReply = sourceDetails.title?.toLowerCase().startsWith('re:') ?? false;
  const isForward =
    sourceDetails.title?.toLowerCase().startsWith('fw:') ||
    sourceDetails.title?.toLowerCase().startsWith('fwd:') ||
    false;

  return {
    hasThread: sourceDetails.threadId !== undefined,
    isReply,
    isForward,
    recipientCount: (sourceDetails.to?.length ?? 0) + (sourceDetails.cc?.length ?? 0),
  };
}

/**
 * Format email context for prompt
 */
export function formatEmailContextForPrompt(result: EmailContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Email Context');
  lines.push('');

  // Basic info
  lines.push(`**Subject:** ${sourceDetails.subject ?? sourceDetails.title}`);

  if (sourceDetails.from) {
    lines.push(`**From:** ${sourceDetails.from}`);
  }

  if (sourceDetails.to && sourceDetails.to.length > 0) {
    lines.push(`**To:** ${sourceDetails.to.join(', ')}`);
  }

  if (sourceDetails.cc && sourceDetails.cc.length > 0) {
    lines.push(`**Cc:** ${sourceDetails.cc.join(', ')}`);
  }

  if (sourceDetails.createdAt) {
    lines.push(`**Date:** ${sourceDetails.createdAt}`);
  }

  // Body/Description
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Email Body');
    lines.push(sourceDetails.description);
  }

  // Thread
  if (thread && thread.length > 1) {
    lines.push('');
    lines.push('### Thread History');
    for (const item of thread.slice(1)) {
      // Skip first item (already shown as body)
      lines.push(`**${item.author}** (${item.date}):`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Emails');
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
      if (person.department) {
        line += ` - ${person.department}`;
      }
      lines.push(line);
    }
  }

  return lines.join('\n');
}
