/**
 * Task Helper - Complete Mode
 *
 * Mode for helping complete and close tasks.
 */

import type { TaskContext, HelperResponse, StructuredOutput } from '../types.js';
import type { TemplateOptions } from '../prompts/templates.js';
import { formatContextForPrompt, buildBaseSystemPrompt } from '../prompts/templates.js';

/**
 * Options for complete mode
 */
export interface CompleteModeOptions extends TemplateOptions {
  confirmCompletion?: boolean;
  addCompletionComment?: boolean;
}

/**
 * Build prompt for completion assistance
 */
export function getCompletePrompt(
  context: TaskContext,
  options: CompleteModeOptions = {}
): { system: string; user: string } {
  const system = `${buildBaseSystemPrompt('complete', options)}

## Completion Assessment Guidelines
1. Verify all acceptance criteria are met
2. Identify any outstanding work or blockers
3. Check for documentation needs
4. Note any follow-up tasks to create
5. Prepare completion comment if appropriate

## Output Format
Provide a completion assessment with:
1. **Ready to Complete**: Yes/No with explanation
2. **Outstanding Items**: List of remaining work (if any)
3. **Blockers**: Issues preventing completion
4. **Follow-ups**: New tasks to create after completion
5. **Completion Comment**: Draft comment for closing`;

  const user = `Please assess if this task is ready to complete:

${formatContextForPrompt(context)}

${context.todo.dueDate ? `Due date: ${context.todo.dueDate}` : ''}
${context.todo.deadline ? `Deadline: ${context.todo.deadline}` : ''}

Analyze the task and provide:
1. Whether it's ready to mark as complete
2. Any outstanding items
3. Any blockers
4. Follow-up tasks to create
5. A completion comment if ready`;

  return { system, user };
}

/**
 * Execute complete mode
 *
 * Note: This function builds the prompt and context for completion assessment.
 * The actual LLM call would be made by the CLI when this runs in Claude Code.
 */
export async function executeCompleteMode(
  context: TaskContext,
  options: CompleteModeOptions = {}
): Promise<HelperResponse> {
  const prompt = getCompletePrompt(context, options);

  // Build the structured output placeholder
  const structured: StructuredOutput = {
    completionSteps: undefined, // Will be filled by LLM
    blockers: undefined,
  };

  // Build the response
  const response: HelperResponse = {
    todoId: context.todo.id,
    mode: 'complete',
    content: `## Completion Assessment\n\n*Assessment will be generated based on the following prompt:*\n\n**System:**\n${prompt.system}\n\n**User:**\n${prompt.user}`,
    structured,
    actions: [
      {
        type: 'display',
        description: 'Completion prompt prepared',
        status: 'completed',
      },
    ],
    contextSummary: buildContextSummary(context),
    generatedAt: new Date().toISOString(),
  };

  return response;
}

/**
 * Build a summary of the context used
 */
function buildContextSummary(context: TaskContext): string {
  const parts: string[] = [];

  parts.push(`Source: ${context.todo.source ?? 'unknown'}`);
  parts.push(`Status: ${context.todo.status}`);

  if (context.todo.dueDate) {
    parts.push(`Due: ${context.todo.dueDate}`);
  }

  if (context.thread && context.thread.length > 0) {
    parts.push(`Thread: ${context.thread.length} messages`);
  }

  return parts.join(' | ');
}

/**
 * Get recommended output type for complete mode
 */
export function getRecommendedOutput(context: TaskContext): 'mcp' | 'clipboard' | 'display' {
  const source = context.todo.source;

  // These sources support MCP writes for completion
  if (source === 'linear' || source === 'github' || source === 'notion') {
    return 'mcp';
  }

  return 'display';
}

/**
 * Format completion steps for display
 */
export function formatCompletionSteps(steps: string[]): string {
  if (steps.length === 0) {
    return 'No outstanding steps identified.';
  }

  const lines: string[] = ['## Steps to Complete', ''];

  for (let i = 0; i < steps.length; i++) {
    lines.push(`${i + 1}. ${steps[i]}`);
  }

  return lines.join('\n');
}

/**
 * Format blockers for display
 */
export function formatBlockers(blockers: string[]): string {
  if (blockers.length === 0) {
    return 'No blockers identified.';
  }

  const lines: string[] = ['## Blockers', ''];

  for (const blocker of blockers) {
    lines.push(`- \u{1F6D1} ${blocker}`);
  }

  return lines.join('\n');
}

/**
 * Check if task appears ready to complete based on context
 */
export function assessCompletionReadiness(context: TaskContext): {
  likely: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let likely = true;

  // Check if there's a recent completion indicator
  const recentActivity = context.thread?.slice(-3) ?? [];
  const hasCompletionKeywords = recentActivity.some(
    (item) =>
      item.content.toLowerCase().includes('done') ||
      item.content.toLowerCase().includes('complete') ||
      item.content.toLowerCase().includes('merged') ||
      item.content.toLowerCase().includes('resolved') ||
      item.content.toLowerCase().includes('shipped')
  );

  if (hasCompletionKeywords) {
    reasons.push('Recent activity suggests completion');
  }

  // Check for blocking keywords
  const hasBlockingKeywords = recentActivity.some(
    (item) =>
      item.content.toLowerCase().includes('blocked') ||
      item.content.toLowerCase().includes('waiting') ||
      item.content.toLowerCase().includes('need') ||
      item.content.toLowerCase().includes('todo') ||
      item.content.toLowerCase().includes('wip')
  );

  if (hasBlockingKeywords) {
    likely = false;
    reasons.push('Recent activity suggests work in progress');
  }

  // Check PR/issue status
  if (context.sourceDetails.status) {
    const status = context.sourceDetails.status.toLowerCase();
    if (status === 'merged' || status === 'closed' || status === 'done' || status === 'completed') {
      reasons.push(`Status indicates completion: ${context.sourceDetails.status}`);
    } else if (status === 'open' || status === 'in_progress' || status === 'in progress') {
      likely = false;
      reasons.push(`Status indicates not complete: ${context.sourceDetails.status}`);
    }
  }

  // Check CI status for PRs
  if (context.sourceDetails.ciStatus) {
    if (context.sourceDetails.ciStatus.toLowerCase() === 'passing') {
      reasons.push('CI is passing');
    } else {
      likely = false;
      reasons.push(`CI is ${context.sourceDetails.ciStatus}`);
    }
  }

  return { likely, reasons };
}
