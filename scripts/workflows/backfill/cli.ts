#!/usr/bin/env tsx
/**
 * Backfill CLI
 *
 * Command-line interface for the backfill infrastructure.
 *
 * Usage:
 *   npm run backfill -- --from=2024-10-01
 *   npm run backfill -- --from=2024-10-01 --to=2024-12-31
 *   npm run backfill -- --from=2024-10-01 --source=slack
 *   npm run backfill -- --from=2024-10-01 --dry-run
 *   npm run backfill -- --resume
 *   npm run backfill -- --status
 *   npm run backfill -- --reset
 */

import { runBackfill, getBackfillStatus, resetBackfillProgress } from './index.js';

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result[key] = value ?? true;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Backfill CLI - Populate historical data from collectors

Usage:
  npm run backfill -- [options]

Options:
  --from=DATE       Start date (YYYY-MM-DD) for backfill (required unless --resume or --status)
  --to=DATE         End date (YYYY-MM-DD), defaults to today
  --source=SOURCE   Only backfill specific source(s), comma-separated
  --delay=MS        Delay between collectors in milliseconds (default: 1000)
  --dry-run         Show what would be collected without actually doing it
  --resume          Resume from last progress
  --verbose         Show detailed progress
  --status          Show current backfill progress
  --reset           Reset all backfill progress
  --reset=SOURCE    Reset progress for specific source

Examples:
  npm run backfill -- --from=2024-10-01
  npm run backfill -- --from=2024-10-01 --to=2024-12-31 --verbose
  npm run backfill -- --from=2024-10-01 --source=slack,email
  npm run backfill -- --resume --verbose
  npm run backfill -- --status
  npm run backfill -- --reset=slack
`);
}

function printStatus(): void {
  const progress = getBackfillStatus();

  if (Object.keys(progress).length === 0) {
    console.log('No backfill progress recorded yet.');
    return;
  }

  console.log('\n=== Backfill Progress ===\n');

  for (const [source, entry] of Object.entries(progress)) {
    console.log(`[${source}]`);
    console.log(`  Last completed: ${entry.lastCompletedDate}`);
    console.log(`  Items collected: ${entry.itemsCollected}`);
    console.log(`  Errors: ${entry.errors}`);
    console.log(`  Started: ${new Date(entry.startedAt).toLocaleString()}`);
    console.log(`  Updated: ${new Date(entry.updatedAt).toLocaleString()}`);
    console.log('');
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Help
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  // Status
  if (args.status) {
    printStatus();
    process.exit(0);
  }

  // Reset
  if (args.reset) {
    const source = typeof args.reset === 'string' ? args.reset : undefined;
    resetBackfillProgress(source as any);
    console.log(source ? `Reset progress for ${source}` : 'Reset all backfill progress');
    process.exit(0);
  }

  // Validate required arguments
  if (!args.from && !args.resume) {
    console.error('Error: --from=DATE is required (or use --resume)');
    printUsage();
    process.exit(1);
  }

  // Parse arguments
  const fromDate = args.from as string ?? '2024-10-01'; // Default if resuming
  const toDate = args.to as string;
  const sources = typeof args.source === 'string' ? args.source.split(',') : undefined;
  const delayMs = typeof args.delay === 'string' ? parseInt(args.delay, 10) : undefined;
  const dryRun = args['dry-run'] === true;
  const resume = args.resume === true;
  const verbose = args.verbose === true;

  try {
    const result = await runBackfill({
      fromDate,
      toDate,
      sources,
      delayMs,
      dryRun,
      resume,
      verbose,
    });

    if (!verbose) {
      console.log(`\nBackfill complete: ${result.totalItems} items, ${result.totalErrors} errors`);
    }

    process.exit(result.totalErrors > 0 ? 1 : 0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main();
