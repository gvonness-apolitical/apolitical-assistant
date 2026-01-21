/**
 * Email TODO Collector
 *
 * Collects TODOs from Gmail:
 * - Starred/flagged emails
 * - Emails with action-related subjects
 * - Applied (HR platform) notification emails
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
}

export class EmailCollector extends BaseCollector {
  readonly source = 'email' as const;
  readonly name = 'Email';

  private apiBase = 'https://www.googleapis.com/gmail/v1';

  isEnabled(): boolean {
    return this.config.collectors.email.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.log('No Google access token available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Collect starred emails
      const starred = await this.getStarredEmails(accessToken, options);
      items.push(...starred);

      // Collect action-required emails
      const actionRequired = await this.getActionRequiredEmails(accessToken, options);
      items.push(...actionRequired);

      // Collect Applied (HR platform) emails
      const applied = await this.getAppliedEmails(accessToken, options);
      items.push(...applied);
    } catch (error) {
      this.log(`Error collecting from Email: ${error}`, options);
      throw error;
    }

    // Deduplicate by message ID
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.sourceId)) return false;
      seen.add(item.sourceId);
      return true;
    });
  }

  private async getAccessToken(): Promise<string | null> {
    const refreshToken = getCredential('google-refresh-token');
    const clientId = getCredential('google-oauth-client-id');
    const clientSecret = getCredential('google-oauth-client-secret');

    if (!refreshToken || !clientId || !clientSecret) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch {
      return null;
    }
  }

  private async getStarredEmails(
    accessToken: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      const query = 'is:starred is:unread';
      const messages = await this.searchMessages(accessToken, query);

      this.log(`Found ${messages.length} starred unread emails`, options);

      for (const msg of messages.slice(0, 20)) {
        const details = await this.getMessageDetails(accessToken, msg.id);
        const subject = this.getHeader(details.payload.headers, 'Subject') || 'No Subject';
        const from = this.getHeader(details.payload.headers, 'From') || 'Unknown';
        const date = new Date(parseInt(details.internalDate)).toISOString();

        items.push({
          title: `Email: ${subject}`,
          description: `From: ${from}\n${details.snippet}`,
          sourceId: details.id,
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${details.threadId}`,
          requestDate: date,
          basePriority: 2, // Starred emails are high priority
          urgency: 2,
          tags: ['email', 'starred'],
        });
      }
    } catch (error) {
      this.log(`Error fetching starred emails: ${error}`, options);
    }

    return items;
  }

  private async getActionRequiredEmails(
    accessToken: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];
    const patterns = this.config.collectors.email.patterns;

    for (const pattern of patterns) {
      try {
        const query = `is:unread subject:(${pattern})`;
        const messages = await this.searchMessages(accessToken, query);

        this.log(`Found ${messages.length} emails matching "${pattern}"`, options);

        for (const msg of messages.slice(0, 10)) {
          const details = await this.getMessageDetails(accessToken, msg.id);
          const subject = this.getHeader(details.payload.headers, 'Subject') || 'No Subject';
          const from = this.getHeader(details.payload.headers, 'From') || 'Unknown';
          const date = new Date(parseInt(details.internalDate)).toISOString();

          items.push({
            title: `Email: ${subject}`,
            description: `From: ${from}\n${details.snippet}`,
            sourceId: details.id,
            sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${details.threadId}`,
            requestDate: date,
            basePriority: 3,
            urgency: 3,
            tags: ['email', 'action-required'],
          });
        }
      } catch (error) {
        this.log(`Error fetching emails for pattern "${pattern}": ${error}`, options);
      }
    }

    return items;
  }

  private async getAppliedEmails(
    accessToken: string,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Search for Applied platform emails
      const query = 'is:unread from:applied.com OR from:beapplied.com subject:(action OR review OR interview OR candidate)';
      const messages = await this.searchMessages(accessToken, query);

      this.log(`Found ${messages.length} Applied emails`, options);

      for (const msg of messages.slice(0, 20)) {
        const details = await this.getMessageDetails(accessToken, msg.id);
        const subject = this.getHeader(details.payload.headers, 'Subject') || 'No Subject';
        const from = this.getHeader(details.payload.headers, 'From') || 'Unknown';
        const date = new Date(parseInt(details.internalDate)).toISOString();

        items.push({
          title: `Applied: ${subject}`,
          description: `From: ${from}\n${details.snippet}`,
          sourceId: details.id,
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${details.threadId}`,
          requestDate: date,
          basePriority: 2, // HR tasks are typically high priority
          urgency: 2,
          tags: ['email', 'applied', 'hr'],
        });
      }
    } catch (error) {
      this.log(`Error fetching Applied emails: ${error}`, options);
    }

    return items;
  }

  private async searchMessages(
    accessToken: string,
    query: string
  ): Promise<Array<{ id: string; threadId: string }>> {
    const url = new URL(`${this.apiBase}/users/me/messages`);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '50');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GmailListResponse;
    return data.messages || [];
  }

  private async getMessageDetails(
    accessToken: string,
    messageId: string
  ): Promise<GmailMessageResponse> {
    const url = `${this.apiBase}/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as GmailMessageResponse;
  }

  private getHeader(
    headers: Array<{ name: string; value: string }> | undefined,
    name: string
  ): string | undefined {
    return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
  }
}
