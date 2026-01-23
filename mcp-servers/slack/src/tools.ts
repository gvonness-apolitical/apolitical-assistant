import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
} from '@apolitical-assistant/mcp-shared';
import type { SlackContext } from './index.js';

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

export const ListChannelsSchema = z.object({
  types: z
    .string()
    .optional()
    .default('public_channel,private_channel')
    .describe('Comma-separated channel types: public_channel, private_channel, mpim, im'),
  limit: z.number().optional().default(100).describe('Maximum number of channels to return'),
});

export const ReadChannelSchema = z.object({
  channel: z
    .string()
    .describe('Channel ID (e.g., C1234567890) or channel name (e.g., #general)'),
  limit: z.number().optional().default(20).describe('Number of messages to retrieve (max 100)'),
});

export const ReadThreadSchema = z.object({
  channel: z.string().describe('Channel ID where the thread is'),
  threadTs: z.string().describe('Timestamp of the parent message (thread_ts)'),
  limit: z.number().optional().default(50).describe('Number of replies to retrieve'),
});

export const ListDmsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of DM conversations to return'),
});

export const ReadDmSchema = z.object({
  userId: z.string().describe('User ID to read DMs with (e.g., U1234567890)'),
  limit: z.number().optional().default(20).describe('Number of messages to retrieve'),
});

export const ListUsersSchema = z.object({
  limit: z.number().optional().default(100).describe('Maximum number of users to return'),
});

export const GetUserSchema = z.object({
  userId: z.string().describe('User ID (e.g., U1234567890)'),
});

export const GetChannelInfoSchema = z.object({
  channel: z.string().describe('Channel ID (e.g., C1234567890)'),
});

export const SendMessageSchema = z.object({
  channel: z
    .string()
    .describe('Channel ID (e.g., C1234567890) or channel name (e.g., #general)'),
  text: z.string().describe('Message text (supports Slack markdown)'),
  threadTs: z
    .string()
    .optional()
    .describe('Thread timestamp to reply to (makes this a threaded reply)'),
  unfurlLinks: z.boolean().optional().default(true).describe('Unfurl links in the message'),
});

export const SendDmSchema = z.object({
  userId: z.string().describe('User ID to send DM to (e.g., U1234567890)'),
  text: z.string().describe('Message text (supports Slack markdown)'),
});

export const AddReactionSchema = z.object({
  channel: z.string().describe('Channel ID where the message is'),
  timestamp: z.string().describe('Timestamp of the message to react to'),
  emoji: z
    .string()
    .describe('Emoji name without colons (e.g., "thumbsup", "eyes", "white_check_mark")'),
});

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return [
    {
      name: 'slack_search',
      description:
        'Search for messages in Slack. Uses Slack search syntax (from:@user, in:#channel, has:link, before:date, after:date, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using Slack search syntax',
          },
          count: {
            type: 'number',
            default: 20,
            description: 'Number of results to return (max 100)',
          },
          sort: {
            type: 'string',
            enum: ['score', 'timestamp'],
            default: 'score',
            description: 'Sort by relevance (score) or recency (timestamp)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'slack_list_channels',
      description: 'List Slack channels you have access to',
      inputSchema: {
        type: 'object',
        properties: {
          types: {
            type: 'string',
            default: 'public_channel,private_channel',
            description: 'Comma-separated channel types: public_channel, private_channel, mpim, im',
          },
          limit: {
            type: 'number',
            default: 100,
            description: 'Maximum number of channels to return',
          },
        },
      },
    },
    {
      name: 'slack_read_channel',
      description: 'Read recent messages from a Slack channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'Channel ID (e.g., C1234567890) or channel name (e.g., #general)',
          },
          limit: {
            type: 'number',
            default: 20,
            description: 'Number of messages to retrieve (max 100)',
          },
        },
        required: ['channel'],
      },
    },
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
      name: 'slack_list_dms',
      description: 'List your direct message conversations',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            default: 50,
            description: 'Maximum number of DM conversations to return',
          },
        },
      },
    },
    {
      name: 'slack_read_dm',
      description: 'Read messages from a direct message conversation',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to read DMs with (e.g., U1234567890)',
          },
          limit: {
            type: 'number',
            default: 20,
            description: 'Number of messages to retrieve',
          },
        },
        required: ['userId'],
      },
    },
    {
      name: 'slack_list_users',
      description: 'List users in the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            default: 100,
            description: 'Maximum number of users to return',
          },
        },
      },
    },
    {
      name: 'slack_get_user',
      description: 'Get information about a specific user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID (e.g., U1234567890)',
          },
        },
        required: ['userId'],
      },
    },
    {
      name: 'slack_get_channel_info',
      description: 'Get information about a specific channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'Channel ID (e.g., C1234567890)',
          },
        },
        required: ['channel'],
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
      name: 'slack_send_dm',
      description: 'Send a direct message to a user. Requires chat:write scope.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to send DM to (e.g., U1234567890)',
          },
          text: {
            type: 'string',
            description: 'Message text (supports Slack markdown)',
          },
        },
        required: ['userId', 'text'],
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
}

