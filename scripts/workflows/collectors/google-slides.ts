/**
 * Google Slides TODO Collector
 *
 * Collects TODOs from Google Slides:
 * - Comments that mention the user
 * - Comments with action keywords (TODO, action, please, etc.)
 * - Unresolved comment threads
 */

import { getCredential } from '@apolitical-assistant/shared';
import type { CollectOptions, RawTodoItem } from './types.js';
import { BaseCollector } from './base.js';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

interface DriveComment {
  id: string;
  content: string;
  resolved: boolean;
  createdTime: string;
  modifiedTime: string;
  author: {
    displayName: string;
    emailAddress?: string;
  };
  quotedFileContent?: {
    value: string;
  };
  anchor?: string;
}

interface DriveCommentsResponse {
  comments: DriveComment[];
  nextPageToken?: string;
}

export class GoogleSlidesCollector extends BaseCollector {
  readonly source = 'google-slides' as const;
  readonly name = 'Google Slides';

  private driveApiBase = 'https://www.googleapis.com/drive/v3';

  isEnabled(): boolean {
    return this.config.collectors.googleSlides?.enabled ?? true;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.log('No Google access token available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get user's email for mention detection
      const userEmail = await this.getUserEmail(accessToken);

      // Get recently modified presentations
      const presentations = await this.getRecentPresentations(accessToken, options);

      for (const presentation of presentations.slice(0, 10)) {
        const commentItems = await this.extractCommentsFromPresentation(
          accessToken,
          presentation,
          userEmail,
          options
        );
        items.push(...commentItems);
      }
    } catch (error) {
      this.log(`Error collecting from Google Slides: ${error}`, options);
      throw error;
    }

    return items;
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

  private async getUserEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { email?: string };
      return data.email || null;
    } catch {
      return null;
    }
  }

  private async getRecentPresentations(
    accessToken: string,
    options?: CollectOptions
  ): Promise<DriveFile[]> {
    const configPresentationIds = this.config.collectors.googleSlides?.presentationIds;

    // If specific presentation IDs are configured, fetch those
    if (configPresentationIds && configPresentationIds.length > 0) {
      const presentations: DriveFile[] = [];
      for (const presentationId of configPresentationIds) {
        try {
          const presentation = await this.getFileMetadata(accessToken, presentationId);
          presentations.push(presentation);
        } catch (error) {
          this.log(`Error fetching presentation ${presentationId}: ${error}`, options);
        }
      }
      return presentations;
    }

    // Otherwise, search for recently modified presentations
    const query =
      "mimeType='application/vnd.google-apps.presentation' and trashed = false";
    const url = new URL(`${this.driveApiBase}/files`);
    url.searchParams.set('q', query);
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink)');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status}`);
    }

    const data = (await response.json()) as DriveListResponse;
    this.log(`Found ${data.files.length} recent presentations`, options);

    return data.files;
  }

  private async getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
    const url = `${this.driveApiBase}/files/${fileId}?fields=id,name,mimeType,modifiedTime,webViewLink`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status}`);
    }

    return response.json() as Promise<DriveFile>;
  }

  private async extractCommentsFromPresentation(
    accessToken: string,
    presentation: DriveFile,
    userEmail: string | null,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      const comments = await this.getFileComments(accessToken, presentation.id);

      // Filter for unresolved comments that are relevant
      const relevantComments = comments.filter((comment) => {
        // Skip resolved comments
        if (comment.resolved) return false;

        // Check if comment mentions the user
        if (userEmail && comment.content.toLowerCase().includes(userEmail.toLowerCase())) {
          return true;
        }

        // Check for action keywords
        const actionKeywords = [
          'todo',
          'action',
          'please',
          'can you',
          'could you',
          'need to',
          'should',
          'must',
          'required',
          'follow up',
          'follow-up',
          'review',
          'update',
          'fix',
          'change',
        ];

        const lowerContent = comment.content.toLowerCase();
        return actionKeywords.some((keyword) => lowerContent.includes(keyword));
      });

      this.log(
        `Found ${relevantComments.length} relevant comments in "${presentation.name}"`,
        options
      );

      for (const comment of relevantComments) {
        const title = this.extractTitle(comment.content);
        const isMention = userEmail && comment.content.toLowerCase().includes(userEmail.toLowerCase());

        items.push({
          title: `Slides: ${title}`,
          description: `From: ${presentation.name}\nComment by: ${comment.author.displayName}${comment.quotedFileContent ? `\nOn: "${comment.quotedFileContent.value}"` : ''}`,
          sourceId: `gslides-${presentation.id}-${comment.id}`,
          sourceUrl: presentation.webViewLink,
          requestDate: comment.createdTime,
          basePriority: isMention ? 2 : 3, // Higher priority for direct mentions
          urgency: isMention ? 2 : 3,
          tags: ['google-slides', 'comment', presentation.name],
        });
      }
    } catch (error) {
      this.log(`Error extracting comments from ${presentation.name}: ${error}`, options);
    }

    return items;
  }

  private async getFileComments(accessToken: string, fileId: string): Promise<DriveComment[]> {
    const url = new URL(`${this.driveApiBase}/files/${fileId}/comments`);
    url.searchParams.set('fields', 'comments(id,content,resolved,createdTime,modifiedTime,author,quotedFileContent,anchor)');
    url.searchParams.set('pageSize', '100');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Drive Comments API error: ${response.status}`);
    }

    const data = (await response.json()) as DriveCommentsResponse;
    return data.comments || [];
  }

  private extractTitle(content: string): string {
    // Take the first line or first sentence, up to 100 chars
    const firstLine = content.split('\n')[0] || content;
    const firstSentence = firstLine.split(/[.!?]/)[0] || firstLine;

    let title = firstSentence.slice(0, 100).trim();

    if (title.length < firstSentence.length) {
      title += '...';
    }

    return title;
  }
}
