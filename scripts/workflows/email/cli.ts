#!/usr/bin/env npx tsx
/**
 * Email Triage CLI
 *
 * Command-line interface for email triage and classification.
 *
 * Usage:
 *   npm run email:triage                         # Start interactive triage
 *   npm run email:triage -- --auto-delete        # Auto-delete high confidence
 *   npm run email:triage -- --since=yesterday    # Triage since yesterday
 *   npm run email:rules                          # Show classification rules
 *   npm run email:rules -- add                   # Add custom rule
 *   npm run email:stats                          # Show feedback statistics
 */

import { parseArgs } from 'node:util';
import type { Email } from './types.js';
import {
  loadEmailTriageConfig,
  loadClassificationRules,
  ensureDirectories,
} from './config.js';
import {
  createTriageSession,
  formatSessionForDisplay,
  getActionRecommendations,
  getSessionSummary,
  completeSession,
} from './triage.js';
import {
  deleteHighConfidenceEmails,
  archiveHighConfidenceEmails,
  createTodosForRespondEmails,
  getActionSummary,
} from './actions.js';
import { formatFeedbackAnalysis, getFeedbackStats } from './learn.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      since: { type: 'string', short: 's' },
      query: { type: 'string', short: 'q' },
      'auto-delete': { type: 'boolean', default: false },
      'auto-archive': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (args.values.help) {
    printHelp();
    return;
  }

  const command = args.positionals[0] || 'triage';

  switch (command) {
    case 'triage':
      await handleTriage(args);
      break;
    case 'rules':
      await handleRules(args);
      break;
    case 'stats':
      await handleStats(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * Handle triage command
 */
async function handleTriage(args: ReturnType<typeof parseArgs>): Promise<void> {
  const since = args.values.since as string | undefined;
  const query = args.values.query as string | undefined;
  const autoDelete = args.values['auto-delete'] as boolean;
  const autoArchive = args.values['auto-archive'] as boolean;
  const dryRun = args.values['dry-run'] as boolean;
  const verbose = args.values.verbose as boolean;

  ensureDirectories();

  console.log('Starting email triage...');
  if (verbose) {
    console.log(`  Since: ${since || 'all unread'}`);
    console.log(`  Query: ${query || 'is:unread'}`);
    console.log(`  Auto-delete: ${autoDelete}`);
    console.log(`  Auto-archive: ${autoArchive}`);
    console.log(`  Dry run: ${dryRun}`);
  }

  // Fetch emails
  const gmailQuery = buildGmailQuery(query, since);
  const emails = await fetchEmails(gmailQuery);

  if (emails.length === 0) {
    console.log('No emails found matching query.');
    return;
  }

  console.log(`Found ${emails.length} email(s)`);

  // Create triage session
  const session = await createTriageSession(emails, gmailQuery);

  // Display session
  console.log('\n' + formatSessionForDisplay(session));

  // Get recommendations
  const recommendations = getActionRecommendations(session);

  if (dryRun) {
    console.log('\n[DRY RUN] Would perform the following actions:');

    if (autoDelete && recommendations.autoDelete.length > 0) {
      console.log(`  - Delete ${recommendations.autoDelete.length} emails`);
    }
    if (autoArchive && recommendations.autoArchive.length > 0) {
      console.log(`  - Archive ${recommendations.autoArchive.length} emails`);
    }
    if (recommendations.createTodos.length > 0) {
      console.log(`  - Create ${recommendations.createTodos.length} TODOs`);
    }

    return;
  }

  // Execute auto-actions
  if (autoDelete && recommendations.autoDelete.length > 0) {
    console.log(`\nDeleting ${recommendations.autoDelete.length} high-confidence delete emails...`);
    const deleteResults = await deleteHighConfidenceEmails(recommendations.autoDelete);
    console.log(getActionSummary(deleteResults));
  }

  if (autoArchive && recommendations.autoArchive.length > 0) {
    console.log(`\nArchiving ${recommendations.autoArchive.length} high-confidence archive emails...`);
    const archiveResults = await archiveHighConfidenceEmails(recommendations.autoArchive);
    console.log(getActionSummary(archiveResults));
  }

  // Create TODOs for respond emails
  if (recommendations.createTodos.length > 0) {
    console.log(`\nCreating ${recommendations.createTodos.length} TODOs for respond emails...`);
    const todoResults = await createTodosForRespondEmails(recommendations.createTodos);
    console.log(getActionSummary(todoResults));
  }

  // Complete session
  const completedSession = completeSession(session);
  console.log('\n' + getSessionSummary(completedSession));
}

/**
 * Handle rules command
 */
async function handleRules(args: ReturnType<typeof parseArgs>): Promise<void> {
  const subcommand = args.positionals[1];
  const verbose = args.values.verbose as boolean;

  const rules = loadClassificationRules();

  if (subcommand === 'add') {
    console.log('Adding custom rules via CLI is not yet implemented.');
    console.log('Edit email/rules/custom.json directly.');
    return;
  }

  console.log(`## Classification Rules (${rules.length} total)`);
  console.log('');

  // Group by category
  const byCategory = new Map<string, typeof rules>();
  for (const rule of rules) {
    const category = rule.category;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(rule);
  }

  for (const [category, categoryRules] of byCategory) {
    console.log(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);

    for (const rule of categoryRules) {
      const status = rule.enabled ? '✓' : '✗';
      console.log(`  ${status} **${rule.name}** [${rule.confidence}]`);

      if (verbose) {
        console.log(`      ID: ${rule.id}`);
        console.log(`      Priority: ${rule.priority}`);
        if (rule.description) {
          console.log(`      Description: ${rule.description}`);
        }
        if (rule.conditions.from) {
          console.log(`      From: ${rule.conditions.from.join(', ')}`);
        }
        if (rule.conditions.subject) {
          console.log(`      Subject: ${rule.conditions.subject.join(', ')}`);
        }
        console.log('');
      }
    }

    console.log('');
  }
}

/**
 * Handle stats command
 */
async function handleStats(_args: ReturnType<typeof parseArgs>): Promise<void> {
  const stats = getFeedbackStats();

  console.log(`## Email Triage Statistics`);
  console.log('');
  console.log(`**Total Feedback:** ${stats.total}`);
  console.log(`**Correction Rate:** ${Math.round(stats.correctionRate * 100)}%`);
  console.log('');

  if (stats.total > 0) {
    console.log(`### By Predicted Category`);
    for (const [category, count] of Object.entries(stats.byPredictedCategory)) {
      if (count > 0) {
        console.log(`  - ${category}: ${count}`);
      }
    }
    console.log('');

    console.log(`### By Actual Category`);
    for (const [category, count] of Object.entries(stats.byActualCategory)) {
      if (count > 0) {
        console.log(`  - ${category}: ${count}`);
      }
    }
    console.log('');
  }

  // Show feedback analysis
  if (stats.total >= 5) {
    console.log(formatFeedbackAnalysis());
  }
}

/**
 * Build Gmail query from options
 */
function buildGmailQuery(query?: string, since?: string): string {
  const config = loadEmailTriageConfig();
  let gmailQuery = query || config.defaultQuery;

  if (since) {
    const sinceDate = parseSinceDate(since);
    if (sinceDate) {
      gmailQuery += ` after:${sinceDate}`;
    }
  }

  return gmailQuery;
}

/**
 * Parse since date string
 */
function parseSinceDate(since: string): string | null {
  const now = new Date();

  switch (since.toLowerCase()) {
    case 'today':
      return formatGmailDate(now);
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return formatGmailDate(yesterday);
    }
    case 'week':
    case 'this-week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return formatGmailDate(weekAgo);
    }
    default: {
      // Try parsing as date
      const parsed = new Date(since);
      if (!isNaN(parsed.getTime())) {
        return formatGmailDate(parsed);
      }
      return null;
    }
  }
}

