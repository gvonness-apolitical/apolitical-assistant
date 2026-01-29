import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { slackApi, enrichUserInfo, type SlackResponse } from './api.js';

// ==================== SCHEMAS ====================

export const SearchSchema = z.object({
  query: z.string().describe('Search query using Slack search syntax'),
  count: z.number().optional().default(20).describe('Number of results to return (max 100)'),
  sort: z
    .enum(['score', 'timestamp'])
    .optional()
    .default('score')
    .describe('Sort by relevance (score) or recency (timestamp)'),
});

// ==================== HANDLERS ====================

export async function handleSearch(
  args: z.infer<typeof SearchSchema>,
  token: string
): Promise<unknown> {
  interface SearchResponse extends SlackResponse {
    messages: {
      total: number;
      matches: Array<{
        ts: string;
        text: string;
        user: string;
        channel: { id: string; name: string };
        permalink: string;
      }>;
    };
  }

  const data = await slackApi<SearchResponse>('search.messages', token, {
    query: args.query,
    count: Math.min(args.count, 100),
    sort: args.sort,
  });

  const messages = await Promise.all(
    data.messages.matches.map(async (msg) => {
      const userInfo = await enrichUserInfo(msg.user, token);
      return {
        timestamp: msg.ts,
        text: msg.text,
        user: userInfo.realName || userInfo.name,
        userId: msg.user,
        channel: msg.channel.name,
        channelId: msg.channel.id,
        permalink: msg.permalink,
      };
    })
  );

  return {
    total: data.messages.total,
    messages,
  };
}

// ==================== HANDLER BUNDLE ====================

export const searchDefs = defineHandlers<string>()({
  slack_search: {
    description:
      'Search for messages in Slack. Uses Slack search syntax (from:@user, in:#channel, has:link, before:date, after:date, etc.)',
    schema: SearchSchema,
    handler: handleSearch,
  },
});
