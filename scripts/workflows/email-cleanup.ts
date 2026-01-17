#!/usr/bin/env npx tsx

/**
 * Email Cleanup Workflow
 *
 * Reviews emails and suggests cleanup actions with user confirmation.
 * This workflow:
 * 1. Analyzes recent emails to identify cleanup candidates
 * 2. Categorizes emails (archive, delete, unsubscribe)
 * 3. Presents the list to the user for review
 * 4. Only acts on confirmed items
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline';
import { notifyEmailCleanup } from '@apolitical-assistant/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

const LOGS_DIR = join(PROJECT_ROOT, 'logs');

// Ensure directories exist
mkdirSync(LOGS_DIR, { recursive: true });

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const ANALYSIS_PROMPT = `You are an email cleanup assistant for a Director of Engineering.

Analyze my inbox and identify emails that could be cleaned up. For each email, suggest one of these actions:
- ARCHIVE: Important but no longer needs inbox attention
- DELETE: Not needed (spam, outdated notifications, etc.)
- UNSUBSCRIBE: Recurring emails I don't engage with

Please search my emails from the past 7 days and return a JSON array of suggestions:

\`\`\`json
[
  {
    "id": "email_id",
    "subject": "Email subject",
    "from": "sender@example.com",
    "date": "2024-01-15",
    "action": "ARCHIVE|DELETE|UNSUBSCRIBE",
    "reason": "Brief explanation"
  }
]
\`\`\`

Focus on:
- Automated notifications that have been addressed
- Marketing emails and newsletters not engaged with
- Old thread replies that are resolved
- Calendar invites for past events
- Read receipts and automated confirmations

Be conservative - when in doubt, suggest ARCHIVE rather than DELETE.
Limit to 20 suggestions maximum.
Return ONLY the JSON array, no other text.`;

interface EmailSuggestion {
  id: string;
  subject: string;
  from: string;
  date: string;
  action: 'ARCHIVE' | 'DELETE' | 'UNSUBSCRIBE';
  reason: string;
}

async function runClaudeCommand(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print', '--output-format', 'text'], {
      cwd: PROJECT_ROOT,
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

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function reviewSuggestions(suggestions: EmailSuggestion[]): Promise<EmailSuggestion[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n========================================');
  console.log('  Email Cleanup Suggestions');
  console.log('========================================\n');

  const approved: EmailSuggestion[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i]!;
    const actionColor = {
      ARCHIVE: '\x1b[33m',  // Yellow
      DELETE: '\x1b[31m',   // Red
      UNSUBSCRIBE: '\x1b[35m', // Magenta
    }[s.action];

    console.log(`\n[${i + 1}/${suggestions.length}]`);
    console.log(`  Subject: ${s.subject}`);
    console.log(`  From: ${s.from}`);
    console.log(`  Date: ${s.date}`);
    console.log(`  ${actionColor}Action: ${s.action}\x1b[0m`);
    console.log(`  Reason: ${s.reason}`);

    const answer = await question(rl, '\n  Approve? (y/n/skip all): ');

    if (answer.toLowerCase() === 'y') {
      approved.push(s);
      console.log('  \x1b[32m✓ Approved\x1b[0m');
    } else if (answer.toLowerCase() === 'skip all') {
      console.log('\n  Skipping remaining suggestions.');
      break;
    } else {
      console.log('  \x1b[90m✗ Skipped\x1b[0m');
    }
  }

  rl.close();
  return approved;
}

async function executeCleanup(approved: EmailSuggestion[]): Promise<void> {
  if (approved.length === 0) {
    console.log('\nNo actions to execute.');
    return;
  }

  console.log(`\nExecuting ${approved.length} cleanup actions...`);

  // Group by action type
  const archives = approved.filter((s) => s.action === 'ARCHIVE');
  const deletes = approved.filter((s) => s.action === 'DELETE');
  const unsubscribes = approved.filter((s) => s.action === 'UNSUBSCRIBE');

  // Create prompt for Claude to execute the actions
  const executePrompt = `Please execute the following email cleanup actions:

${archives.length > 0 ? `
## Archive these emails (move to archive/all mail):
${archives.map((s) => `- ID: ${s.id} - "${s.subject}"`).join('\n')}
` : ''}

${deletes.length > 0 ? `
## Delete these emails (move to trash):
${deletes.map((s) => `- ID: ${s.id} - "${s.subject}"`).join('\n')}
` : ''}

${unsubscribes.length > 0 ? `
## For these emails, find and click unsubscribe if available:
${unsubscribes.map((s) => `- ID: ${s.id} - From: ${s.from} - "${s.subject}"`).join('\n')}
` : ''}

Execute these actions and report what was done.`;

  try {
    const result = await runClaudeCommand(executePrompt);
    console.log('\nCleanup Results:');
    console.log(result);
  } catch (error) {
    console.error('Error executing cleanup:', error);
  }
}

async function runEmailCleanup(): Promise<void> {
  const timestamp = getTimestamp();
  const logFile = join(LOGS_DIR, `email-cleanup-${timestamp}.log`);

  console.log('Analyzing inbox for cleanup suggestions...');
  console.log('This may take a moment.\n');

  try {
    // Get suggestions from Claude
    const response = await runClaudeCommand(ANALYSIS_PROMPT);

    // Parse the JSON response
    let suggestions: EmailSuggestion[];
    try {
      // Extract JSON from response (it might be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse suggestions. Raw response:');
      console.log(response);
      process.exit(1);
    }

    if (suggestions.length === 0) {
      console.log('No cleanup suggestions found. Your inbox looks good!');
      return;
    }

    // Send notification about suggestions
    notifyEmailCleanup(suggestions.length);

    // Review with user
    const approved = await reviewSuggestions(suggestions);

    // Log the session
    writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalSuggestions: suggestions.length,
      approved: approved.length,
      suggestions,
      approvedItems: approved,
    }, null, 2), 'utf-8');

    // Execute approved actions
    if (approved.length > 0) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const confirm = await question(
        rl,
        `\nExecute ${approved.length} cleanup actions? (yes/no): `
      );
      rl.close();

      if (confirm.toLowerCase() === 'yes') {
        await executeCleanup(approved);
      } else {
        console.log('Cleanup cancelled.');
      }
    }

    console.log(`\nSession logged to: ${logFile}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to run email cleanup:', errorMessage);

    writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      error: errorMessage,
      success: false,
    }, null, 2), 'utf-8');

    process.exit(1);
  }
}

// Check if running interactively
if (!process.stdin.isTTY) {
  console.log('Email cleanup requires interactive mode.');
  console.log('Please run directly from a terminal.');
  process.exit(1);
}

// Run the workflow
runEmailCleanup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
