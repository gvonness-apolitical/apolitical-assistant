/**
 * End-of-Day Summary
 *
 * Generates an end-of-day summary capturing what was accomplished,
 * what's in progress, and what's planned for tomorrow.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notifyBriefingReady } from '../../../packages/shared/src/notify.js';
import { getDateString, getTimestamp, runClaudeCommand } from '../../../packages/shared/src/workflow-utils.js';
import { ContextStore } from '../../../packages/context-store/src/store.js';
import {
  calculateEffectivePriority,
} from '../../../packages/shared/src/todo-utils.js';
import type { Todo } from '../../../packages/shared/src/types.js';
import type {
  BriefingDocument,
  BriefingTodo,
  EodSummaryOptions,
} from './types.js';
import {
  ensureDirectories,
  getBriefingFilePath,
  getLogFilePath,
  getDatabasePath,
} from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Convert a database TODO to a briefing TODO
 */
function convertToBriefingTodo(todo: Todo): BriefingTodo {
  const priority = calculateEffectivePriority(todo);
  const targetDate = todo.deadline || todo.dueDate;

  return {
    id: todo.id,
    title: todo.title,
    priority,
    status: todo.status,
    dueDate: targetDate,
    source: todo.source,
    sourceUrl: todo.sourceUrl,
    isOverdue: false,
    isDueToday: false,
    isStale: false,
  };
}

/**
 * Load completed TODOs from today
 */
function loadCompletedToday(dateString: string): BriefingTodo[] {
  const dbPath = getDatabasePath();

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      // Get all todos and filter for completed ones from today
      const allTodos = store.listTodos({
        status: ['completed'],
        limit: 100,
      });

      // Filter for those completed today
      const todayStart = new Date(dateString);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(dateString);
      todayEnd.setHours(23, 59, 59, 999);

      const completedToday = allTodos.filter(todo => {
        if (!todo.completedAt) return false;
        const completedDate = new Date(todo.completedAt);
        return completedDate >= todayStart && completedDate <= todayEnd;
      });

      return completedToday.map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load completed TODOs:', error);
    return [];
  }
}

/**
 * Load in-progress TODOs
 */
function loadInProgress(): BriefingTodo[] {
  const dbPath = getDatabasePath();

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const todos = store.listTodos({
        status: ['in_progress'],
        excludeSnoozed: true,
        limit: 20,
      });

      return todos.map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load in-progress TODOs:', error);
    return [];
  }
}

/**
 * Load high-priority pending TODOs for tomorrow
 */
function loadTomorrowPriorities(): BriefingTodo[] {
  const dbPath = getDatabasePath();

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const todos = store.listTodos({
        status: ['pending'],
        excludeSnoozed: true,
        limit: 50,
      });

      // Get top 5 by priority
      return todos
        .sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b))
        .slice(0, 5)
        .map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load tomorrow priorities:', error);
    return [];
  }
}

/**
 * Generate the EOD summary prompt
 */
function generateEodPrompt(
  completed: BriefingTodo[],
  inProgress: BriefingTodo[],
  tomorrowPriorities: BriefingTodo[]
): string {
  let context = '';

  if (completed.length > 0) {
    context += '\n### Completed Today:\n';
    for (const todo of completed) {
      const source = todo.source ? ` [${todo.source}]` : '';
      context += `- ${todo.title}${source}\n`;
    }
  } else {
    context += '\n### Completed Today:\n- No TODOs marked as completed today.\n';
  }

  if (inProgress.length > 0) {
    context += '\n### Currently In Progress:\n';
    for (const todo of inProgress) {
      const source = todo.source ? ` [${todo.source}]` : '';
      context += `- [P${todo.priority}] ${todo.title}${source}\n`;
    }
  }

  if (tomorrowPriorities.length > 0) {
    context += '\n### Top Priorities for Tomorrow:\n';
    for (const todo of tomorrowPriorities) {
      const source = todo.source ? ` [${todo.source}]` : '';
      context += `- [P${todo.priority}] ${todo.title}${source}\n`;
    }
  }

  return `You are an executive assistant for the Director of Engineering. Generate a concise end-of-day summary.

Please gather information and create an EOD summary with the following sections:

## ✅ Completed Today
- Summarize what was accomplished today based on the TODO data
- Highlight any notable achievements or milestones
- Note any PRs merged or reviews completed

## 🔄 In Progress
- List items that are currently being worked on
- Note any blockers or dependencies
- Highlight anything that may need attention tomorrow

## 🚧 Blockers
- List any blockers encountered today
- Note any pending decisions needed
- Highlight any escalations required

## 📋 Tomorrow's Focus
- Suggest top 3-5 priorities for tomorrow
- Note any deadlines approaching
- Highlight any important meetings

Format the summary as clean markdown. Be concise - this should capture the day's progress quickly.

## Current TODO Data
${context}

Also check:
- GitHub for PRs merged or reviewed today
- Slack for any important conversations
- Calendar for tomorrow's schedule
`;
}

