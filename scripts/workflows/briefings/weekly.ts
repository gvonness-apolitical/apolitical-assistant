/**
 * Weekly Review
 *
 * Generates a weekly review summarizing the week's activities,
 * progress on goals, and planning for the next week.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notifyBriefingReady } from '../../../packages/shared/src/notify.js';
import { getTimestamp, runClaudeCommand } from '../../../packages/shared/src/workflow-utils.js';
import { ContextStore } from '../../../packages/context-store/src/store.js';
import {
  calculateEffectivePriority,
} from '../../../packages/shared/src/todo-utils.js';
import type { Todo } from '../../../packages/shared/src/types.js';
import type {
  BriefingDocument,
  BriefingTodo,
  WeeklyReviewOptions,
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
 * Get week string in format YYYY-Www
 */
function getWeekString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get date range for a week string
 */
function getWeekDateRange(weekString: string): { start: Date; end: Date } {
  // Parse week string (YYYY-Www)
  const match = weekString.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week string: ${weekString}`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Calculate first day of the week (Monday)
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (jan1.getDay() || 7) - 1; // Days from Monday
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - daysOffset + (week - 1) * 7);

  const start = new Date(firstMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(firstMonday);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

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
 * Load TODOs completed during the week
 */
function loadCompletedThisWeek(weekString: string): BriefingTodo[] {
  const dbPath = getDatabasePath();
  const { start, end } = getWeekDateRange(weekString);

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const allTodos = store.listTodos({
        status: ['completed'],
        limit: 200,
      });

      const completedThisWeek = allTodos.filter(todo => {
        if (!todo.completedAt) return false;
        const completedDate = new Date(todo.completedAt);
        return completedDate >= start && completedDate <= end;
      });

      return completedThisWeek.map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load completed TODOs:', error);
    return [];
  }
}

/**
 * Load TODOs created during the week
 */
function loadCreatedThisWeek(weekString: string): BriefingTodo[] {
  const dbPath = getDatabasePath();
  const { start, end } = getWeekDateRange(weekString);

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const allTodos = store.listTodos({
        status: ['pending', 'in_progress', 'completed'],
        limit: 200,
      });

      const createdThisWeek = allTodos.filter(todo => {
        const createdDate = new Date(todo.createdAt);
        return createdDate >= start && createdDate <= end;
      });

      return createdThisWeek.map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load created TODOs:', error);
    return [];
  }
}

/**
 * Load active high-priority TODOs
 */
function loadActiveHighPriority(): BriefingTodo[] {
  const dbPath = getDatabasePath();

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const todos = store.listTodos({
        status: ['pending', 'in_progress'],
        excludeSnoozed: true,
        limit: 50,
      });

      // Get P1-P2 items
      return todos
        .filter(t => {
          const priority = calculateEffectivePriority(t);
          return priority <= 2;
        })
        .sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b))
        .slice(0, 10)
        .map(convertToBriefingTodo);

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load high priority TODOs:', error);
    return [];
  }
}

/**
 * Generate the weekly review prompt
 */
function generateWeeklyPrompt(
  weekString: string,
  completed: BriefingTodo[],
  created: BriefingTodo[],
  highPriority: BriefingTodo[]
): string {
  const { start, end } = getWeekDateRange(weekString);
  const startStr = start.toLocaleDateString();
  const endStr = end.toLocaleDateString();

  let context = `\n### Week: ${weekString} (${startStr} - ${endStr})\n`;

  context += `\n### TODOs Completed This Week (${completed.length}):\n`;
  if (completed.length > 0) {
    for (const todo of completed) {
      const source = todo.source ? ` [${todo.source}]` : '';
      context += `- ${todo.title}${source}\n`;
    }
  } else {
    context += '- No TODOs marked as completed this week.\n';
  }

  context += `\n### New TODOs Created This Week (${created.length}):\n`;
  if (created.length > 0) {
    const bySource: Record<string, number> = {};
    for (const todo of created) {
      const source = todo.source || 'manual';
      bySource[source] = (bySource[source] || 0) + 1;
    }
    for (const [source, count] of Object.entries(bySource)) {
      context += `- ${source}: ${count}\n`;
    }
  }

  context += '\n### Active High Priority Items:\n';
  if (highPriority.length > 0) {
    for (const todo of highPriority) {
      const source = todo.source ? ` [${todo.source}]` : '';
      context += `- [P${todo.priority}] ${todo.title}${source}\n`;
    }
  } else {
    context += '- No high priority items pending.\n';
  }

  return `You are an executive assistant for the Director of Engineering. Generate a comprehensive weekly review for week ${weekString}.

Please gather information and create a weekly review with the following sections:

## 🎯 Week Highlights
- Summarize the key accomplishments of the week
- Note any major milestones reached
- Highlight successful project completions

## 📊 Metrics & Progress
- TODOs completed vs created ratio
- PRs merged and reviewed (check GitHub)
- Incident count and resolution times (check Incident.io)
- Team velocity observations

## 🚨 Incidents & Issues
- List any incidents that occurred this week
- Note any recurring patterns
- Highlight follow-ups still pending

## 👥 Team Updates
- Any notable team changes
- 1:1 highlights and action items
- Team capacity changes (joins, leaves, time off)

## 📋 Next Week Focus
- Top 3-5 priorities for next week
- Key meetings and deadlines
- Any major decisions needed

## 💭 Reflections
- What went well this week?
- What could be improved?
- Any process changes to consider?

Format the review as clean markdown. Be comprehensive but organized.

## Current TODO Data
${context}

Also check:
- GitHub for PRs merged this week
- Linear for sprint progress
- Slack for notable discussions
- Calendar for meetings attended
- Incident.io for incidents this week
`;
}

