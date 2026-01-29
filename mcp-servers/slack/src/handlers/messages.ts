import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { SlackClient, type SlackResponse, type SlackMessage } from '../client.js';

// ==================== SCHEMAS ====================

export const ReadThreadSchema = z.object({
  channel: z.string().describe('Channel ID where the thread is'),
  threadTs: z.string().describe('Timestamp of the parent message (thread_ts)'),
  limit: z.number().optional().default(50).describe('Number of replies to retrieve'),
});

export const SendMessageSchema = z.object({
  channel: z.string().describe('Channel ID (e.g., C1234567890) or channel name (e.g., #general)'),
  text: z.string().describe('Message text (supports Slack markdown)'),
  threadTs: z
    .string()
    .optional()
    .describe('Thread timestamp to reply to (makes this a threaded reply)'),
  unfurlLinks: z.boolean().optional().default(true).describe('Unfurl links in the message'),
});

export const AddReactionSchema = z.object({
  channel: z.string().describe('Channel ID where the message is'),
  timestamp: z.string().describe('Timestamp of the message to react to'),
  emoji: z
    .string()
    .describe('Emoji name without colons (e.g., "thumbsup", "eyes", "white_check_mark")'),
});

// ==================== HANDLERS ====================

export async function handleReadThread(
  args: z.infer<typeof ReadThreadSchema>,
  client: SlackClient
): Promise<unknown> {
  interface RepliesResponse extends SlackResponse {
    messages: SlackMessage[];
  }

  const data = await client.call<RepliesResponse>('conversations.replies', {
    channel: args.channel,
    ts: args.threadTs,
    limit: args.limit,
  });

  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const userInfo = await client.enrichUserInfo(msg.user);
      return {
        timestamp: msg.ts,
        text: msg.text,
        user: userInfo.realName || userInfo.name,
        userId: msg.user,
      };
    })
  );

  return { messages };
}

export async function handleSendMessage(
  args: z.infer<typeof SendMessageSchema>,
  client: SlackClient
): Promise<unknown> {
  const channelId = await client.resolveChannelId(args.channel);

  const params: Record<string, unknown> = {
    channel: channelId,
    text: args.text,
    unfurl_links: args.unfurlLinks,
  };
  if (args.threadTs) params.thread_ts = args.threadTs;

  interface PostMessageResponse extends SlackResponse {
    ts: string;
    channel: string;
    message: { text: string };
  }

  const data = await client.call<PostMessageResponse>('chat.postMessage', params);

  return {
    success: true,
    timestamp: data.ts,
    channel: data.channel,
    text: data.message.text,
  };
}

export async function handleAddReaction(
  args: z.infer<typeof AddReactionSchema>,
  client: SlackClient
): Promise<unknown> {
  await client.call<SlackResponse>('reactions.add', {
    channel: args.channel,
    timestamp: args.timestamp,
    name: args.emoji,
  });

  return {
    success: true,
    channel: args.channel,
    timestamp: args.timestamp,
    emoji: args.emoji,
  };
}

// ==================== HANDLER BUNDLE ====================

export const messageDefs = defineHandlers<SlackClient>()({
  slack_read_thread: {
    description: 'Read replies in a Slack thread',
    schema: ReadThreadSchema,
    handler: handleReadThread,
  },
  slack_send_message: {
    description: 'Send a message to a Slack channel. Requires chat:write scope.',
    schema: SendMessageSchema,
    handler: handleSendMessage,
  },
  slack_add_reaction: {
    description: 'Add an emoji reaction to a message. Requires reactions:write scope.',
    schema: AddReactionSchema,
    handler: handleAddReaction,
  },
});
