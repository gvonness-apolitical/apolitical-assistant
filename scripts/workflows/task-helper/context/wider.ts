/**
 * Task Helper - Wider Context Gatherer
 *
 * Gathers cross-source context for comprehensive analysis.
 */

import type { Todo } from '@apolitical-assistant/shared';
import type {
  TaskContext,
  GatherOptions,
  GatheringStatus,
  RelatedItem,
} from '../types.js';

/**
 * Wider context result
 */
export interface WiderContextResult {
  widerContext: TaskContext['widerContext'];
  status: GatheringStatus;
}

/**
 * Extract key entities from TODO and context for searching
 */
function extractSearchEntities(todo: Todo, context: TaskContext): {
  keywords: string[];
  people: string[];
  projects: string[];
  components: string[];
} {
  const keywords: Set<string> = new Set();
  const people: Set<string> = new Set();
  const projects: Set<string> = new Set();
  const components: Set<string> = new Set();

  // Extract from title
  const titleWords = todo.title.split(/\s+/).filter((w) => w.length > 3);
  titleWords.forEach((w) => keywords.add(w.toLowerCase()));

  // Extract from tags
  if (todo.tags) {
    todo.tags.forEach((t) => keywords.add(t.toLowerCase()));
  }

  // Extract from context
  if (context.sourceDetails.projectName) {
    projects.add(context.sourceDetails.projectName);
  }
  if (context.sourceDetails.teamName) {
    components.add(context.sourceDetails.teamName);
  }
  if (context.sourceDetails.repo) {
    components.add(context.sourceDetails.repo);
  }

  // Extract people from context
  if (context.people) {
    context.people.forEach((p) => people.add(p.name));
  }
  if (context.sourceDetails.author) {
    people.add(context.sourceDetails.author);
  }
  if (context.sourceDetails.assignee) {
    people.add(context.sourceDetails.assignee);
  }

  // Extract @mentions from description
  if (todo.description) {
    const mentions = todo.description.match(/@([A-Za-z0-9_-]+)/g);
    if (mentions) {
      mentions.forEach((m) => people.add(m.substring(1)));
    }
  }

  return {
    keywords: [...keywords].slice(0, 10),
    people: [...people].slice(0, 5),
    projects: [...projects].slice(0, 3),
    components: [...components].slice(0, 5),
  };
}

/**
 * Gather wider context from multiple sources
 *
 * Note: This implementation provides the structure for MCP-based gathering.
 * The actual MCP calls would be made by the CLI when this runs in Claude Code.
 */
export async function gatherWiderContext(
  todo: Todo,
  context: TaskContext,
  options: GatherOptions
): Promise<WiderContextResult> {
  const startTime = Date.now();

  // Extract entities for searching (used by buildSearchQueries when MCP calls are implemented)
  extractSearchEntities(todo, context);

  // Initialize wider context
  const widerContext: TaskContext['widerContext'] = {
    relatedPRs: [],
    relatedIssues: [],
    relatedDocs: [],
    slackDiscussions: [],
    recentSummaries: [],
  };

  let totalItems = 0;

  // Note: In actual implementation, these would be MCP calls run in parallel
  // For now, we just set up the structure

  // Search for related PRs (from GitHub)
  // Would use: mcp__github__search_issues with 'type:pr' filter
  const relatedPRs: RelatedItem[] = [];
  widerContext.relatedPRs = relatedPRs.slice(0, options.maxRelatedItems);
  totalItems += widerContext.relatedPRs.length;

  // Search for related Linear issues
  // Would use: mcp__linear__list_issues with project/team filters
  const relatedIssues: RelatedItem[] = [];
  widerContext.relatedIssues = relatedIssues.slice(0, options.maxRelatedItems);
  totalItems += widerContext.relatedIssues.length;

  // Search for related Notion docs
  // Would use: mcp__notion__notion_search
  const relatedDocs: RelatedItem[] = [];
  widerContext.relatedDocs = relatedDocs.slice(0, options.maxRelatedItems);
  totalItems += widerContext.relatedDocs.length;

  // Search for related Slack discussions
  // Would use: mcp__slack__slack_search
  const slackDiscussions: RelatedItem[] = [];
  widerContext.slackDiscussions = slackDiscussions.slice(0, options.maxRelatedItems);
  totalItems += widerContext.slackDiscussions.length;

  return {
    widerContext,
    status: {
      source: 'wider',
      status: 'success',
      itemCount: totalItems,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Build search queries for different sources
 */
export function buildSearchQueries(entities: ReturnType<typeof extractSearchEntities>): {
  github: string;
  linear: string;
  notion: string;
  slack: string;
} {
  const { keywords, people, projects, components } = entities;

  // Build GitHub search query
  const githubQuery = [
    ...keywords.slice(0, 3),
    ...components.map((c) => `repo:${c}`),
    ...people.slice(0, 2).map((p) => `author:${p}`),
  ]
    .filter(Boolean)
    .join(' ');

  // Build Linear search query (simpler - just keywords)
  const linearQuery = keywords.slice(0, 5).join(' ');

  // Build Notion search query
  const notionQuery = [...keywords.slice(0, 3), ...projects].filter(Boolean).join(' ');

  // Build Slack search query
  const slackQuery = [
    ...keywords.slice(0, 3),
    ...people.slice(0, 2).map((p) => `from:@${p}`),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    github: githubQuery,
    linear: linearQuery,
    notion: notionQuery,
    slack: slackQuery,
  };
}

/**
 * Format wider context for prompt
 */
export function formatWiderContextForPrompt(widerContext: TaskContext['widerContext']): string {
  if (!widerContext) {
    return '';
  }

  const lines: string[] = [];

  lines.push('## Wider Context');
  lines.push('');

  // Related PRs
  if (widerContext.relatedPRs && widerContext.relatedPRs.length > 0) {
    lines.push('### Related Pull Requests');
    for (const item of widerContext.relatedPRs) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      if (item.relevance) {
        lines.push(`  *${item.relevance}*`);
      }
    }
    lines.push('');
  }

  // Related Issues
  if (widerContext.relatedIssues && widerContext.relatedIssues.length > 0) {
    lines.push('### Related Issues');
    for (const item of widerContext.relatedIssues) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
      if (item.relevance) {
        lines.push(`  *${item.relevance}*`);
      }
    }
    lines.push('');
  }

  // Related Docs
  if (widerContext.relatedDocs && widerContext.relatedDocs.length > 0) {
    lines.push('### Related Documentation');
    for (const item of widerContext.relatedDocs) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
    lines.push('');
  }

  // Slack Discussions
  if (widerContext.slackDiscussions && widerContext.slackDiscussions.length > 0) {
    lines.push('### Related Slack Discussions');
    for (const item of widerContext.slackDiscussions) {
      lines.push(`- ${item.title}${item.url ? ` (${item.url})` : ''}`);
    }
    lines.push('');
  }

  // Recent Summaries
  if (widerContext.recentSummaries && widerContext.recentSummaries.length > 0) {
    lines.push('### From Recent Summaries');
    for (const summary of widerContext.recentSummaries) {
      lines.push(`- ${summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
