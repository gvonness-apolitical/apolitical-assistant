/**
 * Claude Invocation Helpers
 *
 * Utilities for invoking Claude through the CLI for summarization and classification.
 */

import { execSync, spawn } from 'node:child_process';

/**
 * Claude response
 */
export interface ClaudeResponse {
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Invoke Claude with a prompt and get the response
 *
 * Uses the Claude CLI (claude command) for invocation.
 */
export async function invokeClaudeSimple(prompt: string): Promise<ClaudeResponse> {
  try {
    // Use echo to pipe the prompt to claude
    const result = execSync(`echo "${prompt.replace(/"/g, '\\"')}" | claude --print`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 120000, // 2 minute timeout
    });

    return {
      content: result.trim(),
      success: true,
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Invoke Claude with a longer prompt using stdin
 */
export function invokeClaudeWithInput(prompt: string): Promise<ClaudeResponse> {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve({
          content: stdout.trim(),
          success: true,
        });
      } else {
        resolve({
          content: '',
          success: false,
          error: stderr || `Claude exited with code ${code}`,
        });
      }
    });

    claude.on('error', (error) => {
      resolve({
        content: '',
        success: false,
        error: error.message,
      });
    });

    // Write prompt and close stdin
    claude.stdin.write(prompt);
    claude.stdin.end();
  });
}

/**
 * Parse a JSON response from Claude
 */
export function parseClaudeJson<T>(response: ClaudeResponse): T | null {
  if (!response.success) {
    return null;
  }

  try {
    // Extract JSON from markdown code blocks if present
    let content = response.content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }

    return JSON.parse(content.trim()) as T;
  } catch {
    return null;
  }
}

/**
 * Summarize content using Claude
 */
export async function summarizeWithClaude(
  content: string,
  options?: {
    maxLength?: number;
    style?: 'brief' | 'detailed' | 'bullet';
    context?: string;
  }
): Promise<string> {
  const style = options?.style ?? 'brief';
  const maxLength = options?.maxLength ?? 500;

  const styleInstructions = {
    brief: 'Provide a brief, 1-2 sentence summary.',
    detailed: 'Provide a comprehensive summary covering all key points.',
    bullet: 'Provide a summary using bullet points.',
  };

  const prompt = `
${options?.context ? `Context: ${options.context}\n\n` : ''}
Summarize the following content in ${maxLength} characters or less.
${styleInstructions[style]}

Content:
${content}

Summary:`;

  const response = await invokeClaudeWithInput(prompt);

  if (!response.success) {
    // Fallback to truncation
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  return response.content;
}

/**
 * Classify content using Claude
 */
export async function classifyWithClaude<T extends string>(
  content: string,
  categories: T[],
  options?: {
    context?: string;
    returnReasoning?: boolean;
  }
): Promise<{ category: T; confidence: 'high' | 'medium' | 'low'; reasoning?: string }> {
  const prompt = `
${options?.context ? `Context: ${options.context}\n\n` : ''}
Classify the following content into one of these categories: ${categories.join(', ')}

Content:
${content}

Respond with JSON: {"category": "...", "confidence": "high|medium|low"${options?.returnReasoning ? ', "reasoning": "..."' : ''}}`;

  const response = await invokeClaudeWithInput(prompt);
  const parsed = parseClaudeJson<{ category: T; confidence: 'high' | 'medium' | 'low'; reasoning?: string }>(
    response
  );

  if (!parsed || !categories.includes(parsed.category)) {
    // Default to first category with low confidence
    return {
      category: categories[0],
      confidence: 'low',
      reasoning: options?.returnReasoning ? 'Failed to classify' : undefined,
    };
  }

  return parsed;
}

/**
 * Extract action items from content using Claude
 */
export async function extractActionItems(
  content: string,
  options?: {
    context?: string;
    maxItems?: number;
  }
): Promise<Array<{ action: string; priority: 'P0' | 'P1' | 'P2' | 'P3'; dueDate?: string }>> {
  const maxItems = options?.maxItems ?? 10;

  const prompt = `
${options?.context ? `Context: ${options.context}\n\n` : ''}
Extract up to ${maxItems} action items from the following content.
For each action item, identify:
- The action needed
- Priority (P0=critical, P1=high, P2=medium, P3=low)
- Due date if mentioned

Content:
${content}

Respond with JSON array: [{"action": "...", "priority": "P0|P1|P2|P3", "dueDate": "YYYY-MM-DD or null"}]`;

  const response = await invokeClaudeWithInput(prompt);
  const parsed = parseClaudeJson<Array<{ action: string; priority: 'P0' | 'P1' | 'P2' | 'P3'; dueDate?: string }>>(
    response
  );

  return parsed ?? [];
}
