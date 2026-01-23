import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  slackApi,
  resolveChannelId,
  enrichUserInfo,
  type SlackResponse,
  type SlackMessage,
} from './api.js';

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

// ==================== TOOL DEFINITIONS ====================

export const messageTools: Tool[] = [
  {
    name: 'slack_read_thread',
    description: 'Read replies in a Slack thread',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID where the thread is',
        },
        threadTs: {
          type: 'string',
          description: 'Timestamp of the parent message (thread_ts)',
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Number of replies to retrieve',
        },
      },
      required: ['channel', 'threadTs'],
    },
  },
  {
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel. Requires chat:write scope.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID (e.g., C1234567890) or channel name (e.g., #general)',
        },
        text: {
          type: 'string',
          description: 'Message text (supports Slack markdown)',
        },
        threadTs: {
          type: 'string',
          description: 'Thread timestamp to reply to (makes this a threaded reply)',
        },
        unfurlLinks: {
          type: 'boolean',
          default: true,
          description: 'Unfurl links in the message',
        },
      },
      required: ['channel', 'text'],
    },
  },
  {
    name: 'slack_add_reaction',
    description: 'Add an emoji reaction to a message. Requires reactions:write scope.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel ID where the message is',
        },
        timestamp: {
          type: 'string',
          description: 'Timestamp of the message to react to',
        },
        emoji: {
          type: 'string',
          description: 'Emoji name without colons (e.g., "thumbsup", "eyes", "white_check_mark")',
        },
      },
      required: ['channel', 'timestamp', 'emoji'],
    },
  },
];

// ==================== HANDLERS ====================

export async function handleReadThread(
  args: z.infer<typeof ReadThreadSchema>,
  token: string
): Promise<unknown> {
  interface RepliesResponse extends SlackResponse {
    messages: SlackMessage[];
  }

  const data = await slackApi<RepliesResponse>('conversations.replies', token, {
    channel: args.channel,
    ts: args.threadTs,
    limit: args.limit,
  });

  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const userInfo = await enrichUserInfo(msg.user, token);
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
  token: string
): Promise<unknown> {
  const channelId = await resolveChannelId(args.channel, token);

  const params: Record<string, string | number | boolean> = {
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

  const data = await slackApi<PostMessageResponse>('chat.postMessage', token, params);

  return {
    success: true,
    timestamp: data.ts,
    channel: data.channel,
    text: data.message.text,
  };
}

export async function handleAddReaction(
  args: z.infer<typeof AddReactionSchema>,
  token: string
): Promise<unknown> {
  await slackApi<SlackResponse>('reactions.add', token, {
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