/**
 * Format date for Gmail query
 */
function formatGmailDate(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Fetch emails from Gmail
 * TODO: Implement via MCP Gmail integration
 */
async function fetchEmails(_query: string): Promise<Email[]> {
  // TODO: Implement via MCP Gmail integration
  // const results = await mcp__google__gmail_search({ query, maxResults: config.maxResults });
  // return results.messages.map(m => parseGmailMessage(m));

  console.log(`[Placeholder] Would fetch emails with query: ${_query}`);

  // Return empty array for now
  return [];
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Email Triage CLI

Usage:
  npm run email:triage [options]       Start email triage session
  npm run email:rules [subcommand]     Manage classification rules
  npm run email:stats                  Show feedback statistics

Triage Options:
  -s, --since=DATE         Filter emails since date (today, yesterday, week, YYYY-MM-DD)
  -q, --query=QUERY        Gmail search query (default: is:unread)
  --auto-delete            Auto-delete high-confidence delete emails
  --auto-archive           Auto-archive high-confidence archive emails
  --dry-run                Show what would be done without doing it
  -v, --verbose            Show detailed output
  -h, --help               Show this help message

Rules Subcommands:
  (none)                   List all rules
  add                      Add a custom rule (interactive)

Examples:
  npm run email:triage
  npm run email:triage -- --since=yesterday --auto-archive
  npm run email:triage -- --query="is:unread from:github.com" --auto-delete
  npm run email:rules
  npm run email:rules -- --verbose
  npm run email:stats
`);
}

// Run CLI
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
