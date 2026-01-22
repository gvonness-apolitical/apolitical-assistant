/**
 * Task Helper - MCP Write Operations
 *
 * Handles writing to various sources via MCP.
 */

import type { TaskContext } from '../types.js';
import { MCP_WRITE_CAPABLE } from '../types.js';

/**
 * MCP write target information
 */
export interface McpWriteTarget {
  source: string;
  type: 'comment' | 'review' | 'update' | 'create';
  identifier: string;
  description: string;
}

/**
 * Check if a source supports MCP writes
 */
export function canWriteToSource(source: string): boolean {
  return MCP_WRITE_CAPABLE[source] ?? false;
}

/**
 * Get the MCP write target for a context
 */
export function getMcpWriteTarget(context: TaskContext): string | undefined {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      if (context.sourceDetails.prNumber) {
        return `github:pr:${context.sourceDetails.repo}:${context.sourceDetails.prNumber}`;
      } else if (context.sourceDetails.issueNumber) {
        return `github:issue:${context.sourceDetails.repo}:${context.sourceDetails.issueNumber}`;
      }
      break;

    case 'linear':
      if (context.todo.sourceId) {
        return `linear:issue:${context.todo.sourceId}`;
      }
      break;

    case 'notion': {
      const metadata = context.sourceDetails.metadata as { pageId?: string } | undefined;
      if (metadata?.pageId) {
        return `notion:page:${metadata.pageId}`;
      }
      break;
    }
  }

  return undefined;
}

/**
 * Get a human-readable description of the MCP write target
 */
export function getMcpWriteDescription(context: TaskContext): string {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      if (context.sourceDetails.prNumber) {
        return `Comment on GitHub PR #${context.sourceDetails.prNumber}`;
      } else if (context.sourceDetails.issueNumber) {
        return `Comment on GitHub Issue #${context.sourceDetails.issueNumber}`;
      }
      return 'Comment on GitHub item';

    case 'linear':
      return `Comment on Linear issue ${context.todo.sourceId ?? context.todo.title}`;

    case 'notion':
      return 'Comment on Notion page';

    default:
      return `Write to ${source}`;
  }
}

/**
 * Get MCP function name for a write operation
 */
export function getMcpFunctionName(
  source: string,
  writeType: 'comment' | 'review' | 'update'
): string | undefined {
  switch (source) {
    case 'github':
      switch (writeType) {
        case 'comment':
          return 'mcp__github__add_issue_comment';
        case 'review':
          return 'mcp__github__create_pull_request_review';
        case 'update':
          return 'mcp__github__update_issue';
      }
      break;

    case 'linear':
      switch (writeType) {
        case 'comment':
          return 'mcp__linear__create_comment';
        case 'update':
          return 'mcp__linear__update_issue';
      }
      break;

    case 'notion':
      switch (writeType) {
        case 'comment':
          return 'mcp__notion__notion_create_comment';
        case 'update':
          return 'mcp__notion__notion_update_page';
      }
      break;
  }

  return undefined;
}

/**
 * Build MCP function parameters for a write operation
 */
export function buildMcpWriteParams(
  context: TaskContext,
  content: string,
  writeType: 'comment' | 'review' | 'update'
): Record<string, unknown> | undefined {
  const source = context.todo.source;

  switch (source) {
    case 'github':
      return buildGitHubParams(context, content, writeType);

    case 'linear':
      return buildLinearParams(context, content, writeType);

    case 'notion':
      return buildNotionParams(context, content, writeType);

    default:
      return undefined;
  }
}

/**
 * Build GitHub MCP parameters
 */
function buildGitHubParams(
  context: TaskContext,
  content: string,
  writeType: 'comment' | 'review' | 'update'
): Record<string, unknown> | undefined {
  const repo = context.sourceDetails.repo;
  if (!repo) return undefined;

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) return undefined;

  switch (writeType) {
    case 'comment': {
      const issueNumber = context.sourceDetails.issueNumber ?? context.sourceDetails.prNumber;
      if (!issueNumber) return undefined;
      return {
        owner,
        repo: repoName,
        issue_number: issueNumber,
        body: content,
      };
    }

    case 'review': {
      const prNumber = context.sourceDetails.prNumber;
      if (!prNumber) return undefined;
      return {
        owner,
        repo: repoName,
        pull_number: prNumber,
        body: content,
        event: 'COMMENT', // Default to comment, can be APPROVE or REQUEST_CHANGES
      };
    }

    default:
      return undefined;
  }
}

/**
 * Build Linear MCP parameters
 */
function buildLinearParams(
  context: TaskContext,
  content: string,
  writeType: 'comment' | 'update'
): Record<string, unknown> | undefined {
  const issueId = context.todo.sourceId;
  if (!issueId) return undefined;

  switch (writeType) {
    case 'comment':
      return {
        issueId,
        body: content,
      };

    case 'update':
      return {
        id: issueId,
        // The actual update fields would depend on what's being updated
      };

    default:
      return undefined;
  }
}

/**
 * Build Notion MCP parameters
 */
function buildNotionParams(
  context: TaskContext,
  content: string,
  writeType: 'comment' | 'update'
): Record<string, unknown> | undefined {
  const metadata = context.sourceDetails.metadata as { pageId?: string } | undefined;
  const pageId = metadata?.pageId;
  if (!pageId) return undefined;

  switch (writeType) {
    case 'comment':
      return {
        parent: {
          page_id: pageId,
        },
        rich_text: [
          {
            type: 'text',
            text: {
              content,
            },
          },
        ],
      };

    case 'update':
      return {
        data: {
          page_id: pageId,
          command: 'insert_content_after',
          selection_with_ellipsis: '', // Would need to specify where to insert
          new_str: content,
        },
      };

    default:
      return undefined;
  }
}

/**
 * Get a preview of what the MCP write will do
 */
export function getMcpWritePreview(
  context: TaskContext,
  content: string,
  writeType: 'comment' | 'review' | 'update'
): string {
  const target = getMcpWriteTarget(context);
  const description = getMcpWriteDescription(context);
  const functionName = getMcpFunctionName(context.todo.source ?? '', writeType);

  const lines: string[] = [
    '## MCP Write Preview',
    '',
    `**Action:** ${description}`,
    `**Target:** ${target ?? 'Unknown'}`,
    `**Function:** ${functionName ?? 'Unknown'}`,
    '',
    '### Content:',
    '```',
    content.substring(0, 500) + (content.length > 500 ? '...' : ''),
    '```',
  ];

  return lines.join('\n');
}