// ==================== SLACK API HELPERS ====================

// Slack API requires different HTTP methods for different endpoints
const GET_METHODS = [
  'search.messages',
  'conversations.list',
  'conversations.history',
  'conversations.replies',
  'conversations.info',
  'users.list',
  'users.info',
  'conversations.open',
];

interface SlackResponse {
  ok: boolean;
  error?: string;
}

async function slackApi<T extends SlackResponse>(
  method: string,
  token: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  const url = new URL(`https://slack.com/api/${method}`);
  const isGet = GET_METHODS.includes(method);

  let response: Response;

  if (isGet) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } else {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  }

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as T;

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

// Cache for channel name to ID resolution
const channelCache = new Map<string, string>();

async function resolveChannelId(channel: string, token: string): Promise<string> {
  // If it's already an ID (starts with C, G, or D), return it
  if (/^[CGD][A-Z0-9]+$/.test(channel)) {
    return channel;
  }

  // Remove # prefix if present
  const channelName = channel.replace(/^#/, '');

  // Check cache
  if (channelCache.has(channelName)) {
    return channelCache.get(channelName)!;
  }

  // Fetch channels and find by name
  interface ChannelListResponse extends SlackResponse {
    channels: Array<{ id: string; name: string }>;
  }

  const data = await slackApi<ChannelListResponse>('conversations.list', token, {
    types: 'public_channel,private_channel',
    limit: 200,
  });

  for (const ch of data.channels) {
    channelCache.set(ch.name, ch.id);
    if (ch.name === channelName) {
      return ch.id;
    }
  }

  throw new Error(`Channel not found: ${channel}`);
}

// Cache for user ID to name
const userCache = new Map<string, { name: string; realName: string }>();

async function enrichUserInfo(
  userId: string,
  token: string
): Promise<{ name: string; realName: string }> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    interface UserInfoResponse extends SlackResponse {
      user: { name: string; real_name: string };
    }

    const data = await slackApi<UserInfoResponse>('users.info', token, { user: userId });
    const info = { name: data.user.name, realName: data.user.real_name };
    userCache.set(userId, info);
    return info;
  } catch {
    return { name: userId, realName: userId };
  }
}

// ==================== API RESPONSE TYPES ====================

interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  num_members: number;
  purpose: { value: string };
  topic?: { value: string };
  is_archived?: boolean;
  created?: number;
}

interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  is_bot: boolean;
  deleted: boolean;
  tz?: string;
  profile: {
    title?: string;
    email?: string;
    phone?: string;
    status_text?: string;
    status_emoji?: string;
    image_192?: string;
  };
}

// ==================== HANDLERS ====================