/**
 * Generate an end-of-day summary
 */
export async function generateEodSummary(
  options: EodSummaryOptions = {}
): Promise<BriefingDocument> {
  const dateString = options.date || getDateString();
  const timestamp = getTimestamp();

  ensureDirectories();

  const outputFile = getBriefingFilePath('eod', dateString);
  const logFile = getLogFilePath('eod', timestamp);

  console.log(`Generating EOD summary for ${dateString}...`);

  // Check if summary already exists
  if (existsSync(outputFile) && !options.force) {
    console.log(`EOD summary already exists for ${dateString}: ${outputFile}`);
    console.log('Use --force to regenerate.');

    if (!options.skipNotification) {
      notifyBriefingReady(outputFile);
    }

    // Read and return existing summary
    const existing = readFileSync(outputFile, 'utf-8');
    return {
      id: randomUUID(),
      type: 'eod',
      date: dateString,
      generatedAt: new Date().toISOString(),
      filePath: outputFile,
      sections: [{ id: 'existing', title: 'Existing Summary', content: existing, hasItems: true }],
    };
  }

  // Load data
  const completed = loadCompletedToday(dateString);
  const inProgress = loadInProgress();
  const tomorrowPriorities = loadTomorrowPriorities();

  // Generate the summary
  const prompt = generateEodPrompt(completed, inProgress, tomorrowPriorities);
  const summaryContent = await runClaudeCommand(prompt, { cwd: PROJECT_ROOT });

  // Create the full summary document
  const fullSummary = `# End of Day Summary - ${dateString}

Generated: ${new Date().toLocaleString()}

---

${summaryContent}

---
*Generated by Apolitical Assistant*
`;

  // Write the summary
  writeFileSync(outputFile, fullSummary, 'utf-8');
  console.log(`EOD summary saved to: ${outputFile}`);

  // Log the run
  writeFileSync(logFile, JSON.stringify({
    date: dateString,
    timestamp: new Date().toISOString(),
    outputFile,
    success: true,
  }, null, 2), 'utf-8');

  // Send notification
  if (!options.skipNotification) {
    notifyBriefingReady(outputFile);
  }

  // Create briefing document
  const briefingDoc: BriefingDocument = {
    id: randomUUID(),
    type: 'eod',
    date: dateString,
    generatedAt: new Date().toISOString(),
    filePath: outputFile,
    todos: {
      overdue: [],
      dueToday: [],
      highPriority: tomorrowPriorities,
      stale: [],
      other: inProgress,
      total: completed.length + inProgress.length,
    },
    sections: [
      {
        id: 'content',
        title: 'EOD Summary',
        content: summaryContent,
        hasItems: true,
      },
    ],
    collectionStatus: [
      { source: 'todos', status: 'success', itemCount: completed.length + inProgress.length },
    ],
  };

  return briefingDoc;
}

/**
 * Format EOD summary as markdown
 */
export function formatEodMarkdown(summary: BriefingDocument): string {
  const lines: string[] = [];

  lines.push(`# End of Day Summary - ${summary.date}`);
  lines.push('');
  lines.push(`Generated: ${new Date(summary.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of summary.sections) {
    lines.push(section.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by Apolitical Assistant*');

  return lines.join('\n');
}
