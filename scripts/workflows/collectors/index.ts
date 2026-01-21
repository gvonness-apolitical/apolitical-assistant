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
import { NotionCollector } from './notion.js';
import { HumaansCollector } from './humaans.js';
import { GeminiNotesCollector } from './gemini-notes.js';

export * from './types.js';
export * from './config.js';

export { GitHubCollector } from './github.js';
export { LinearCollector } from './linear.js';
export { EmailCollector } from './email.js';
export { SlackCollector } from './slack.js';
export { GoogleDocsCollector } from './google-docs.js';
export { NotionCollector } from './notion.js';
export { HumaansCollector } from './humaans.js';
export { GeminiNotesCollector } from './gemini-notes.js';

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
    new NotionCollector(),
    new HumaansCollector(),
    new GeminiNotesCollector(),
  ];
}

/**
 * Get only enabled collectors.
 */
export function getEnabledCollectors(): TodoCollector[] {
  return getAllCollectors().filter((c) => c.isEnabled());
}
