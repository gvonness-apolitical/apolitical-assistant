#!/usr/bin/env tsx
/**
 * Summaries CLI
 *
 * Command-line interface for the summaries module.
 *
 * Usage:
 *   npm run summary:daily -- 2025-01-15
 *   npm run summary:weekly -- 2025-W03
 *   npm run summary:monthly -- 2025-01 --deps
 *   npm run summary:diff -- 2025-W02 2025-W03
 *   npm run summary:search -- "incident"
 */

import type { SummaryFidelity } from './types.js';
import { generateSummary } from './generate.js';
import { loadSummary, listSummaries } from './config.js';
import { compareSummaries, generateDiffMarkdown } from './diff.js';
import { getCurrentPeriod, getPreviousPeriod, formatPeriod } from './periods.js';

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string | boolean> } {
  const command = args[0] ?? 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? true;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function printUsage(): void {
  console.log(`
Summaries CLI - Generate and manage summaries

Usage:
  npm run summary:<fidelity> -- [period] [options]

Commands:
  daily <YYYY-MM-DD>       Generate daily summary
  weekly <YYYY-Www>        Generate weekly summary
  monthly <YYYY-MM>        Generate monthly summary
  quarterly <YYYY-Qn>      Generate quarterly summary
  h1-h2 <YYYY-Hn>          Generate half-year summary
  yearly <YYYY>            Generate yearly summary
  diff <period1> <period2> Compare two summaries
  search <query>           Search past summaries
  list                     List available summaries

Options:
  --deps          Generate missing dependencies first
  --force         Regenerate even if exists
  --verbose       Show detailed progress
  --dry-run       Show what would be generated
  --previous      Generate for previous period
  --export=TYPE   Export format (markdown, notion, email, slack)
  --target=ID     Export target (page ID, email, channel)

Examples:
  npm run summary:daily -- 2025-01-15
  npm run summary:weekly -- 2025-W03 --deps
  npm run summary:monthly -- 2025-01 --deps --verbose
  npm run summary:diff -- 2025-W02 2025-W03
`);
}

async function handleGenerate(
  fidelity: SummaryFidelity,
  positional: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  let period = positional[0];

  // Handle --previous flag
  if (flags.previous) {
    const currentPeriod = period ?? getCurrentPeriod(fidelity);
    period = getPreviousPeriod(fidelity, currentPeriod);
  }

  // Default to current period if not specified
  if (!period) {
    period = getCurrentPeriod(fidelity);
  }

  console.log(`Generating ${fidelity} summary for ${period}...`);

  const result = await generateSummary({
    fidelity,
    period,
    force: flags.force === true,
    deps: flags.deps === true,
    verbose: flags.verbose === true,
    dryRun: flags['dry-run'] === true,
  });

  if (flags['dry-run']) {
    console.log('\n[Dry run - no files written]');
    return;
  }

  console.log(`\nSummary generated: ${result.document.filePath}`);
  console.log(`- Total items: ${result.document.stats.totalItems}`);
  console.log(`- Engineering: ${result.document.stats.byCategory.engineering ?? 0}`);
  console.log(`- Management: ${result.document.stats.byCategory.management ?? 0}`);
  console.log(`- Business: ${result.document.stats.byCategory.business ?? 0}`);

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.collectionStatus.length > 0) {
    const failed = result.collectionStatus.filter((s) => s.status === 'failed');
    if (failed.length > 0) {
      console.log('\nFailed collectors:');
      for (const status of failed) {
        console.log(`  - ${status.source}: ${status.error}`);
      }
    }
  }
}

function handleDiff(positional: string[], _flags: Record<string, string | boolean>): void {
  if (positional.length < 2) {
    console.error('Error: diff requires two periods');
    console.log('Usage: npm run summary:diff -- <period1> <period2>');
    process.exit(1);
  }

  const [period1, period2] = positional;

  // Infer fidelity from period format
  let fidelity: SummaryFidelity;
  if (period1.match(/^\d{4}-\d{2}-\d{2}$/)) {
    fidelity = 'daily';
  } else if (period1.match(/^\d{4}-W\d{2}$/)) {
    fidelity = 'weekly';
  } else if (period1.match(/^\d{4}-\d{2}$/)) {
    fidelity = 'monthly';
  } else if (period1.match(/^\d{4}-Q[1-4]$/)) {
    fidelity = 'quarterly';
  } else if (period1.match(/^\d{4}-H[12]$/)) {
    fidelity = 'h1-h2';
  } else if (period1.match(/^\d{4}$/)) {
    fidelity = 'yearly';
  } else {
    console.error('Error: Could not determine fidelity from period format');
    process.exit(1);
  }

  const diff = compareSummaries(fidelity, period1, period2);

  if (!diff) {
    console.error('Error: Could not load one or both summaries');
    process.exit(1);
  }

  console.log(generateDiffMarkdown(diff));
}

function handleSearch(positional: string[], _flags: Record<string, string | boolean>): void {
  const query = positional.join(' ').toLowerCase();

  if (!query) {
    console.error('Error: search requires a query');
    process.exit(1);
  }

  console.log(`Searching for: "${query}"\n`);

  const fidelities: SummaryFidelity[] = ['daily', 'weekly', 'monthly', 'quarterly', 'h1-h2', 'yearly'];
  let foundCount = 0;

  for (const fidelity of fidelities) {
    const periods = listSummaries(fidelity);

    for (const period of periods.slice(0, 10)) {
      const summary = loadSummary(fidelity, period);
      if (!summary) continue;

      const allItems = [...summary.engineering, ...summary.management, ...summary.business];
      const matches = allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      );

      if (matches.length > 0) {
        console.log(`\n${fidelity} ${period}:`);
        for (const match of matches) {
          console.log(`  - [${match.priority}] ${match.title}`);
        }
        foundCount += matches.length;
      }
    }
  }

  if (foundCount === 0) {
    console.log('No matches found');
  } else {
    console.log(`\nFound ${foundCount} matches`);
  }
}

function handleList(flags: Record<string, string | boolean>): void {
  const fidelities: SummaryFidelity[] = ['daily', 'weekly', 'monthly', 'quarterly', 'h1-h2', 'yearly'];

  for (const fidelity of fidelities) {
    const periods = listSummaries(fidelity);

    if (periods.length === 0) continue;

    console.log(`\n${fidelity.toUpperCase()}:`);

    const toShow = flags.all ? periods : periods.slice(0, 5);
    for (const period of toShow) {
      const summary = loadSummary(fidelity, period);
      if (summary) {
        console.log(`  ${period} - ${summary.stats.totalItems} items (${formatPeriod(fidelity, period)})`);
      }
    }

    if (!flags.all && periods.length > 5) {
      console.log(`  ... and ${periods.length - 5} more`);
    }
  }
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || flags.h || command === 'help') {
    printUsage();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'daily':
        await handleGenerate('daily', positional, flags);
        break;
      case 'weekly':
        await handleGenerate('weekly', positional, flags);
        break;
      case 'monthly':
        await handleGenerate('monthly', positional, flags);
        break;
      case 'quarterly':
        await handleGenerate('quarterly', positional, flags);
        break;
      case 'h1-h2':
        await handleGenerate('h1-h2', positional, flags);
        break;
      case 'yearly':
        await handleGenerate('yearly', positional, flags);
        break;
      case 'diff':
        handleDiff(positional, flags);
        break;
      case 'search':
        handleSearch(positional, flags);
        break;
      case 'list':
        handleList(flags);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
