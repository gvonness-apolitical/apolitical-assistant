import { z } from 'zod';
import { defineHandlers } from '@apolitical-assistant/mcp-shared';
import { SlackClient, type SlackResponse, type SlackMessage } from '../client.js';

// ==================== SCHEMAS ====================

export const ListDmsSchema = z.object({
  limit: z.number().optional().default(50).describe('Maximum number of DM conversations to return'),
  types: z
    .string()
    .optional()
    .default('im')
    .describe(
      'Comma-separated conversation types: im (1:1 DMs), mpim (group DMs), or both: im,mpim'
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response for fetching next page'),
});

export const ReadDmSchema = z.object({
  userId: z
    .union([z.string(), z.array(z.string())])
    .describe(
      'User ID(s) to read DMs with. Pass a single ID (e.g., "U1234567890") for a 1:1 DM, or an array of IDs (e.g., ["U111", "U222"]) for a group DM.'
    ),
  limit: z.number().optional().default(20).describe('Number of messages to retrieve'),
  oldest: z.string().optional().describe('Only return messages after this Unix timestamp'),
  latest: z.string().optional().describe('Only return messages before this Unix timestamp'),
});

export const SendDmSchema = z.object({
  userId: z
    .union([z.string(), z.array(z.string())])
    .describe(
      'User ID(s) to send DM to. Pass a single ID (e.g., "U1234567890") for a 1:1 DM, or an array of IDs (e.g., ["U111", "U222"]) for a group DM.'
    ),
  text: z.string().describe('Message text (supports Slack markdown)'),
});

// ==================== HANDLERS ====================

export async function handleListDms(
  args: z.infer<typeof ListDmsSchema>,
  client: SlackClient
): Promise<unknown> {
  interface DmListResponse extends SlackResponse {
    channels: Array<{ id: string; user: string }>;
    response_metadata?: { next_cursor?: string };
  }

  const params: Record<string, unknown> = {
    types: args.types,
    limit: args.limit,
  };
  if (args.cursor) params.cursor = args.cursor;

  const data = await client.call<DmListResponse>('conversations.list', params);

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

  const nextCursor = data.response_metadata?.next_cursor;
  if (nextCursor) {
    return { dms, response_metadata: { next_cursor: nextCursor } };
  }
  return dms;
}

export async function handleReadDm(
  args: z.infer<typeof ReadDmSchema>,
  client: SlackClient
): Promise<unknown> {
  // Normalize userId to comma-separated string for conversations.open
  const users = Array.isArray(args.userId) ? args.userId.join(',') : args.userId;

  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await client.call<OpenResponse>('conversations.open', {
    users,
  });

  const channelId = openData.channel.id;

  interface HistoryResponse extends SlackResponse {
    messages: SlackMessage[];
  }

  const historyParams: Record<string, unknown> = {
    channel: channelId,
    limit: Math.min(args.limit, 100),
  };
  if (args.oldest) historyParams.oldest = args.oldest;
  if (args.latest) historyParams.latest = args.latest;

  const data = await client.call<HistoryResponse>('conversations.history', historyParams);

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
  // Normalize userId to comma-separated string for conversations.open
  const users = Array.isArray(args.userId) ? args.userId.join(',') : args.userId;

  // Open/get the DM channel (single user = 1:1, multiple = group DM)
  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await client.call<OpenResponse>('conversations.open', {
    users,
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
    userIds: Array.isArray(args.userId) ? args.userId : [args.userId],
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
    description:
      'Send a direct message to one or more users. Pass a single user ID for a 1:1 DM, or an array of user IDs for a group DM. Requires chat:write scope.',
    schema: SendDmSchema,
    handler: handleSendDm,
  },
});
