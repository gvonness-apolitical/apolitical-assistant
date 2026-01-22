/**
 * Task Helper - Action Executor Orchestrator
 *
 * Coordinates action execution (MCP writes, clipboard, file output).
 */

import { toErrorMessage } from '@apolitical-assistant/shared';
import type { TaskContext, OutputType, ActionResult } from '../types.js';
import { writeToClipboard, isClipboardAvailable } from './clipboard.js';
import { writeToFile, getDefaultOutputPath } from './file-output.js';
import { getMcpWriteTarget, canWriteToSource, getMcpWriteDescription } from './mcp-write.js';

/**
 * Action execution options
 */
export interface ExecuteActionOptions {
  outputType: OutputType;
  content: string;
  filePath?: string;
  confirm?: boolean;
}

/**
 * Execute an action based on output type
 */
export async function executeAction(
  context: TaskContext,
  options: ExecuteActionOptions
): Promise<ActionResult> {
  const { outputType, content, filePath } = options;

  switch (outputType) {
    case 'mcp':
      return await executeMcpWrite(context, content);

    case 'clipboard':
      return await executeClipboard(content);

    case 'file':
      return await executeFileOutput(context, content, filePath);

    case 'display':
    default:
      return executeDisplay(content);
  }
}

/**
 * Execute MCP write action
 */
async function executeMcpWrite(context: TaskContext, _content: string): Promise<ActionResult> {
  const source = context.todo.source ?? 'unknown';

  if (!canWriteToSource(source)) {
    return {
      type: 'mcp_write',
      description: `MCP write not available for ${source}`,
      status: 'failed',
      error: `Source "${source}" does not support MCP writes`,
    };
  }

  const target = getMcpWriteTarget(context);
  const description = getMcpWriteDescription(context);

  // Note: Actual MCP write would be done via Claude Code's MCP integration
  // This returns a pending status that signals to the CLI to perform the write
  return {
    type: 'mcp_write',
    description,
    status: 'pending',
    target,
  };
}

/**
 * Execute clipboard action
 */
async function executeClipboard(content: string): Promise<ActionResult> {
  if (!isClipboardAvailable()) {
    return {
      type: 'clipboard',
      description: 'Copy to clipboard',
      status: 'failed',
      error: 'Clipboard not available in this environment',
    };
  }

  try {
    const success = await writeToClipboard(content);
    if (success) {
      return {
        type: 'clipboard',
        description: 'Copied to clipboard',
        status: 'completed',
      };
    } else {
      return {
        type: 'clipboard',
        description: 'Copy to clipboard',
        status: 'failed',
        error: 'Failed to write to clipboard',
      };
    }
  } catch (error) {
    return {
      type: 'clipboard',
      description: 'Copy to clipboard',
      status: 'failed',
      error: toErrorMessage(error),
    };
  }
}

/**
 * Execute file output action
 */
async function executeFileOutput(
  context: TaskContext,
  content: string,
  filePath?: string
): Promise<ActionResult> {
  const outputPath = filePath ?? getDefaultOutputPath(context);

  try {
    await writeToFile(outputPath, content);
    return {
      type: 'file',
      description: `Written to ${outputPath}`,
      status: 'completed',
      target: outputPath,
    };
  } catch (error) {
    return {
      type: 'file',
      description: 'Write to file',
      status: 'failed',
      error: toErrorMessage(error),
    };
  }
}

/**
 * Execute display action (just returns the content)
 */
function executeDisplay(_content: string): ActionResult {
  return {
    type: 'display',
    description: 'Displayed in terminal',
    status: 'completed',
  };
}

/**
 * Get available output types for a context
 */
export function getAvailableOutputTypes(context: TaskContext): OutputType[] {
  const available: OutputType[] = ['display'];

  // Check clipboard
  if (isClipboardAvailable()) {
    available.push('clipboard');
  }

  // File is always available
  available.push('file');

  // Check MCP write capability
  const source = context.todo.source ?? 'unknown';
  if (canWriteToSource(source)) {
    available.unshift('mcp'); // MCP first if available
  }

  return available;
}

/**
 * Get the recommended output type for a context and mode
 */
export function getRecommendedOutputType(
  context: TaskContext,
  mode: string
): OutputType {
  const source = context.todo.source ?? 'unknown';

  // MCP-capable sources prefer MCP for respond/review modes
  if (canWriteToSource(source) && (mode === 'respond' || mode === 'review')) {
    return 'mcp';
  }

  // Email and Slack prefer clipboard (no MCP write support currently)
  if (source === 'email' || source === 'slack') {
    return 'clipboard';
  }

  // Default to display
  return 'display';
}

/**
 * Format action results for display
 */
export function formatActionResults(actions: ActionResult[]): string {
  const lines: string[] = ['## Actions'];

  for (const action of actions) {
    const icon =
      action.status === 'completed'
        ? '\u{2705}'
        : action.status === 'pending'
          ? '\u{23F3}'
          : action.status === 'skipped'
            ? '\u{23E9}'
            : '\u{274C}';

    let line = `${icon} ${action.description}`;

    if (action.target) {
      line += ` (${action.target})`;
    }

    if (action.status === 'failed' && action.error) {
      line += ` - Error: ${action.error}`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}
