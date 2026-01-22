#!/usr/bin/env npx tsx

/**
 * Morning Briefing Workflow
 *
 * Generates a daily briefing by invoking Claude with context from all integrations.
 * The briefing includes:
 * - Today's calendar overview
 * - Urgent emails and Slack messages
 * - Active incidents and follow-ups
 * - Team availability (out of office)
 * - Outstanding todos
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { notifyBriefingReady } from '../../packages/shared/src/notify.js';
import { getDateString, getTimestamp, runClaudeCommand } from '../../packages/shared/src/workflow-utils.js';
import { ContextStore } from '../../packages/context-store/src/store.js';
import {
  getTodosForBriefing,
  getPriorityIndicator,
  calculateEffectivePriority,
  getRelativeDateDescription,
} from '../../packages/shared/src/todo-utils.js';
import type { Todo } from '../../packages/shared/src/types.js';
import {
  BRIEFINGS_DIR,
  DB_PATH,
  getProjectRoot,
} from '@apolitical-assistant/shared';

const PROJECT_ROOT = getProjectRoot();
const OUTPUT_DIR = BRIEFINGS_DIR;
const LOGS_DIR = join(PROJECT_ROOT, 'logs');

// Ensure directories exist
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });

/**
 * Format a single TODO for briefing context.
 */
function formatTodoForBriefingContext(todo: Todo): string {
  const priority = calculateEffectivePriority(todo);
  const indicator = getPriorityIndicator(priority);
  const targetDate = todo.deadline || todo.dueDate;
  const dateInfo = targetDate ? ` (${getRelativeDateDescription(targetDate)})` : '';
  const source = todo.source ? `[${todo.source}]` : '';
  const url = todo.sourceUrl ? ` - ${todo.sourceUrl}` : '';

  return `${indicator} [P${priority}] ${todo.title}${dateInfo} ${source}${url}`;
}

/**
 * Generate TODO context for the briefing prompt.
 */
function generateTodoContext(): string {
  let context = '';

  try {
    const store = new ContextStore(DB_PATH);

    try {
      const todos = store.listTodos({
        status: ['pending', 'in_progress'],
        excludeSnoozed: true,
        limit: 50,
      });

      const briefingTodos = getTodosForBriefing(todos, { limit: 5, staleDays: 14 });

      if (briefingTodos.overdue.length > 0) {
        context += '\n### OVERDUE TODOs (REQUIRES IMMEDIATE ATTENTION):\n';
        for (const todo of briefingTodos.overdue) {
          context += `- ${formatTodoForBriefingContext(todo)}\n`;
        }
      }

      if (briefingTodos.dueToday.length > 0) {
        context += '\n### TODOs Due Today:\n';
        for (const todo of briefingTodos.dueToday) {
          context += `- ${formatTodoForBriefingContext(todo)}\n`;
        }
      }

      if (briefingTodos.highPriority.length > 0) {
        context += '\n### High Priority TODOs (P1-P2):\n';
        for (const todo of briefingTodos.highPriority) {
          context += `- ${formatTodoForBriefingContext(todo)}\n`;
        }
      }

      if (briefingTodos.stale.length > 0) {
        context += '\n### Stale TODOs (need attention):\n';
        for (const todo of briefingTodos.stale) {
          context += `- ${formatTodoForBriefingContext(todo)}\n`;
        }
      }

      // Add top 5 by priority if we have more todos
      const remainingTodos = todos
        .filter((t) => !briefingTodos.overdue.includes(t) &&
          !briefingTodos.dueToday.includes(t) &&
          !briefingTodos.highPriority.includes(t))
        .sort((a, b) => calculateEffectivePriority(a) - calculateEffectivePriority(b))
        .slice(0, 5);

      if (remainingTodos.length > 0) {
        context += '\n### Other Active TODOs:\n';
        for (const todo of remainingTodos) {
          context += `- ${formatTodoForBriefingContext(todo)}\n`;
        }
      }

      if (context === '') {
        context = '\nNo active TODOs in the system.\n';
      }

      context += `\nTotal active TODOs: ${todos.length}\n`;

    } finally {
      store.close();
    }
  } catch {
    context = '\nNote: Could not load TODOs from database. Run `npm run todos:collect` to populate.\n';
  }

  return context;
}

const BRIEFING_PROMPT = `You are an executive assistant for the Director of Engineering. Generate a concise morning briefing for today.

Please gather information and create a briefing with the following sections:

## 📅 Today's Schedule
- List today's calendar events with times and attendees
- Highlight any meetings that need preparation
- Note any focus time blocks

## 📬 Communications
- Check for urgent/important emails that need attention
- Review any unread Slack DMs or important channel mentions
- List any GitHub PRs awaiting my review

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
{TODO_CONTEXT}
`;

/**
 * Get the briefing prompt with TODO context included.
 */
function getBriefingPromptWithContext(): string {
  const todoContext = generateTodoContext();
  return BRIEFING_PROMPT.replace('{TODO_CONTEXT}', todoContext);
}

async function generateBriefing(): Promise<void> {
  const dateString = getDateString();
  const timestamp = getTimestamp();
  const outputFile = join(OUTPUT_DIR, `briefing-${dateString}.md`);
  const logFile = join(LOGS_DIR, `briefing-${timestamp}.log`);

  console.log(`Generating morning briefing for ${dateString}...`);

  try {
    // Check if briefing already exists for today
    if (existsSync(outputFile)) {
      console.log(`Briefing already exists for ${dateString}: ${outputFile}`);
      console.log('Use --force to regenerate.');
      if (!process.argv.includes('--force')) {
        notifyBriefingReady(outputFile);
        return;
      }
      console.log('Regenerating...');
    }

    // Run Claude with the briefing prompt (including TODO context)
    const promptWithContext = getBriefingPromptWithContext();
    const briefingContent = await runClaudeCommand(promptWithContext, { cwd: PROJECT_ROOT });

    // Add header with metadata
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
    notifyBriefingReady(outputFile);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate briefing:', errorMessage);

    // Log the error
    writeFileSync(logFile, JSON.stringify({
      date: dateString,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      success: false,
    }, null, 2), 'utf-8');

    process.exit(1);
  }
}

// Run the workflow
generateBriefing().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
