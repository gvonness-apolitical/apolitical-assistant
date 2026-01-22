#!/usr/bin/env npx tsx

/**
 * Task Helper CLI
 *
 * Interactive task assistance for TODOs.
 *
 * Usage:
 *   npm run task:help                    # Interactive mode
 *   npm run task:help -- --list          # List available TODOs
 *   npm run task:help -- --id=<id>       # Help with specific TODO
 *   npm run task:help -- --id=<id> --mode=respond
 *   npm run task:help -- --id=<id> --mode=review --output=clipboard
 *   npm run task:help -- --source=github # Filter by source
 *   npm run task:help -- --refresh       # Refresh context cache
 *   npm run task:help -- --json          # JSON output
 */

import type { HelperMode, OutputType, ContextDepth, TaskHelperOptions, Todo } from './types.js';
import { HelperModeSchema, OutputTypeSchema, ContextDepthSchema } from './types.js';
import { getPreferredMode, getDefaultDepth } from './config.js';
import {
  getSelectableTodos,
  getTodoById,
  groupTodos,
  displayGroupedTodos,
  displayTodosJson,
  getFlatTodoList,
} from './select.js';
import { gatherContext, mergeGatherOptions, summarizeContext } from './context/index.js';
import { executeAction, getRecommendedOutputType } from './actions/index.js';
import { cleanupExpiredCache, getCacheStats, formatCacheStats } from './cache.js';

import { executeRespondMode } from './modes/respond.js';
import { executeReviewMode } from './modes/review.js';
import { executeSummarizeMode } from './modes/summarize.js';
import { executeScheduleMode } from './modes/schedule.js';
import { executeCompleteMode } from './modes/complete.js';

/**
 * Parse command line arguments
 */
