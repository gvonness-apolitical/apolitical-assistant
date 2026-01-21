#!/usr/bin/env npx tsx
/**
 * Briefings CLI
 *
 * Command-line interface for generating briefings.
 *
 * Usage:
 *   npm run briefing:morning                    # Generate morning briefing
 *   npm run briefing:eod                        # Generate EOD summary
 *   npm run briefing:weekly                     # Generate weekly review
 */

import { parseArgs } from 'node:util';
import { generateMorningBriefing } from './morning.js';
import { generateEodSummary } from './eod.js';
import { generateWeeklyReview, getPreviousWeek } from './weekly.js';
import { getDateString } from '../../../packages/shared/src/workflow-utils.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      date: { type: 'string', short: 'd' },
      week: { type: 'string', short: 'w' },
      force: { type: 'boolean', short: 'f', default: false },
      'skip-notification': { type: 'boolean', default: false },
      previous: { type: 'boolean', short: 'p', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (args.values.help) {
    printHelp();
    return;
  }

  const command = args.positionals[0] || 'morning';

  switch (command) {
    case 'morning':
      await handleMorning(args);
      break;
    case 'eod':
      await handleEod(args);
      break;
    case 'weekly':
      await handleWeekly(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * Handle morning briefing command
 */
async function handleMorning(args: ReturnType<typeof parseArgs>): Promise<void> {
  const date = args.values.date as string | undefined;
  const force = args.values.force as boolean;
  const skipNotification = args.values['skip-notification'] as boolean;

  try {
    const briefing = await generateMorningBriefing({
      date: date || getDateString(),
      force,
      skipNotification,
    });

    console.log(`\nMorning briefing generated: ${briefing.filePath}`);

    if (briefing.collectionStatus) {
      console.log('\nData collection status:');
      for (const status of briefing.collectionStatus) {
        const icon = status.status === 'success' ? '✓' : status.status === 'partial' ? '⚠' : '✗';
        const count = status.itemCount !== undefined ? ` (${status.itemCount} items)` : '';
        console.log(`  ${icon} ${status.source}${count}`);
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate morning briefing:', errorMessage);
    process.exit(1);
  }
}

/**
 * Handle EOD summary command
 */
async function handleEod(args: ReturnType<typeof parseArgs>): Promise<void> {
  const date = args.values.date as string | undefined;
  const force = args.values.force as boolean;
  const skipNotification = args.values['skip-notification'] as boolean;

  try {
    const summary = await generateEodSummary({
      date: date || getDateString(),
      force,
      skipNotification,
    });

    console.log(`\nEOD summary generated: ${summary.filePath}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate EOD summary:', errorMessage);
    process.exit(1);
  }
}

/**
 * Handle weekly review command
 */
async function handleWeekly(args: ReturnType<typeof parseArgs>): Promise<void> {
  let week = args.values.week as string | undefined;
  const force = args.values.force as boolean;
  const skipNotification = args.values['skip-notification'] as boolean;
  const previous = args.values.previous as boolean;

  // If --previous flag is set, use previous week
  if (previous && !week) {
    week = getPreviousWeek();
  }

  try {
    const review = await generateWeeklyReview({
      week,
      force,
      skipNotification,
    });

    console.log(`\nWeekly review generated: ${review.filePath}`);

    if (review.todos) {
      console.log('\nTODO Stats:');
      console.log(`  Completed this week: ${review.todos.other.length}`);
      console.log(`  High priority active: ${review.todos.highPriority.length}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate weekly review:', errorMessage);
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Briefings CLI

Usage:
  npm run briefing:morning [options]     Generate morning briefing
  npm run briefing:eod [options]         Generate end-of-day summary
  npm run briefing:weekly [options]      Generate weekly review

Options:
  -d, --date=DATE           Date for briefing (YYYY-MM-DD, default: today)
  -w, --week=WEEK           Week for review (YYYY-Www, default: current week)
  -f, --force               Regenerate even if exists
  -p, --previous            Use previous week (for weekly)
  --skip-notification       Don't send desktop notification
  -h, --help                Show this help message

Examples:
  npm run briefing:morning
  npm run briefing:morning -- --force
  npm run briefing:morning -- --date=2025-01-15
  npm run briefing:eod
  npm run briefing:eod -- --date=2025-01-15
  npm run briefing:weekly
  npm run briefing:weekly -- --previous
  npm run briefing:weekly -- --week=2025-W03
`);
}

// Run CLI
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
