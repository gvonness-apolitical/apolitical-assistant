/**
 * Notion TODO Collector
 *
 * Collects TODOs from Notion:
 * - Pages with TODO tags
 * - Unchecked to-do blocks
 * - Tasks from task databases
 *
 * Note: This collector uses the Claude CLI to interact with Notion via MCP,
 * as Notion's API requires OAuth which is handled by the MCP server.
 */

import { runClaudeCommand } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';
import { getProjectRoot } from './config.js';

export class NotionCollector extends BaseCollector {
  readonly source = 'notion' as const;
  readonly name = 'Notion';

  isEnabled(): boolean {
    return this.config.collectors.notion.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Use Claude CLI with MCP to search Notion for TODOs
      const prompt = `Search Notion for my TODO items. Look for:
1. Pages or database entries with "TODO" or "Action Required" tags
2. Any pages with unchecked to-do items assigned to me
3. Tasks in any task databases that are assigned to me and not completed

For each TODO found, extract:
- The title/task description
- The page URL
- The creation or last modified date
- Any due date if present

Return the results as a JSON array with this structure:
[
  {
    "title": "Task title",
    "sourceId": "notion-page-id",
    "sourceUrl": "https://notion.so/...",
    "requestDate": "ISO date string",
    "dueDate": "ISO date string or null"
  }
]

Only return the JSON array, no other text.`;

      const result = await runClaudeCommand(prompt, {
        cwd: getProjectRoot(),
      });

      // Parse the JSON response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          title: string;
          sourceId: string;
          sourceUrl?: string;
          requestDate?: string;
          dueDate?: string;
        }>;

        for (const item of parsed) {
          items.push({
            title: item.title,
            sourceId: item.sourceId,
            sourceUrl: item.sourceUrl,
            requestDate: item.requestDate,
            dueDate: item.dueDate,
            basePriority: 3,
            urgency: 3,
            tags: ['notion'],
          });
        }

        this.log(`Found ${items.length} TODOs from Notion`, options);
      }
    } catch (error) {
      this.log(`Error collecting from Notion: ${error}`, options);
      // Don't throw - Notion collection is optional
    }

    return items;
  }
}
