import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const SLACK_API_BASE = 'https://slack.com/api';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return [
    {
      name: 'slack_search',
      description: 'Search for messages in Slack. Uses Slack search syntax (from:@user, in:#channel, has:link, before:date, after:date, etc.)',
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

// ==================== HELPERS ====================

async function slackApi(
  method: string,
  token: string,
  params: Record<string, string | number | boolean> = {}
): Promise<unknown> {
  const url = new URL(`${SLACK_API_BASE}/${method}`);

  // GET methods use query params, POST methods use form body
  const getmethods = ['search.messages', 'conversations.list', 'conversations.history',
    'conversations.replies', 'conversations.info', 'users.list', 'users.info', 'conversations.open'];

  const isGet = getmethods.includes(method);

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

  const data = (await response.json()) as { ok: boolean; error?: string };

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
  const data = (await slackApi('conversations.list', token, {
    types: 'public_channel,private_channel',
    limit: 200,
  })) as { channels: Array<{ id: string; name: string }> };

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
    const data = (await slackApi('users.info', token, { user: userId })) as {
      user: { name: string; real_name: string };
    };
    const info = { name: data.user.name, realName: data.user.real_name };
    userCache.set(userId, info);
    return info;
  } catch {
    return { name: userId, realName: userId };
  }
}

// ==================== TOOL HANDLERS ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    let result: unknown;

    switch (name) {
      case 'slack_search': {
        const { query, count = 20, sort = 'score' } = args as {
          query: string;
          count?: number;
          sort?: string;
        };

        const data = (await slackApi('search.messages', token, {
          query,
          count: Math.min(count, 100),
          sort,
        })) as {
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
        };

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

        result = {
          total: data.messages.total,
          messages,
        };
        break;
      }

      case 'slack_list_channels': {
        const { types = 'public_channel,private_channel', limit = 100 } = args as {
          types?: string;
          limit?: number;
        };

        const data = (await slackApi('conversations.list', token, {
          types,
          limit,
          exclude_archived: true,
        })) as {
          channels: Array<{
            id: string;
            name: string;
            is_private: boolean;
            is_member: boolean;
            num_members: number;
            purpose: { value: string };
          }>;
        };

        result = data.channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
          isMember: ch.is_member,
          memberCount: ch.num_members,
          purpose: ch.purpose.value,
        }));
        break;
      }

      case 'slack_read_channel': {
        const { channel, limit = 20 } = args as { channel: string; limit?: number };

        const channelId = await resolveChannelId(channel, token);

        const data = (await slackApi('conversations.history', token, {
          channel: channelId,
          limit: Math.min(limit, 100),
        })) as {
          messages: Array<{
            ts: string;
            text: string;
            user: string;
            thread_ts?: string;
            reply_count?: number;
          }>;
        };

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

        result = {
          channelId,
          messages: messages.reverse(), // Chronological order
        };
        break;
      }

      case 'slack_read_thread': {
        const { channel, threadTs, limit = 50 } = args as {
          channel: string;
          threadTs: string;
          limit?: number;
        };

        const data = (await slackApi('conversations.replies', token, {
          channel,
          ts: threadTs,
          limit,
        })) as {
          messages: Array<{
            ts: string;
            text: string;
            user: string;
          }>;
        };

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

        result = { messages };
        break;
      }

      case 'slack_list_dms': {
        const { limit = 50 } = args as { limit?: number };

        const data = (await slackApi('conversations.list', token, {
          types: 'im',
          limit,
        })) as {
          channels: Array<{
            id: string;
            user: string;
          }>;
        };

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

        result = dms;
        break;
      }

      case 'slack_read_dm': {
        const { userId, limit = 20 } = args as { userId: string; limit?: number };

        // Open/get the DM channel with this user
        const openData = (await slackApi('conversations.open', token, {
          users: userId,
        })) as { channel: { id: string } };

        const channelId = openData.channel.id;

        const data = (await slackApi('conversations.history', token, {
          channel: channelId,
          limit: Math.min(limit, 100),
        })) as {
          messages: Array<{
            ts: string;
            text: string;
            user: string;
          }>;
        };

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

        result = {
          channelId,
          messages: messages.reverse(),
        };
        break;
      }

      case 'slack_list_users': {
        const { limit = 100 } = args as { limit?: number };

        const data = (await slackApi('users.list', token, {
          limit,
        })) as {
          members: Array<{
            id: string;
            name: string;
            real_name: string;
            is_bot: boolean;
            deleted: boolean;
            profile: {
              title?: string;
              email?: string;
              status_text?: string;
              status_emoji?: string;
            };
          }>;
        };

        result = data.members
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
        break;
      }

      case 'slack_get_user': {
        const { userId } = args as { userId: string };

        const data = (await slackApi('users.info', token, {
          user: userId,
        })) as {
          user: {
            id: string;
            name: string;
            real_name: string;
            tz: string;
            profile: {
              title?: string;
              email?: string;
              phone?: string;
              status_text?: string;
              status_emoji?: string;
              image_192?: string;
            };
          };
        };

        const u = data.user;
        result = {
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
        break;
      }

      case 'slack_get_channel_info': {
        const { channel } = args as { channel: string };

        const data = (await slackApi('conversations.info', token, {
          channel,
        })) as {
          channel: {
            id: string;
            name: string;
            is_private: boolean;
            is_archived: boolean;
            num_members: number;
            topic: { value: string };
            purpose: { value: string };
            created: number;
          };
        };

        const ch = data.channel;
        result = {
          id: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
          isArchived: ch.is_archived,
          memberCount: ch.num_members,
          topic: ch.topic.value,
          purpose: ch.purpose.value,
          created: new Date(ch.created * 1000).toISOString(),
        };
        break;
      }

      case 'slack_send_message': {
        const { channel, text, threadTs, unfurlLinks = true } = args as {
          channel: string;
          text: string;
          threadTs?: string;
          unfurlLinks?: boolean;
        };

        const channelId = await resolveChannelId(channel, token);

        const params: Record<string, string | number | boolean> = {
          channel: channelId,
          text,
          unfurl_links: unfurlLinks,
        };
        if (threadTs) params.thread_ts = threadTs;

        const data = (await slackApi('chat.postMessage', token, params)) as {
          ts: string;
          channel: string;
          message: { text: string };
        };

        result = {
          success: true,
          timestamp: data.ts,
          channel: data.channel,
          text: data.message.text,
        };
        break;
      }

      case 'slack_send_dm': {
        const { userId, text } = args as { userId: string; text: string };

        // First open/get the DM channel
        const openData = (await slackApi('conversations.open', token, {
          users: userId,
        })) as { channel: { id: string } };

        const channelId = openData.channel.id;

        const data = (await slackApi('chat.postMessage', token, {
          channel: channelId,
          text,
        })) as {
          ts: string;
          channel: string;
          message: { text: string };
        };

        result = {
          success: true,
          timestamp: data.ts,
          channel: data.channel,
          userId,
          text: data.message.text,
        };
        break;
      }

      case 'slack_add_reaction': {
        const { channel, timestamp, emoji } = args as {
          channel: string;
          timestamp: string;
          emoji: string;
        };

        await slackApi('reactions.add', token, {
          channel,
          timestamp,
          name: emoji,
        });

        result = {
          success: true,
          channel,
          timestamp,
          emoji,
        };
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
