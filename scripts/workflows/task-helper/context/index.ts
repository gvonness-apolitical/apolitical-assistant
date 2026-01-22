/**
 * Task Helper - Context Gathering Orchestrator
 *
 * Coordinates parallel context gathering from multiple sources.
 */

import type { Todo } from '@apolitical-assistant/shared';
import type {
  TaskContext,
  GatherOptions,
  GatheringStatus,
  ContextDepth,
  SourceDetails,
} from '../types.js';
import { getCachedContext, setCachedContext } from '../cache.js';
import { loadConfig } from '../config.js';

// Import source-specific gatherers
import { gatherGitHubContext } from './github.js';
import { gatherLinearContext } from './linear.js';
import { gatherEmailContext } from './email.js';
import { gatherSlackContext } from './slack.js';
import { gatherNotionContext } from './notion.js';
import { gatherMeetingContext } from './meeting.js';
import { gatherIncidentContext } from './incident.js';
import { gatherGenericContext } from './generic.js';
import { gatherWiderContext } from './wider.js';

/**
 * Source-specific gatherer type
 */
export type SourceGatherer = (
  todo: Todo,
  options: GatherOptions
) => Promise<{
  sourceDetails: SourceDetails;
  thread?: TaskContext['thread'];
  relatedItems?: TaskContext['relatedItems'];
  people?: TaskContext['people'];
  calendar?: TaskContext['calendar'];
  status: GatheringStatus;
}>;

/**
 * Map of sources to their gatherers
 */
const SOURCE_GATHERERS: Record<string, SourceGatherer> = {
  github: gatherGitHubContext,
  linear: gatherLinearContext,
  email: gatherEmailContext,
  slack: gatherSlackContext,
  notion: gatherNotionContext,
  'meeting-prep': gatherMeetingContext,
  calendar: gatherMeetingContext, // Use meeting gatherer for calendar items
  'incident-io': gatherIncidentContext,
};

/**
 * Merge gather options with defaults
 */
export function mergeGatherOptions(
  options: Partial<GatherOptions>,
  depth?: ContextDepth
): GatherOptions {
  const config = loadConfig();
  const defaults = config.defaults.options;

  const resolvedDepth = depth ?? options.depth ?? (defaults as { depth?: ContextDepth }).depth ?? 'standard';

  // Adjust options based on depth
  let includeWider = options.includeWider ?? false;
  let includeCalendar = options.includeCalendar ?? defaults.includeCalendar ?? false;

  if (resolvedDepth === 'comprehensive') {
    includeWider = true;
  } else if (resolvedDepth === 'minimal') {
    includeWider = false;
    includeCalendar = false;
  }

  return {
    depth: resolvedDepth,
    includeThread: options.includeThread ?? defaults.includeThread ?? true,
    includeRelated: options.includeRelated ?? defaults.includeRelated ?? true,
    includePeople: options.includePeople ?? defaults.includePeople ?? true,
    includeCalendar,
    includeWider,
    maxThreadMessages: options.maxThreadMessages ?? defaults.maxThreadMessages ?? 20,
    maxRelatedItems: options.maxRelatedItems ?? defaults.maxRelatedItems ?? 10,
    refresh: options.refresh ?? false,
  };
}

/**
 * Gather context for a TODO
 */
export async function gatherContext(
  todo: Todo,
  options: Partial<GatherOptions> = {}
): Promise<TaskContext> {
  const gatherOptions = mergeGatherOptions(options);

  // Check cache first (unless refresh is requested)
  if (!gatherOptions.refresh) {
    const cached = getCachedContext(todo.id);
    if (cached) {
      return cached;
    }
  }

  const sources: GatheringStatus[] = [];
  const startTime = Date.now();

  // Get the source-specific gatherer
  const source = todo.source ?? 'manual';
  const gatherer = SOURCE_GATHERERS[source] ?? gatherGenericContext;

  // Gather source-specific context
  let sourceResult: Awaited<ReturnType<SourceGatherer>>;
  try {
    sourceResult = await gatherer(todo, gatherOptions);
    sources.push(sourceResult.status);
  } catch (error) {
    // Fallback to generic on error
    sources.push({
      source,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    sourceResult = await gatherGenericContext(todo, gatherOptions);
    sources.push(sourceResult.status);
  }

  // Build the base context
  const context: TaskContext = {
    todo,
    sourceDetails: sourceResult.sourceDetails,
    thread: sourceResult.thread,
    relatedItems: sourceResult.relatedItems,
    people: sourceResult.people,
    calendar: sourceResult.calendar,
    gatheredAt: new Date().toISOString(),
    depth: gatherOptions.depth,
    sources,
  };

  // Gather wider context if requested
  if (gatherOptions.includeWider && gatherOptions.depth === 'comprehensive') {
    try {
      const widerResult = await gatherWiderContext(todo, context, gatherOptions);
      context.widerContext = widerResult.widerContext;
      sources.push(widerResult.status);
    } catch (error) {
      sources.push({
        source: 'wider',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Cache the context
  setCachedContext(todo.id, context);

  return context;
}

/**
 * Gather context for multiple TODOs in parallel
 */
export async function gatherContextBatch(
  todos: Todo[],
  options: Partial<GatherOptions> = {}
): Promise<Map<string, TaskContext>> {
  const results = new Map<string, TaskContext>();

  const gatherPromises = todos.map(async (todo) => {
    try {
      const context = await gatherContext(todo, options);
      return { todoId: todo.id, context };
    } catch (error) {
      // Return partial context on error
      const context: TaskContext = {
        todo,
        sourceDetails: {
          title: todo.title,
          description: todo.description,
        },
        gatheredAt: new Date().toISOString(),
        depth: options.depth ?? 'minimal',
        sources: [
          {
            source: todo.source ?? 'unknown',
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
      return { todoId: todo.id, context };
    }
  });

  const settled = await Promise.allSettled(gatherPromises);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.todoId, result.value.context);
    }
  }

  return results;
}

/**
 * Get a summary of gathered context for display
 */
export function summarizeContext(context: TaskContext): string {
  const lines: string[] = [];

  // Source details
  lines.push(`Source: ${context.todo.source ?? 'unknown'}`);
  if (context.sourceDetails.url) {
    lines.push(`URL: ${context.sourceDetails.url}`);
  }
  if (context.sourceDetails.status) {
    lines.push(`Status: ${context.sourceDetails.status}`);
  }

  // Thread info
  if (context.thread && context.thread.length > 0) {
    lines.push(`Thread: ${context.thread.length} messages`);
  }

  // Related items
  if (context.relatedItems && context.relatedItems.length > 0) {
    lines.push(`Related items: ${context.relatedItems.length}`);
  }

  // People
  if (context.people && context.people.length > 0) {
    lines.push(`People: ${context.people.map((p) => p.name).join(', ')}`);
  }

  // Gathering status
  const successCount = context.sources.filter((s) => s.status === 'success').length;
  const failedCount = context.sources.filter((s) => s.status === 'failed').length;
  lines.push(`Gathered from ${successCount} sources${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);

  return lines.join('\n');
}

/**
 * Format gathering progress for display
 */
export function formatGatheringProgress(status: GatheringStatus): string {
  const icon =
    status.status === 'success'
      ? '\u{2713}'
      : status.status === 'partial'
        ? '\u{26A0}'
        : status.status === 'failed'
          ? '\u{2717}'
          : '\u{2212}';

  let message = `${icon} ${status.source}`;
  if (status.itemCount !== undefined) {
    message += ` (${status.itemCount} items)`;
  }
  if (status.status === 'failed' && status.error) {
    message += ` - ${status.error}`;
  }

  return message;
}
