#!/usr/bin/env npx tsx
/**
 * Meetings CLI
 *
 * Command-line interface for meeting preparation.
 *
 * Usage:
 *   npm run meeting:prep                       # Prep all meetings today
 *   npm run meeting:prep -- --date=2025-01-20  # Prep for specific date
 *   npm run meeting:prep -- --event-id=abc123  # Prep specific meeting
 *   npm run meeting:121 -- john@company.com    # Generate 1:1 script for person
 *   npm run meeting:agenda -- --event-id=abc  # Generate agenda for meeting
 */

import { parseArgs } from 'node:util';
import type { CalendarEvent, DirectReport, MeetingPrep } from './types.js';
import {
  loadMeetingConfig,
  ensureDirectories,
  meetingPrepExists,
  oneOnOnePrepExists,
} from './config.js';
import { detectMeetingType, isLeadingMeeting } from './detect.js';
import { generateAgenda } from './agenda.js';
import { generate121Script } from './one-on-one.js';
import { saveMeetingPrep, formatDailyMeetingOverview } from './markdown.js';

// Default user email - should be configured
const MY_EMAIL = process.env.USER_EMAIL || 'me@company.com';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      date: { type: 'string', short: 'd' },
      'event-id': { type: 'string', short: 'e' },
      email: { type: 'string' },
      force: { type: 'boolean', short: 'f', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (args.values.help) {
    printHelp();
    return;
  }

  const command = args.positionals[0] || 'prep';

  switch (command) {
    case 'prep':
      await handlePrep(args);
      break;
    case 'one-on-one':
    case '121':
      await handleOneOnOne(args);
      break;
    case 'agenda':
      await handleAgenda(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * Handle prep command - prepare all meetings for a day
 */
async function handlePrep(args: ReturnType<typeof parseArgs>): Promise<void> {
  const date = args.values.date || new Date().toISOString().split('T')[0];
  const eventId = args.values['event-id'] as string | undefined;
  const force = args.values.force as boolean;
  const verbose = args.values.verbose as boolean;
  const dryRun = args.values['dry-run'] as boolean;

  ensureDirectories();

  console.log(`Preparing meetings for ${date}...`);

  // Get calendar events for the day
  const events = await getCalendarEvents(date, eventId);

  if (events.length === 0) {
    console.log('No meetings found.');
    return;
  }

  console.log(`Found ${events.length} meeting(s)`);

  // Get direct reports for 1:1 detection
  const directReports = await getDirectReports();

  const preps: MeetingPrep[] = [];

  for (const event of events) {
    if (verbose) {
      console.log(`\nProcessing: ${event.title}`);
    }

    const meetingType = await detectMeetingType(event, directReports, MY_EMAIL);

    if (verbose) {
      console.log(`  Type: ${meetingType}`);
      console.log(`  Leading: ${isLeadingMeeting(event, MY_EMAIL)}`);
    }

    // Check if prep already exists
    const exists = meetingType === 'one-on-one'
      ? oneOnOnePrepExists(date, event.attendees.find(a => a.email !== MY_EMAIL)?.email || '')
      : meetingPrepExists(date, event.id);

    if (exists && !force) {
      console.log(`  Skipping (prep exists, use --force to regenerate)`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate ${meetingType} prep`);
      continue;
    }

    // Generate prep based on meeting type
    let prep: MeetingPrep;

    if (meetingType === 'one-on-one') {
      const attendeeEmail = event.attendees.find(a => a.email !== MY_EMAIL)?.email;
      if (attendeeEmail) {
        prep = await generate121Script(event, attendeeEmail, directReports, MY_EMAIL);
      } else {
        prep = await generateAgenda(event, directReports, MY_EMAIL);
      }
    } else {
      prep = await generateAgenda(event, directReports, MY_EMAIL);
    }

    // Save the prep
    saveMeetingPrep(prep);
    preps.push(prep);

    console.log(`  Generated: ${prep.filePath}`);
  }

  // Print daily overview
  if (preps.length > 0 && !dryRun) {
    console.log('\n' + formatDailyMeetingOverview(preps));
  }

  console.log(`\nDone! Generated ${preps.length} meeting prep(s).`);
}

/**
 * Handle one-on-one command - generate 1:1 script for specific person
 */
async function handleOneOnOne(args: ReturnType<typeof parseArgs>): Promise<void> {
  const email = args.values.email as string || args.positionals[1];
  const date = args.values.date || new Date().toISOString().split('T')[0];
  const force = args.values.force as boolean;
  const dryRun = args.values['dry-run'] as boolean;

  if (!email) {
    console.error('Error: Email address required');
    console.error('Usage: npm run meeting:121 -- user@company.com');
    process.exit(1);
  }

  ensureDirectories();

  console.log(`Generating 1:1 script for ${email}...`);

  // Check if prep exists
  if (oneOnOnePrepExists(date, email) && !force) {
    console.log('Prep already exists. Use --force to regenerate.');
    return;
  }

  if (dryRun) {
    console.log('[DRY RUN] Would generate 1:1 script');
    return;
  }

  // Get direct reports
  const directReports = await getDirectReports();

  // Create a synthetic calendar event for manual 1:1 prep
  const now = new Date();
  const event: CalendarEvent = {
    id: `manual-121-${email}-${date}`,
    title: `1:1 with ${email}`,
    startTime: now.toISOString(),
    endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    attendees: [
      { email: MY_EMAIL, name: 'Me', responseStatus: 'accepted' },
      { email, name: email.split('@')[0], responseStatus: 'accepted' },
    ],
    isRecurring: false,
  };

  const prep = await generate121Script(event, email, directReports, MY_EMAIL);
  saveMeetingPrep(prep);

  console.log(`Generated: ${prep.filePath}`);
}

/**
 * Handle agenda command - generate agenda for specific meeting
 */
async function handleAgenda(args: ReturnType<typeof parseArgs>): Promise<void> {
  const eventId = args.values['event-id'] as string;
  const date = args.values.date || new Date().toISOString().split('T')[0];
  const force = args.values.force as boolean;
  const dryRun = args.values['dry-run'] as boolean;

  if (!eventId) {
    console.error('Error: Event ID required');
    console.error('Usage: npm run meeting:agenda -- --event-id=abc123');
    process.exit(1);
  }

  ensureDirectories();

  console.log(`Generating agenda for event ${eventId}...`);

  // Check if prep exists
  if (meetingPrepExists(date, eventId) && !force) {
    console.log('Prep already exists. Use --force to regenerate.');
    return;
  }

  if (dryRun) {
    console.log('[DRY RUN] Would generate agenda');
    return;
  }

  // Get the calendar event
  const events = await getCalendarEvents(date, eventId);

  if (events.length === 0) {
    console.error('Event not found');
    process.exit(1);
  }

  const event = events[0];
  const directReports = await getDirectReports();

  const prep = await generateAgenda(event, directReports, MY_EMAIL);
  saveMeetingPrep(prep);

  console.log(`Generated: ${prep.filePath}`);
}

/**
 * Get calendar events for a date
 * TODO: Implement via MCP calendar integration
 */
async function getCalendarEvents(
  date: string,
  eventId?: string
): Promise<CalendarEvent[]> {
  // TODO: Implement calendar event fetching via MCP
  // For now, return empty array - actual implementation would use:
  // mcp__google__calendar_list_events({ timeMin: date, timeMax: nextDay })

  console.log(`[Placeholder] Would fetch calendar events for ${date}`);

  if (eventId) {
    console.log(`  Filtering for event ID: ${eventId}`);
  }

  return [];
}

/**
 * Get direct reports from config or Humaans
 * TODO: Implement via MCP Humaans integration
 */
async function getDirectReports(): Promise<DirectReport[]> {
  const config = loadMeetingConfig();

  // Use configured direct reports
  if (config.directReports.length > 0) {
    return config.directReports;
  }

  // TODO: Fetch from Humaans via MCP
  // const orgChart = await mcp__humaans__humaans_get_org_chart();
  // return orgChart.filter(e => e.managerId === myId);

  return [];
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Meeting Preparation CLI

Usage:
  npm run meeting:prep [options]              Prepare all meetings for today
  npm run meeting:121 <email> [options]       Generate 1:1 script for person
  npm run meeting:agenda --event-id=ID        Generate agenda for meeting

Options:
  -d, --date=DATE        Date to prepare (YYYY-MM-DD, default: today)
  -e, --event-id=ID      Specific event ID to prepare
  --email=EMAIL          Email for 1:1 prep
  -f, --force            Regenerate even if prep exists
  -v, --verbose          Show detailed output
  --dry-run              Show what would be done without doing it
  -h, --help             Show this help message

Examples:
  npm run meeting:prep
  npm run meeting:prep -- --date=2025-01-20
  npm run meeting:prep -- --event-id=abc123 --force
  npm run meeting:121 -- john@company.com
  npm run meeting:121 -- --email=john@company.com --date=2025-01-20
  npm run meeting:agenda -- --event-id=abc123
`);
}

// Run CLI
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
