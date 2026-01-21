/**
 * Morning Briefing
 *
 * Generates a daily morning briefing by composing data from
 * various modules (summaries, todos, meetings, email triage).
 */

import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notifyBriefingReady } from '../../../packages/shared/src/notify.js';
import { getDateString, getTimestamp, runClaudeCommand } from '../../../packages/shared/src/workflow-utils.js';
import { ContextStore } from '../../../packages/context-store/src/store.js';
import {
  getTodosForBriefing,
  getPriorityIndicator,
  calculateEffectivePriority,
  getRelativeDateDescription,
} from '../../../packages/shared/src/todo-utils.js';
import type { Todo } from '../../../packages/shared/src/types.js';
import type {
  BriefingDocument,
  BriefingTodo,
  MorningBriefingOptions,
  EmailTriageStats,
} from './types.js';
import {
  loadBriefingsConfig,
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
function convertToBriefingTodo(todo: Todo, today: Date): BriefingTodo {
  const priority = calculateEffectivePriority(todo);
  const targetDate = todo.deadline || todo.dueDate;

  let isOverdue = false;
  let isDueToday = false;

  if (targetDate) {
    const dueDate = new Date(targetDate);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    isOverdue = dueDateStart < todayStart;
    isDueToday = dueDateStart.getTime() === todayStart.getTime();
  }

  // Check if stale (no activity in 14 days)
  const config = loadBriefingsConfig();
  const staleDays = config.morning.staleDays;
  const lastActivity = todo.lastActivityAt || todo.createdAt;
  const daysSinceActivity = lastActivity
    ? Math.floor((today.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isStale = daysSinceActivity >= staleDays && !isOverdue && !isDueToday;

  return {
    id: todo.id,
    title: todo.title,
    priority,
    status: todo.status,
    dueDate: targetDate,
    source: todo.source,
    sourceUrl: todo.sourceUrl,
    isOverdue,
    isDueToday,
    isStale,
  };
}

/**
 * Format a single TODO for briefing context
 */
function formatTodoForContext(todo: BriefingTodo): string {
  const indicator = getPriorityIndicator(todo.priority);
  const dateInfo = todo.dueDate ? ` (${getRelativeDateDescription(todo.dueDate)})` : '';
  const source = todo.source ? `[${todo.source}]` : '';
  const url = todo.sourceUrl ? ` - ${todo.sourceUrl}` : '';

  return `${indicator} [P${todo.priority}] ${todo.title}${dateInfo} ${source}${url}`;
}

/**
 * Load TODOs from the database and categorize them
 */
function loadTodos(): BriefingDocument['todos'] {
  const dbPath = getDatabasePath();
  const today = new Date();
  const config = loadBriefingsConfig();

  const result = {
    overdue: [] as BriefingTodo[],
    dueToday: [] as BriefingTodo[],
    highPriority: [] as BriefingTodo[],
    stale: [] as BriefingTodo[],
    other: [] as BriefingTodo[],
    total: 0,
  };

  if (!existsSync(dbPath)) {
    return result;
  }

  try {
    const store = new ContextStore(dbPath);

    try {
      const todos = store.listTodos({
        status: ['pending', 'in_progress'],
        excludeSnoozed: true,
        limit: 50,
      });

      result.total = todos.length;

      const briefingTodos = getTodosForBriefing(todos, {
        limit: config.morning.todoLimit,
        staleDays: config.morning.staleDays,
      });

      // Convert to briefing format
      result.overdue = briefingTodos.overdue.map(t => convertToBriefingTodo(t, today));
      result.dueToday = briefingTodos.dueToday.map(t => convertToBriefingTodo(t, today));
      result.highPriority = briefingTodos.highPriority.map(t => convertToBriefingTodo(t, today));
      result.stale = briefingTodos.stale.map(t => convertToBriefingTodo(t, today));

      // Get remaining todos
      const processedIds = new Set([
        ...result.overdue.map(t => t.id),
        ...result.dueToday.map(t => t.id),
        ...result.highPriority.map(t => t.id),
        ...result.stale.map(t => t.id),
      ]);

      result.other = todos
        .filter(t => !processedIds.has(t.id))
        .sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b))
        .slice(0, 5)
        .map(t => convertToBriefingTodo(t, today));

    } finally {
      store.close();
    }
  } catch (error) {
    console.warn('Failed to load TODOs:', error);
  }

  return result;
}

/**
 * Generate TODO context for the briefing prompt
 */
function generateTodoContext(todos: BriefingDocument['todos']): string {
  if (!todos) {
    return '\nNote: Could not load TODOs from database. Run `npm run todos:collect` to populate.\n';
  }

  let context = '';

  if (todos.overdue.length > 0) {
    context += '\n### OVERDUE TODOs (REQUIRES IMMEDIATE ATTENTION):\n';
    for (const todo of todos.overdue) {
      context += `- ${formatTodoForContext(todo)}\n`;
    }
  }

  if (todos.dueToday.length > 0) {
    context += '\n### TODOs Due Today:\n';
    for (const todo of todos.dueToday) {
      context += `- ${formatTodoForContext(todo)}\n`;
    }
  }

  if (todos.highPriority.length > 0) {
    context += '\n### High Priority TODOs (P1-P2):\n';
    for (const todo of todos.highPriority) {
      context += `- ${formatTodoForContext(todo)}\n`;
    }
  }

  if (todos.stale.length > 0) {
    context += '\n### Stale TODOs (need attention):\n';
    for (const todo of todos.stale) {
      context += `- ${formatTodoForContext(todo)}\n`;
    }
  }

  if (todos.other.length > 0) {
    context += '\n### Other Active TODOs:\n';
    for (const todo of todos.other) {
      context += `- ${formatTodoForContext(todo)}\n`;
    }
  }

  if (context === '') {
    context = '\nNo active TODOs in the system.\n';
  }

  context += `\nTotal active TODOs: ${todos.total}\n`;

  return context;
}

/**
 * Load email triage stats if available
 */
function loadEmailTriageStats(): EmailTriageStats | undefined {
  // TODO: Integrate with email triage module when available
  // For now, return undefined
  return undefined;
}

/**
 * Generate email triage context
 */
function generateEmailTriageContext(stats: EmailTriageStats | undefined): string {
  if (!stats) {
    return '';
  }

  return `
### Email Triage Stats (overnight)
- Total processed: ${stats.totalProcessed}
- Auto-archived: ${stats.autoArchived}
- Auto-deleted: ${stats.autoDeleted}
- Needs attention: ${stats.needsAttention}
- TODOs created: ${stats.todosCreated}
`;
}

/**
 * Load meeting prep status
 */
function loadMeetingPrepStatus(): string {
  // TODO: Integrate with meetings module to show prep status
  // For now, return empty string
  return '';
}

/**
 * Generate the briefing prompt
 */
function generateBriefingPrompt(
  todos: BriefingDocument['todos'],
  emailStats: EmailTriageStats | undefined
): string {
  const todoContext = generateTodoContext(todos);
  const emailContext = generateEmailTriageContext(emailStats);
  const meetingPrepContext = loadMeetingPrepStatus();

  return `You are an executive assistant for the Director of Engineering. Generate a concise morning briefing for today.

Please gather information and create a briefing with the following sections:

## 📅 Today's Schedule
- List today's calendar events with times and attendees
- Highlight any meetings that need preparation
- Note any focus time blocks
${meetingPrepContext}

## 📬 Communications
- Check for urgent/important emails that need attention
- Review any unread Slack DMs or important channel mentions
- List any GitHub PRs awaiting my review
${emailContext}

## 🚨 Incidents & Operations
- List any active incidents from Incident.io
- Note any outstanding incident follow-ups assigned to me or my team
- Highlight any resolved incidents from the past 24 hours

## 👥 Team
- Who is out of office today (from Humaans)
- Any new hires starting this week
- Upcoming 1:1s that need preparation

## ✅ Priority Tasks
- Use the TODO data provided below to highlight top priority items
- Flag any overdue items prominently
- Note items due today
- Call out stale TODOs that need attention
- Include any blockers or dependencies

## 💡 Quick Actions
- Suggest 2-3 quick wins I could accomplish today
- Note any decisions I need to make

Format the briefing as clean markdown. Be concise - this should be scannable in under 2 minutes.
Focus on actionable information and things that need my attention today.

## Current TODO Data

The following TODO data has been loaded from the TODO tracking system:
${todoContext}
`;
}

/**
 * Generate a morning briefing
 */
export async function generateMorningBriefing(
  options: MorningBriefingOptions = {}
): Promise<BriefingDocument> {
  const dateString = options.date || getDateString();
  const timestamp = getTimestamp();

  ensureDirectories();

  const outputFile = getBriefingFilePath('morning', dateString);
  const logFile = getLogFilePath('morning', timestamp);

  console.log(`Generating morning briefing for ${dateString}...`);

  // Check if briefing already exists
  if (existsSync(outputFile) && !options.force) {
    console.log(`Briefing already exists for ${dateString}: ${outputFile}`);
    console.log('Use --force to regenerate.');

    if (!options.skipNotification) {
      notifyBriefingReady(outputFile);
    }

    // Read and return existing briefing
    const existing = readFileSync(outputFile, 'utf-8');
    return {
      id: randomUUID(),
      type: 'morning',
      date: dateString,
      generatedAt: new Date().toISOString(),
      filePath: outputFile,
      sections: [{ id: 'existing', title: 'Existing Briefing', content: existing, hasItems: true }],
    };
  }

  // Load data from various sources
  const todos = loadTodos();
  const emailStats = options.includeEmailStats ? loadEmailTriageStats() : undefined;

  // Generate the briefing
  const prompt = generateBriefingPrompt(todos, emailStats);
  const briefingContent = await runClaudeCommand(prompt, { cwd: PROJECT_ROOT });

  // Create the full briefing document
  const fullBriefing = `# Morning Briefing - ${dateString}

Generated: ${new Date().toLocaleString()}

---

${briefingContent}

---
*Generated by Apolitical Assistant*
`;

  // Write the briefing
  writeFileSync(outputFile, fullBriefing, 'utf-8');
  console.log(`Briefing saved to: ${outputFile}`);

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
    type: 'morning',
    date: dateString,
    generatedAt: new Date().toISOString(),
    filePath: outputFile,
    todos,
    emailTriageStats: emailStats,
    sections: [
      {
        id: 'content',
        title: 'Morning Briefing',
        content: briefingContent,
        hasItems: true,
      },
    ],
    collectionStatus: [
      { source: 'todos', status: todos.total > 0 ? 'success' : 'partial', itemCount: todos.total },
      { source: 'emailTriage', status: emailStats ? 'success' : 'partial' },
    ],
  };

  return briefingDoc;
}

/**
 * Format a briefing document as markdown
 */
export function formatBriefingMarkdown(briefing: BriefingDocument): string {
  const lines: string[] = [];

  lines.push(`# ${briefing.type.charAt(0).toUpperCase() + briefing.type.slice(1)} Briefing - ${briefing.date}`);
  lines.push('');
  lines.push(`Generated: ${new Date(briefing.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of briefing.sections) {
    if (section.title) {
      lines.push(`## ${section.icon || ''} ${section.title}`);
      lines.push('');
    }
    lines.push(section.content);
    lines.push('');
  }

  if (briefing.warnings && briefing.warnings.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('**Warnings:**');
    for (const warning of briefing.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by Apolitical Assistant*');

  return lines.join('\n');
}