async function handleSearch(
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

async function handleListChannels(
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

async function handleReadChannel(
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

async function handleReadThread(
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

async function handleListDms(
  args: z.infer<typeof ListDmsSchema>,
  token: string
): Promise<unknown> {
  interface DmListResponse extends SlackResponse {
    channels: Array<{ id: string; user: string }>;
  }

  const data = await slackApi<DmListResponse>('conversations.list', token, {
    types: 'im',
    limit: args.limit,
  });

  const dms = await Promise.all(
    data.channels.map(async (dm) => {
      const userInfo = await enrichUserInfo(dm.user, token);
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

async function handleReadDm(
  args: z.infer<typeof ReadDmSchema>,
  token: string
): Promise<unknown> {
  // Open/get the DM channel with this user
  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await slackApi<OpenResponse>('conversations.open', token, {
    users: args.userId,
  });

  const channelId = openData.channel.id;

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
      };
    })
  );

  return {
    channelId,
    messages: messages.reverse(),
  };
}

async function handleListUsers(
  args: z.infer<typeof ListUsersSchema>,
  token: string
): Promise<unknown> {
  interface UsersListResponse extends SlackResponse {
    members: SlackUser[];
  }

  const data = await slackApi<UsersListResponse>('users.list', token, {
    limit: args.limit,
  });

  return data.members
    .filter((u) => !u.is_bot && !u.deleted)
    .map((u) => ({
      id: u.id,
      username: u.name,
      realName: u.real_name,
      title: u.profile.title,
      email: u.profile.email,
      status: u.profile.status_text
        ? `${u.profile.status_emoji || ''} ${u.profile.status_text}`.trim()
        : undefined,
    }));
}

async function handleGetUser(
  args: z.infer<typeof GetUserSchema>,
  token: string
): Promise<unknown> {
  interface UserInfoResponse extends SlackResponse {
    user: SlackUser;
  }

  const data = await slackApi<UserInfoResponse>('users.info', token, {
    user: args.userId,
  });

  const u = data.user;
  return {
    id: u.id,
    username: u.name,
    realName: u.real_name,
    timezone: u.tz,
    title: u.profile.title,
    email: u.profile.email,
    phone: u.profile.phone,
    status: u.profile.status_text
      ? `${u.profile.status_emoji || ''} ${u.profile.status_text}`.trim()
      : undefined,
    avatar: u.profile.image_192,
  };
}

async function handleGetChannelInfo(
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

async function handleSendMessage(
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

async function handleSendDm(
  args: z.infer<typeof SendDmSchema>,
  token: string
): Promise<unknown> {
  // First open/get the DM channel
  interface OpenResponse extends SlackResponse {
    channel: { id: string };
  }

  const openData = await slackApi<OpenResponse>('conversations.open', token, {
    users: args.userId,
  });

  const channelId = openData.channel.id;

  interface PostMessageResponse extends SlackResponse {
    ts: string;
    channel: string;
    message: { text: string };
  }

  const data = await slackApi<PostMessageResponse>('chat.postMessage', token, {
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

async function handleAddReaction(
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

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: SlackContext
): Promise<ToolResponse> {
  try {
    let result: unknown;

    switch (name) {
      case 'slack_search': {
        const parsed = SearchSchema.parse(args);
        result = await handleSearch(parsed, context.token);
        break;
      }

      case 'slack_list_channels': {
        const parsed = ListChannelsSchema.parse(args);
        result = await handleListChannels(parsed, context.token);
        break;
      }

      case 'slack_read_channel': {
        const parsed = ReadChannelSchema.parse(args);
        result = await handleReadChannel(parsed, context.token);
        break;
      }

      case 'slack_read_thread': {
        const parsed = ReadThreadSchema.parse(args);
        result = await handleReadThread(parsed, context.token);
        break;
      }

      case 'slack_list_dms': {
        const parsed = ListDmsSchema.parse(args);
        result = await handleListDms(parsed, context.token);
        break;
      }

      case 'slack_read_dm': {
        const parsed = ReadDmSchema.parse(args);
        result = await handleReadDm(parsed, context.token);
        break;
      }

      case 'slack_list_users': {
        const parsed = ListUsersSchema.parse(args);
        result = await handleListUsers(parsed, context.token);
        break;
      }

      case 'slack_get_user': {
        const parsed = GetUserSchema.parse(args);
        result = await handleGetUser(parsed, context.token);
        break;
      }

      case 'slack_get_channel_info': {
        const parsed = GetChannelInfoSchema.parse(args);
        result = await handleGetChannelInfo(parsed, context.token);
        break;
      }

      case 'slack_send_message': {
        const parsed = SendMessageSchema.parse(args);
        result = await handleSendMessage(parsed, context.token);
        break;
      }

      case 'slack_send_dm': {
        const parsed = SendDmSchema.parse(args);
        result = await handleSendDm(parsed, context.token);
        break;
      }

      case 'slack_add_reaction': {
        const parsed = AddReactionSchema.parse(args);
        result = await handleAddReaction(parsed, context.token);
        break;
      }

      default:
        return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
