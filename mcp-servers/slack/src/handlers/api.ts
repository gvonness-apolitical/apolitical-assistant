// Slack API Helpers and Types

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

export interface SlackResponse {
  ok: boolean;
  error?: string;
}

export async function slackApi<T extends SlackResponse>(
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

export async function resolveChannelId(channel: string, token: string): Promise<string> {
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

export async function enrichUserInfo(
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

// API Response Types
export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  thread_ts?: string;
  reply_count?: number;
}

export interface SlackChannel {
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

export interface SlackUser {
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