/**
 * Generate a weekly review
 */
export async function generateWeeklyReview(
  options: WeeklyReviewOptions = {}
): Promise<BriefingDocument> {
  const weekString = options.week || getWeekString();
  const timestamp = getTimestamp();

  ensureDirectories();

  const outputFile = getBriefingFilePath('weekly', weekString);
  const logFile = getLogFilePath('weekly', timestamp);

  console.log(`Generating weekly review for ${weekString}...`);

  // Check if review already exists
  if (existsSync(outputFile) && !options.force) {
    console.log(`Weekly review already exists for ${weekString}: ${outputFile}`);
    console.log('Use --force to regenerate.');

    if (!options.skipNotification) {
      notifyBriefingReady(outputFile);
    }

    // Read and return existing review
    const existing = readFileSync(outputFile, 'utf-8');
    return {
      id: randomUUID(),
      type: 'weekly',
      date: weekString,
      generatedAt: new Date().toISOString(),
      filePath: outputFile,
      sections: [{ id: 'existing', title: 'Existing Review', content: existing, hasItems: true }],
    };
  }

  // Load data
  const completed = loadCompletedThisWeek(weekString);
  const created = loadCreatedThisWeek(weekString);
  const highPriority = loadActiveHighPriority();

  // Generate the review
  const prompt = generateWeeklyPrompt(weekString, completed, created, highPriority);
  const reviewContent = await runClaudeCommand(prompt, { cwd: PROJECT_ROOT });

  // Create the full review document
  const { start, end } = getWeekDateRange(weekString);
  const fullReview = `# Weekly Review - ${weekString}

${start.toLocaleDateString()} - ${end.toLocaleDateString()}

Generated: ${new Date().toLocaleString()}

---

${reviewContent}

---
*Generated by Apolitical Assistant*
`;

  // Write the review
  writeFileSync(outputFile, fullReview, 'utf-8');
  console.log(`Weekly review saved to: ${outputFile}`);

  // Log the run
  writeFileSync(logFile, JSON.stringify({
    week: weekString,
    timestamp: new Date().toISOString(),
    outputFile,
    success: true,
    stats: {
      completed: completed.length,
      created: created.length,
      highPriority: highPriority.length,
    },
  }, null, 2), 'utf-8');

  // Send notification
  if (!options.skipNotification) {
    notifyBriefingReady(outputFile);
  }

  // Create briefing document
  const briefingDoc: BriefingDocument = {
    id: randomUUID(),
    type: 'weekly',
    date: weekString,
    generatedAt: new Date().toISOString(),
    filePath: outputFile,
    todos: {
      overdue: [],
      dueToday: [],
      highPriority,
      stale: [],
      other: completed,
      total: completed.length + created.length,
    },
    sections: [
      {
        id: 'content',
        title: 'Weekly Review',
        content: reviewContent,
        hasItems: true,
      },
    ],
    collectionStatus: [
      { source: 'todos', status: 'success', itemCount: completed.length + created.length },
    ],
  };

  return briefingDoc;
}

/**
 * Format weekly review as markdown
 */
export function formatWeeklyMarkdown(review: BriefingDocument): string {
  const lines: string[] = [];

  lines.push(`# Weekly Review - ${review.date}`);
  lines.push('');
  lines.push(`Generated: ${new Date(review.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of review.sections) {
    lines.push(section.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by Apolitical Assistant*');

  return lines.join('\n');
}

/**
 * Get previous week string
 */
export function getPreviousWeek(weekString?: string): string {
  if (!weekString) {
    // Get last week from today
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return getWeekString(lastWeek);
  }

  const { start } = getWeekDateRange(weekString);
  const previousWeek = new Date(start);
  previousWeek.setDate(previousWeek.getDate() - 7);
  return getWeekString(previousWeek);
}
