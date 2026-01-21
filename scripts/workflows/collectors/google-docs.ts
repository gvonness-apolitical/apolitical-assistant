/**
 * Google Docs TODO Collector
 *
 * Collects TODOs from Google Docs:
 * - @TODO: patterns in document content
 * - ACTION: patterns
 * - Unchecked checkboxes [ ]
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

interface DocContent {
  body?: {
    content?: Array<{
      paragraph?: {
        elements?: Array<{
          textRun?: {
            content?: string;
          };
        }>;
      };
    }>;
  };
}

export class GoogleDocsCollector extends BaseCollector {
  readonly source = 'google-docs' as const;
  readonly name = 'Google Docs';

  private driveApiBase = 'https://www.googleapis.com/drive/v3';
  private docsApiBase = 'https://docs.googleapis.com/v1';

  isEnabled(): boolean {
    return this.config.collectors.googleDocs.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.log('No Google access token available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Get recently modified documents
      const docs = await this.getRecentDocs(accessToken, options);

      for (const doc of docs.slice(0, 10)) {
        // Limit to avoid rate limits
        const docItems = await this.extractTodosFromDoc(accessToken, doc, options);
        items.push(...docItems);
      }
    } catch (error) {
      this.log(`Error collecting from Google Docs: ${error}`, options);
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

  private async getRecentDocs(
    accessToken: string,
    options?: CollectOptions
  ): Promise<DriveFile[]> {
    const configDocIds = this.config.collectors.googleDocs.docIds;

    // If specific doc IDs are configured, fetch those
    if (configDocIds && configDocIds.length > 0) {
      const docs: DriveFile[] = [];
      for (const docId of configDocIds) {
        try {
          const doc = await this.getDocMetadata(accessToken, docId);
          docs.push(doc);
        } catch (error) {
          this.log(`Error fetching doc ${docId}: ${error}`, options);
        }
      }
      return docs;
    }

    // Otherwise, search for recently modified docs owned by user
    const query =
      "mimeType='application/vnd.google-apps.document' and 'me' in owners and trashed = false";
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
    this.log(`Found ${data.files.length} recent documents`, options);

    return data.files;
  }

  private async getDocMetadata(accessToken: string, docId: string): Promise<DriveFile> {
    const url = `${this.driveApiBase}/files/${docId}?fields=id,name,mimeType,modifiedTime,webViewLink`;

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

  private async extractTodosFromDoc(
    accessToken: string,
    doc: DriveFile,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      const content = await this.getDocContent(accessToken, doc.id);
      const text = this.extractText(content);

      // Find @TODO: patterns
      const todoPatterns = [/@TODO:?\s*(.+?)(?:\n|$)/gi, /ACTION:?\s*(.+?)(?:\n|$)/gi, /\[ \]\s*(.+?)(?:\n|$)/g];

      for (const pattern of todoPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const title = match[1].trim().slice(0, 200);

          items.push({
            title: `Doc: ${title}`,
            description: `From: ${doc.name}`,
            sourceId: `gdoc-${doc.id}-${match.index}`,
            sourceUrl: doc.webViewLink,
            requestDate: doc.modifiedTime,
            basePriority: 3,
            urgency: 3,
            tags: ['google-docs', doc.name],
          });
        }
      }

      if (items.length > 0) {
        this.log(`Found ${items.length} TODOs in "${doc.name}"`, options);
      }
    } catch (error) {
      this.log(`Error extracting TODOs from doc ${doc.name}: ${error}`, options);
    }

    return items;
  }

  private async getDocContent(accessToken: string, docId: string): Promise<DocContent> {
    const url = `${this.docsApiBase}/documents/${docId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Docs API error: ${response.status}`);
    }

    return response.json() as Promise<DocContent>;
  }

  private extractText(content: DocContent): string {
    const parts: string[] = [];

    if (content.body?.content) {
      for (const block of content.body.content) {
        if (block.paragraph?.elements) {
          for (const element of block.paragraph.elements) {
            if (element.textRun?.content) {
              parts.push(element.textRun.content);
            }
          }
        }
      }
    }

    return parts.join('');
  }
}
