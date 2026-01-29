import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { SlackClient, type SlackResponse, type SlackMessage } from '../client.js';

// ==================== SCHEMAS ====================

export const ListDmsSchema = z.object({
  limit: z.number().optional().default(50).describe('Maximum number of DM conversations to return'),
});

export const ReadDmSchema = z.object({
  userId: z.string().describe('User ID to read DMs with (e.g., U1234567890)'),
  limit: z.number().optional().default(20).describe('Number of messages to retrieve'),
});

export const SendDmSchema = z.object({
  userId: z.string().describe('User ID to send DM to (e.g., U1234567890)'),
  text: z.string().describe('Message text (supports Slack markdown)'),
});

// ==================== HANDLERS ====================

export async function handleListDms(
  args: z.infer<typeof ListDmsSchema>,
  client: SlackClient
): Promise<unknown> {
  interface DmListResponse extends SlackResponse {
    channels: Array<{ id: string; user: string }>;
  }

  const data = await client.call<DmListResponse>('conversations.list', {
    types: 'im',
    limit: args.limit,
  });

  const dms = await Promise.all(
    data.channels.map(async (dm) => {
      const userInfo = await client.enrichUserInfo(dm.user);
      return {
        channelId: dm.id,
        userId: dm.user,
        userName: userInfo.name,
        userRealName: userInfo.realName,
      };
    })
  );

  return dms;
}

export async function handleReadDm(
  args: z.infer<typeof ReadDmSchema>,
  client: SlackClient
): Promise<unknown> {
  // Open/get the DM channel with this user
  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await client.call<OpenResponse>('conversations.open', {
    users: args.userId,
  });

  const channelId = openData.channel.id;

  interface HistoryResponse extends SlackResponse {
    messages: SlackMessage[];
  }

  const data = await client.call<HistoryResponse>('conversations.history', {
    channel: channelId,
    limit: Math.min(args.limit, 100),
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

  return {
    channelId,
    messages: messages.reverse(),
  };
}

export async function handleSendDm(
  args: z.infer<typeof SendDmSchema>,
  client: SlackClient
): Promise<unknown> {
  // First open/get the DM channel
  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await client.call<OpenResponse>('conversations.open', {
    users: args.userId,
  });

  const channelId = openData.channel.id;

  interface PostMessageResponse extends SlackResponse {
    ts: string;
    channel: string;
    message: { text: string };
  }

  const data = await client.call<PostMessageResponse>('chat.postMessage', {
    channel: channelId,
    text: args.text,
  });

  return {
    success: true,
    timestamp: data.ts,
    channel: data.channel,
    userId: args.userId,
    text: data.message.text,
  };
}

// ==================== HANDLER BUNDLE ====================

export const dmDefs = defineHandlers<SlackClient>()({
  slack_list_dms: {
    description: 'List your direct message conversations',
    schema: ListDmsSchema,
    handler: handleListDms,
  },
  slack_read_dm: {
    description: 'Read messages from a direct message conversation',
    schema: ReadDmSchema,
    handler: handleReadDm,
  },
  slack_send_dm: {
    description: 'Send a direct message to a user. Requires chat:write scope.',
    schema: SendDmSchema,
    handler: handleSendDm,
  },
});