function parseArgs(): TaskHelperOptions {
  const args = process.argv.slice(2);
  const options: TaskHelperOptions = {};

  for (const arg of args) {
    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--interactive') {
      options.interactive = true;
    } else if (arg === '--refresh') {
      options.refresh = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--id=')) {
      options.todoId = arg.split('=')[1];
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1];
      if (HelperModeSchema.safeParse(mode).success) {
        options.mode = mode as HelperMode;
      } else {
        console.error(`Invalid mode: ${mode}`);
        console.error(`Valid modes: ${HelperModeSchema.options.join(', ')}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--output=')) {
      const output = arg.split('=')[1];
      if (OutputTypeSchema.safeParse(output).success) {
        options.outputType = output as OutputType;
      } else {
        console.error(`Invalid output type: ${output}`);
        console.error(`Valid types: ${OutputTypeSchema.options.join(', ')}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--depth=')) {
      const depth = arg.split('=')[1];
      if (ContextDepthSchema.safeParse(depth).success) {
        options.depth = depth as ContextDepth;
      } else {
        console.error(`Invalid depth: ${depth}`);
        console.error(`Valid depths: ${ContextDepthSchema.options.join(', ')}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--search=')) {
      options.search = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1].split(',').map(Number);
    } else if (arg.startsWith('--prompt=')) {
      options.customPrompt = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Show help text
 */
function showHelp(): void {
  console.log(`
Task Helper CLI - Interactive task assistance for TODOs

USAGE:
  npm run task:help [options]

OPTIONS:
  --list              List available TODOs
  --id=<id>           Help with a specific TODO by ID
  --mode=<mode>       Helper mode (respond, review, summarize, schedule, complete)
  --output=<type>     Output type (mcp, clipboard, file, display)
  --depth=<depth>     Context depth (minimal, standard, comprehensive)
  --source=<source>   Filter TODOs by source
  --priority=<n,n>    Filter TODOs by priority (comma-separated)
  --search=<text>     Search TODOs by text
  --refresh           Force refresh context cache
  --interactive       Interactive mode
  --json              JSON output
  --verbose           Verbose output
  --quiet             Minimal output
  --help, -h          Show this help

MODES:
  respond      Draft a response (email, PR comment, etc.)
  review       Provide review points/commentary
  summarize    Summarize context and provide insights
  schedule     Help schedule related meetings
  complete     Help complete/close the TODO

EXAMPLES:
  npm run task:help -- --list
  npm run task:help -- --id=abc123 --mode=respond
  npm run task:help -- --source=github --mode=review
  npm run task:help -- --id=abc123 --output=clipboard
`);
}

/**
 * List TODOs
 */
function listTodos(options: TaskHelperOptions): void {
  const selectOptions = {
    source: options.source as any,
    priority: options.priority,
    search: options.search,
    limit: 50,
  };

  const todos = getSelectableTodos(selectOptions);

  if (options.json) {
    displayTodosJson(todos);
  } else {
    const groups = groupTodos(todos);
    displayGroupedTodos(groups, { quiet: options.quiet });
  }
}

/**
 * Execute helper for a TODO
 */
async function executeHelper(todo: Todo, options: TaskHelperOptions): Promise<void> {
  const source = todo.source ?? 'manual';

  // Determine mode
  const mode = options.mode ?? getPreferredMode(source);

  // Determine output type
  const outputType = options.outputType ?? getRecommendedOutputType({ todo } as any, mode);

  // Determine depth
  const depth = options.depth ?? getDefaultDepth(mode);

  if (!options.quiet) {
    console.log(`\n=== Task Helper ===`);
    console.log(`TODO: ${todo.title}`);
    console.log(`Mode: ${mode} | Depth: ${depth} | Output: ${outputType}`);
    console.log('');
  }

  // Gather context
  if (!options.quiet) {
    console.log('Gathering context...');
  }

  const gatherOptions = mergeGatherOptions(
    {
      depth,
      refresh: options.refresh ?? false,
    },
    depth
  );

  const context = await gatherContext(todo, gatherOptions);

  if (options.verbose) {
    console.log('\nContext gathered:');
    console.log(summarizeContext(context));
    console.log('');
  }

  // Execute mode
  if (!options.quiet) {
    console.log(`Executing ${mode} mode...`);
    console.log('');
  }

  let response;
  switch (mode) {
    case 'respond':
      response = await executeRespondMode(context);
      break;
    case 'review':
      response = await executeReviewMode(context);
      break;
    case 'summarize':
      response = await executeSummarizeMode(context);
      break;
    case 'schedule':
      response = await executeScheduleMode(context);
      break;
    case 'complete':
      response = await executeCompleteMode(context);
      break;
    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }

  // Display response
  if (options.json) {
    console.log(JSON.stringify(response, null, 2));
  } else {
    console.log(response.content);

    // Execute action if not display
    if (outputType !== 'display') {
      console.log('\nExecuting action...');
      const actionResult = await executeAction(context, {
        outputType,
        content: response.content,
      });
      console.log(`${actionResult.status === 'completed' ? '\u{2705}' : '\u{274C}'} ${actionResult.description}`);
    }

    // Show context summary
    if (response.contextSummary && !options.quiet) {
      console.log(`\n[${response.contextSummary}]`);
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  // Cleanup expired cache
  cleanupExpiredCache();

  // List mode
  if (options.list) {
    listTodos(options);
    return;
  }

  // Direct mode with TODO ID
  if (options.todoId) {
    const todo = getTodoById(options.todoId);
    if (!todo) {
      console.error(`TODO not found: ${options.todoId}`);
      process.exit(1);
    }
    await executeHelper(todo, options);
    return;
  }

  // Interactive mode (default)
  if (!options.quiet) {
    console.log('\n=== Task Helper - Interactive Mode ===\n');
    console.log('Tip: Use --id=<id> for direct mode, --list to see all TODOs\n');
  }

  // Get available TODOs
  const selectOptions = {
    source: options.source as any,
    priority: options.priority,
    search: options.search,
    limit: 20,
  };

  const todos = getSelectableTodos(selectOptions);

  if (todos.length === 0) {
    console.log('No TODOs found matching the criteria.');
    console.log('Try: npm run task:help -- --list');
    return;
  }

  // Display TODOs for selection
  const groups = groupTodos(todos);
  displayGroupedTodos(groups, { quiet: options.quiet });

  // Get flat list for indexing
  const flatList = getFlatTodoList(groups);

  console.log('\nTo help with a TODO, run:');
  console.log(`  npm run task:help -- --id=<todo_id> --mode=<mode>`);
  console.log('');
  console.log('First few TODO IDs:');
  for (let i = 0; i < Math.min(3, flatList.length); i++) {
    const todo = flatList[i];
    console.log(`  ${i + 1}. ${todo.id.substring(0, 8)}... (${todo.source})`);
  }
  console.log('');

  // Show cache stats if verbose
  if (options.verbose) {
    const stats = getCacheStats();
    console.log(formatCacheStats(stats));
  }
}

// Run main
main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
