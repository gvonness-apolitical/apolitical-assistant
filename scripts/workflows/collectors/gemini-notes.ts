/**
 * Gemini Notes TODO Collector
 *
 * Collects TODOs from Google Meet AI-generated transcripts:
 * - Action items extracted from meeting notes
 * - Follow-ups mentioned in transcripts
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

export class GeminiNotesCollector extends BaseCollector {
  readonly source = 'gemini-notes' as const;
  readonly name = 'Gemini Notes';

  private driveApiBase = 'https://www.googleapis.com/drive/v3';
  private docsApiBase = 'https://docs.googleapis.com/v1';

  isEnabled(): boolean {
    return this.config.collectors.geminiNotes.enabled;
  }

  protected async collectRaw(options?: CollectOptions): Promise<RawTodoItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      this.log('No Google access token available, skipping', options);
      return [];
    }

    const items: RawTodoItem[] = [];

    try {
      // Search for Google Meet transcripts
      const transcripts = await this.findMeetingTranscripts(accessToken, options);

      for (const transcript of transcripts.slice(0, 10)) {
        const actionItems = await this.extractActionItems(accessToken, transcript, options);
        items.push(...actionItems);
      }
    } catch (error) {
      this.log(`Error collecting from Gemini Notes: ${error}`, options);
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

  private async findMeetingTranscripts(
    accessToken: string,
    options?: CollectOptions
  ): Promise<DriveFile[]> {
    // Search for files that look like meeting transcripts
    // These are typically in Google Docs format with specific naming patterns
    const queries = [
      "name contains 'Meeting notes' and mimeType='application/vnd.google-apps.document'",
      "name contains 'Transcript' and mimeType='application/vnd.google-apps.document'",
      "fullText contains 'Action items' and mimeType='application/vnd.google-apps.document'",
    ];

    const allFiles: DriveFile[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
      try {
        const url = new URL(`${this.driveApiBase}/files`);
        url.searchParams.set('q', `${query} and trashed = false`);
        url.searchParams.set('orderBy', 'modifiedTime desc');
        url.searchParams.set('pageSize', '10');
        url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink)');

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as DriveListResponse;
          for (const file of data.files) {
            if (!seenIds.has(file.id)) {
              seenIds.add(file.id);
              allFiles.push(file);
            }
          }
        }
      } catch (error) {
        this.log(`Error searching for transcripts: ${error}`, options);
      }
    }

    this.log(`Found ${allFiles.length} meeting transcripts`, options);
    return allFiles;
  }

  private async extractActionItems(
    accessToken: string,
    transcript: DriveFile,
    options?: CollectOptions
  ): Promise<RawTodoItem[]> {
    const items: RawTodoItem[] = [];

    try {
      // Get document content
      const url = `${this.docsApiBase}/documents/${transcript.id}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return items;
      }

      const doc = (await response.json()) as {
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
      };

      // Extract text content
      const textParts: string[] = [];
      if (doc.body?.content) {
        for (const block of doc.body.content) {
          if (block.paragraph?.elements) {
            for (const element of block.paragraph.elements) {
              if (element.textRun?.content) {
                textParts.push(element.textRun.content);
              }
            }
          }
        }
      }

      const text = textParts.join('');

      // Look for action items section
      const actionItemPatterns = [
        /Action items?:?\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
        /Follow[- ]?ups?:?\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
        /Next steps?:?\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/gi,
        /- \[ \]\s*(.+)/g,
        /\* \[ \]\s*(.+)/g,
      ];

      for (const pattern of actionItemPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const content = match[1].trim();

          // Skip if too short or too long
          if (content.length < 10 || content.length > 500) continue;

          // Split multi-line action items
          const lines = content.split('\n').filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 5 && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•'));
          });

          for (const line of lines.slice(0, 5)) {
            // Limit items per transcript
            const title = line.replace(/^[-*•]\s*/, '').trim();

            items.push({
              title: `Meeting: ${title}`,
              description: `From: ${transcript.name}`,
              sourceId: `gemini-${transcript.id}-${items.length}`,
              sourceUrl: transcript.webViewLink,
              requestDate: transcript.modifiedTime,
              basePriority: 3,
              urgency: 3,
              tags: ['meeting', 'action-item'],
            });
          }
        }
      }

      if (items.length > 0) {
        this.log(`Found ${items.length} action items in "${transcript.name}"`, options);
      }
    } catch (error) {
      this.log(`Error extracting action items from ${transcript.name}: ${error}`, options);
    }

    return items;
  }
}
