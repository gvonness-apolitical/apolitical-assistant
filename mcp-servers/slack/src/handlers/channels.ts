import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import {
  slackApi,
  resolveChannelId,
  enrichUserInfo,
  type SlackResponse,
  type SlackChannel,
  type SlackMessage,
} from './api.js';

// ==================== SCHEMAS ====================

export const ListChannelsSchema = z.object({
  types: z
    .string()
    .optional()
    .default('public_channel,private_channel')
    .describe('Comma-separated channel types: public_channel, private_channel, mpim, im'),
  limit: z.number().optional().default(100).describe('Maximum number of channels to return'),
});

export const ReadChannelSchema = z.object({
  channel: z.string().describe('Channel ID (e.g., C1234567890) or channel name (e.g., #general)'),
  limit: z.number().optional().default(20).describe('Number of messages to retrieve (max 100)'),
});

export const GetChannelInfoSchema = z.object({
  channel: z.string().describe('Channel ID (e.g., C1234567890)'),
});

// ==================== HANDLERS ====================

export async function handleListChannels(
  args: z.infer<typeof ListChannelsSchema>,
  token: string
): Promise<unknown> {
  interface ChannelListResponse extends SlackResponse {
    channels: SlackChannel[];
  }

  const data = await slackApi<ChannelListResponse>('conversations.list', token, {
    types: args.types,
    limit: args.limit,
    exclude_archived: true,
  });

  return data.channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    isPrivate: ch.is_private,
    isMember: ch.is_member,
    memberCount: ch.num_members,
    purpose: ch.purpose.value,
  }));
}

export async function handleReadChannel(
  args: z.infer<typeof ReadChannelSchema>,
  token: string
): Promise<unknown> {
  const channelId = await resolveChannelId(args.channel, token);

  interface HistoryResponse extends SlackResponse {
    messages: SlackMessage[];
  }

  const data = await slackApi<HistoryResponse>('conversations.history', token, {
    channel: channelId,
    limit: Math.min(args.limit, 100),
  });

  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const userInfo = await enrichUserInfo(msg.user, token);
      return {
        timestamp: msg.ts,
        text: msg.text,
        user: userInfo.realName || userInfo.name,
        userId: msg.user,
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count,
      };
    })
  );

  return {
    channelId,
    messages: messages.reverse(), // Chronological order
  };
}

export async function handleGetChannelInfo(
  args: z.infer<typeof GetChannelInfoSchema>,
  token: string
): Promise<unknown> {
  interface ChannelInfoResponse extends SlackResponse {
    channel: SlackChannel;
  }

  const data = await slackApi<ChannelInfoResponse>('conversations.info', token, {
    channel: args.channel,
  });

  const ch = data.channel;
  return {
    id: ch.id,
    name: ch.name,
    isPrivate: ch.is_private,
    isArchived: ch.is_archived,
    memberCount: ch.num_members,
    topic: ch.topic?.value,
    purpose: ch.purpose.value,
    created: ch.created ? new Date(ch.created * 1000).toISOString() : undefined,
  };
}

// ==================== HANDLER BUNDLE ====================

export const channelDefs = defineHandlers<string>()({
  slack_list_channels: {
    description: 'List Slack channels you have access to',
    schema: ListChannelsSchema,
    handler: handleListChannels,
  },
  slack_read_channel: {
    description: 'Read recent messages from a Slack channel',
    schema: ReadChannelSchema,
    handler: handleReadChannel,
  },
  slack_get_channel_info: {
    description: 'Get information about a specific channel',
    schema: GetChannelInfoSchema,
    handler: handleGetChannelInfo,
  },
});
