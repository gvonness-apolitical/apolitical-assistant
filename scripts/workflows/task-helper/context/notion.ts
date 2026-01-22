/**
 * Task Helper - Notion Context Gatherer
 *
 * Gathers context from Notion pages and databases.
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
 * Notion context result
 */
export interface NotionContextResult {
  sourceDetails: SourceDetails;
  thread?: ThreadItem[];
  relatedItems?: RelatedItem[];
  people?: PersonContext[];
  status: GatheringStatus;
}

/**
 * Parse Notion URL to extract page/database ID
 */
function parseNotionUrl(url: string): { pageId?: string; databaseId?: string } | null {
  // Match patterns like:
  // https://www.notion.so/workspace/Page-Title-abc123def456
  // https://notion.so/abc123def456
  const pageMatch = url.match(/notion\.so\/(?:[^/]+\/)?(?:[^-]+-)?([a-f0-9]{32})/i);
  if (pageMatch) {
    return {
      pageId: pageMatch[1],
    };
  }

  // Also match page IDs with dashes
  const pageWithDashMatch = url.match(
    /notion\.so\/(?:[^/]+\/)?(?:[^-]+-)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i
  );
  if (pageWithDashMatch) {
    return {
      pageId: pageWithDashMatch[1].replace(/-/g, ''),
    };
  }

  return null;
}

/**
 * Gather context from Notion
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherNotionContext(
  todo: Todo,
  options: GatherOptions
): Promise<NotionContextResult> {
  const startTime = Date.now();

  // Parse Notion URL
  const url = todo.sourceUrl;
  const parsed = url ? parseNotionUrl(url) : null;

  // Build source details from TODO
  const sourceDetails: SourceDetails = {
    title: todo.title,
    description: todo.description,
    url: todo.sourceUrl,
    status: todo.status,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    metadata: parsed
      ? {
          pageId: parsed.pageId,
          databaseId: parsed.databaseId,
        }
      : undefined,
  };

  // Extract labels from tags if available
  if (todo.tags && todo.tags.length > 0) {
    sourceDetails.labels = todo.tags;
  }

  // Build thread from description (for Notion, this would be page content)
  const thread: ThreadItem[] = [];
  if (todo.description) {
    thread.push({
      author: sourceDetails.author ?? 'unknown',
      content: todo.description,
      date: todo.createdAt,
      type: 'note',
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
      source: 'notion',
      status: 'success',
      itemCount: thread.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get page context for Notion
 */
export function getPageContext(sourceDetails: SourceDetails): {
  hasPage: boolean;
  pageId: string | undefined;
  databaseId: string | undefined;
} {
  const metadata = sourceDetails.metadata as { pageId?: string; databaseId?: string } | undefined;
  return {
    hasPage: metadata?.pageId !== undefined,
    pageId: metadata?.pageId,
    databaseId: metadata?.databaseId,
  };
}

/**
 * Format Notion context for prompt
 */
export function formatNotionContextForPrompt(result: NotionContextResult): string {
  const lines: string[] = [];

  const { sourceDetails, thread, relatedItems, people } = result;

  // Header
  lines.push('## Notion Context');
  lines.push('');

  // Basic info
  lines.push(`**Page:** ${sourceDetails.title}`);

  if (sourceDetails.url) {
    lines.push(`**URL:** ${sourceDetails.url}`);
  }

  if (sourceDetails.status) {
    lines.push(`**Status:** ${sourceDetails.status}`);
  }

  if (sourceDetails.labels && sourceDetails.labels.length > 0) {
    lines.push(`**Tags:** ${sourceDetails.labels.join(', ')}`);
  }

  if (sourceDetails.updatedAt) {
    lines.push(`**Last Updated:** ${sourceDetails.updatedAt}`);
  }

  // Page content
  if (sourceDetails.description) {
    lines.push('');
    lines.push('### Page Content');
    lines.push(sourceDetails.description);
  }

  // Thread (comments on page)
  if (thread && thread.length > 1) {
    lines.push('');
    lines.push('### Comments');
    for (const item of thread.slice(1)) {
      // Skip first item (already shown as content)
      lines.push(`**${item.author}** (${item.date}):`);
      lines.push(item.content);
      lines.push('');
    }
  }

  // Related items
  if (relatedItems && relatedItems.length > 0) {
    lines.push('');
    lines.push('### Related Pages');
    for (const item of relatedItems) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
  }

  // People
  if (people && people.length > 0) {
    lines.push('');
    lines.push('### Contributors');
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
