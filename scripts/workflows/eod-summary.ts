#!/usr/bin/env npx tsx

/**
 * End of Day Summary Workflow
 *
 * Generates a summary of the day's activities and prepares for tomorrow.
 * The summary includes:
 * - What was accomplished today
 * - Meetings attended and key takeaways
 * - Communications summary
 * - Carryover items for tomorrow
 * - Tomorrow's preview
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notifyEODSummary } from '../../packages/shared/src/notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

const OUTPUT_DIR = join(PROJECT_ROOT, 'output/briefings');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');

// Ensure directories exist
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });

function getDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0]!;
}

const EOD_PROMPT = `You are an executive assistant for the Director of Engineering. Generate an end-of-day summary for today.

Please gather information and create a summary with the following sections:

## ✅ Accomplished Today
- Review my calendar to list meetings I attended today
- Check my email sent folder for key communications
- Note any PRs I reviewed or merged
- List any todos I completed

## 📝 Meeting Highlights
- For each meeting attended today, provide:
  - Meeting name and attendees
  - Key decisions made
  - Action items that came out of it
  - Any follow-ups needed

## 📬 Communication Summary
- Important emails sent/received
- Key Slack conversations
- Any decisions communicated

## 🚨 Incidents Update
- Status of any incidents that were active today
- Any new incidents that occurred
- Follow-ups completed or still pending

## 📋 Carryover Items
- Tasks that didn't get completed today
- Items that need attention tomorrow
- Any blockers to address

## 🔮 Tomorrow Preview
- Preview of tomorrow's calendar
- Key meetings to prepare for
- Suggested priorities for tomorrow

## 💭 Notes & Reflections
- Any patterns noticed today
- Process improvements to consider
- Things to remember

Format as clean markdown. Focus on capturing important context that will be useful when starting tomorrow.`;

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

async function generateEODSummary(): Promise<void> {
  const dateString = getDateString();
  const timestamp = getTimestamp();
  const outputFile = join(OUTPUT_DIR, `eod-summary-${dateString}.md`);
  const logFile = join(LOGS_DIR, `eod-summary-${timestamp}.log`);

  console.log(`Generating end-of-day summary for ${dateString}...`);

  try {
    // Check if summary already exists for today
    if (existsSync(outputFile)) {
      console.log(`EOD summary already exists for ${dateString}: ${outputFile}`);
      console.log('Use --force to regenerate.');
      if (!process.argv.includes('--force')) {
        notifyEODSummary(outputFile);
        return;
      }
      console.log('Regenerating...');
    }

    // Check for morning briefing to provide context
    const morningBriefingFile = join(OUTPUT_DIR, `briefing-${dateString}.md`);
    let contextNote = '';
    if (existsSync(morningBriefingFile)) {
      const morningBriefing = readFileSync(morningBriefingFile, 'utf-8');
      contextNote = `\n\nFor context, here was the morning briefing:\n\n${morningBriefing}`;
    }

    // Run Claude with the EOD prompt
    const summaryContent = await runClaudeCommand(EOD_PROMPT + contextNote);

    // Calculate day stats (placeholder - would integrate with actual tracking)
    const dayStats = {
      meetings: 'Review calendar for count',
      emailsSent: 'Review sent folder',
      prsReviewed: 'Check GitHub activity',
    };

    // Add header with metadata
    const fullSummary = `# End of Day Summary - ${dateString}

Generated: ${new Date().toLocaleString()}

---

${summaryContent}

---

## 📊 Day Statistics
- Meetings: Check calendar
- Emails: Check activity
- Code Reviews: Check GitHub

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
    notifyEODSummary(outputFile);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate EOD summary:', errorMessage);

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
generateEODSummary().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
