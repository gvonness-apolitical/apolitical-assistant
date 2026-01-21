/**
 * Slack TODO Collector
 *
 * Collects TODOs from Slack:
 * - Messages containing action items
 * - DM requests
 * - Mentions with action keywords
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  channel?: string;
  permalink?: string;
}

interface SlackSearchResult {
  messages: {
    matches: SlackMessage[];
    total: number;
  };
}

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
}

export class SlackCollector extends BaseCollector {
  readonly source = 'slack' as const;
  readonly name = 'Slack';

  private apiBase = 'https://slack.com/api';
  private userCache = new Map<string, string>();

  isEnabled(): boolean {
    return this.config.collectors.slack.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const token = await getCredential('slack-token');
    if (!token) {
      this.log('No Slack token found, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Search for action items mentioning the user
      const actionItems = await this.searchActionItems(token, options);
      items.push(...actionItems);

      // Search for saved items/reminders
      const savedItems = await this.getSavedItems(token, options);
      items.push(...savedItems);
    } catch (error) {
      this.log(`Error collecting from Slack: ${error}`, options);
      throw error;
    }

    return items;
  }

  private async searchActionItems(
    token: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];
    const actionPatterns = [
      'action item',
      'todo',
      'to do',
      'follow up',
      'please review',
      'can you',
      'could you',
      'need you to',
    ];

    // Search for recent messages with action patterns
    for (const pattern of actionPatterns.slice(0, 3)) {
      // Limit to avoid rate limits
      try {
        const query = `"${pattern}" in:dm`;
        const response = await this.searchMessages(token, query);

        this.log(`Found ${response.messages.total} messages for "${pattern}"`, options);

        for (const msg of response.messages.matches.slice(0, 5)) {
          const userName = await this.getUserName(token, msg.user);
          const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();

          items.push({
            title: this.extractTitle(msg.text),
            description: `From: ${userName}\n${msg.text.slice(0, 200)}`,
            sourceId: `slack-${msg.ts}`,
            sourceUrl: msg.permalink,
            requestDate: timestamp,
            basePriority: 3,
            urgency: 3,
            tags: ['slack', 'action-item'],
          });
        }
      } catch (error) {
        this.log(`Error searching Slack for "${pattern}": ${error}`, options);
      }
    }

    return items;
  }

  private async getSavedItems(
    token: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Get saved items (bookmarks)
      const response = await this.fetchSlackApi<{
        ok: boolean;
        items?: Array<{
          type: string;
          message?: SlackMessage;
          date_create: number;
        }>;
      }>('/stars.list', token, { limit: '50' });

      if (!response.ok || !response.items) {
        return items;
      }

      this.log(`Found ${response.items.length} saved items`, options);

      for (const item of response.items) {
        if (item.type !== 'message' || !item.message) continue;

        const msg = item.message;
        const userName = await this.getUserName(token, msg.user);
        const timestamp = new Date(item.date_create * 1000).toISOString();

        items.push({
          title: this.extractTitle(msg.text),
          description: `From: ${userName}\n${msg.text.slice(0, 200)}`,
          sourceId: `slack-saved-${msg.ts}`,
          sourceUrl: msg.permalink,
          requestDate: timestamp,
          basePriority: 2, // Saved items are explicitly marked as important
          urgency: 2,
          tags: ['slack', 'saved'],
        });
      }
    } catch (error) {
      this.log(`Error fetching saved items: ${error}`, options);
    }

    return items;
  }

  private extractTitle(text: string): string {
    // Extract a title from the message text
    // Take the first line or first sentence, up to 100 chars
    const firstLine = text.split('\n')[0] || text;
    const firstSentence = firstLine.split(/[.!?]/)[0] || firstLine;

    let title = firstSentence.slice(0, 100);

    // Clean up Slack formatting
    title = title.replace(/<@\w+>/g, '@user'); // Replace user mentions
    title = title.replace(/<#\w+\|(\w+)>/g, '#$1'); // Replace channel mentions
    title = title.replace(/<([^|>]+)\|([^>]+)>/g, '$2'); // Replace links with text
    title = title.replace(/<([^>]+)>/g, '$1'); // Remove remaining angle brackets

    if (title.length < firstSentence.length) {
      title += '...';
    }

    return `Slack: ${title}`;
  }

  private async searchMessages(token: string, query: string): Promise<SlackSearchResult> {
    return this.fetchSlackApi<SlackSearchResult>('/search.messages', token, {
      query,
      sort: 'timestamp',
      sort_dir: 'desc',
      count: '20',
    });
  }

  private async getUserName(token: string, userId?: string): Promise<string> {
    if (!userId) return 'Unknown';

    // Check cache first
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      const response = await this.fetchSlackApi<{
        ok: boolean;
        user?: SlackUser;
      }>('/users.info', token, { user: userId });

      if (response.ok && response.user) {
        const name = response.user.real_name || response.user.name;
        this.userCache.set(userId, name);
        return name;
      }
    } catch {
      // Ignore errors, return ID
    }

    return userId;
  }

  private async fetchSlackApi<T>(
    endpoint: string,
    token: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.apiBase}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
