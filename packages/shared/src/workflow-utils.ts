/**
 * Shared utilities for workflow scripts
 *
 * Common functions used across morning-briefing, email-cleanup, and eod-summary workflows.
 */

import { spawn } from 'node:child_process';

export interface RunClaudeOptions {
  timeout?: number;
  cwd?: string;
}

/**
 * Get current date as ISO date string (YYYY-MM-DD)
 */
export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * Get timestamp string for log files (ISO format with colons/periods replaced)
 */
export function getTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Run a Claude command and return the output
 */
export async function runClaudeCommand(
  prompt: string,
  options: RunClaudeOptions = {}
): Promise<string> {
  const { cwd = process.cwd() } = options;

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print', '--output-format', 'text'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    claude.on('error', (err) => {
      reject(err);
    });

    claude.stdin.write(prompt);
    claude.stdin.end();
  });
}
