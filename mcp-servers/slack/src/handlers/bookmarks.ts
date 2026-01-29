import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { slackApi, type SlackResponse } from './api.js';

// ==================== SCHEMAS ====================

export const GetBookmarksSchema = z.object({
  channel_id: z.string().describe('Channel ID to get bookmarks from (e.g., C0123456789)'),
});

// ==================== RESPONSE TYPES ====================

interface Bookmark {
  id: string;
  channel_id: string;
  title: string;
  link: string;
  emoji?: string;
  icon_url?: string;
  type: string;
  date_created: number;
  date_updated: number;
  created_by?: string;
  updated_by?: string;
}

interface BookmarkListResponse extends SlackResponse {
  bookmarks: Bookmark[];
}

// ==================== HANDLERS ====================

export async function handleGetBookmarks(
  args: z.infer<typeof GetBookmarksSchema>,
  token: string
): Promise<unknown> {
  const data = await slackApi<BookmarkListResponse>('bookmarks.list', token, {
    channel_id: args.channel_id,
  });

  return {
    channelId: args.channel_id,
    bookmarks: data.bookmarks.map((bookmark) => ({
      id: bookmark.id,
      title: bookmark.title,
      link: bookmark.link,
      emoji: bookmark.emoji,
      type: bookmark.type,
      dateCreated: new Date(bookmark.date_created * 1000).toISOString(),
      dateUpdated: new Date(bookmark.date_updated * 1000).toISOString(),
    })),
  };
}

// ==================== HANDLER BUNDLE ====================

export const bookmarkDefs = defineHandlers<string>()({
  slack_get_bookmarks: {
    description:
      'Get bookmarked messages and links from a Slack channel. Returns bookmarks with title, link, and metadata.',
    schema: GetBookmarksSchema,
    handler: handleGetBookmarks,
  },
});
