/**
 * TODO Collectors Index
 *
 * Exports all available collectors and provides a factory function.
 */

import type { TodoCollector } from './types.js';
import { GitHubCollector } from './github.js';
import { LinearCollector } from './linear.js';
import { EmailCollector } from './email.js';
import { SlackCollector } from './slack.js';
import { GoogleDocsCollector } from './google-docs.js';
import { GoogleSlidesCollector } from './google-slides.js';
import { NotionCollector } from './notion.js';
import { HumaansCollector } from './humaans.js';
import { GeminiNotesCollector } from './gemini-notes.js';
import { DevAnalyticsCollector } from './dev-analytics.js';
import { CalendarCollector } from './calendar.js';
import { IncidentIoCollector } from './incident-io.js';

export * from './types.js';
export * from './config.js';

export { GitHubCollector } from './github.js';
export { LinearCollector } from './linear.js';
export { EmailCollector } from './email.js';
export { SlackCollector } from './slack.js';
export { GoogleDocsCollector } from './google-docs.js';
export { GoogleSlidesCollector } from './google-slides.js';
export { NotionCollector } from './notion.js';
export { HumaansCollector } from './humaans.js';
export { GeminiNotesCollector } from './gemini-notes.js';
export { DevAnalyticsCollector } from './dev-analytics.js';
export { CalendarCollector } from './calendar.js';
export { IncidentIoCollector } from './incident-io.js';

/**
 * Get all available collectors.
 */
export function getAllCollectors(): TodoCollector[] {
  return [
    new GitHubCollector(),
    new LinearCollector(),
    new EmailCollector(),
    new SlackCollector(),
    new GoogleDocsCollector(),
    new GoogleSlidesCollector(),
    new NotionCollector(),
    new HumaansCollector(),
    new GeminiNotesCollector(),
    new DevAnalyticsCollector(),
    new CalendarCollector(),
    new IncidentIoCollector(),
  ];
}

/**
 * Get only enabled collectors.
 */
export function getEnabledCollectors(): TodoCollector[] {
  return getAllCollectors().filter((c) => c.isEnabled());
}
