/**
 * Slack API Client
 *
 * Wraps HttpClient with Slack-specific handling:
 * - Automatic GET/POST method selection based on Slack API method
 * - Response validation for Slack's { ok: boolean, error?: string } pattern
 * - Channel name to ID resolution with caching
 * - User info enrichment with caching
 */

import { HttpClient, createBearerClient, type FetchFunction } from '@apolitical-assistant/mcp-shared';

// Slack API methods that use GET (all others use POST)
const GET_METHODS = new Set([
  'search.messages',
  'conversations.list',
  'conversations.history',
  'conversations.replies',
  'conversations.info',
  'conversations.canvases.list',
  'users.list',
  'users.info',
  'conversations.open',
  'bookmarks.list',
  'files.info',
  'files.list',
]);

/**
 * Base Slack API response shape
 */
export interface SlackResponse {
  ok: boolean;
  error?: string;
}

/**
 * Slack API client with automatic method routing and response validation
 */
export class SlackClient {
  private httpClient: HttpClient;
  private token: string;
  private fetchFn: FetchFunction;
  private channelCache = new Map<string, string>();
  private userCache = new Map<string, { name: string; realName: string }>();

  constructor(token: string, fetchFn?: FetchFunction) {
    this.token = token;
    this.fetchFn = fetchFn ?? fetch;
    this.httpClient = createBearerClient('https://slack.com/api', token, fetchFn);
  }

  /**
   * Call a Slack API method
   *
   * Automatically routes to GET or POST based on the method name.
   * Validates the response and throws on error.
   *
   * @param method - Slack API method (e.g., 'conversations.list', 'chat.postMessage')
   * @param params - Request parameters
   * @returns The API response with ok=true guaranteed
   * @throws Error if the API returns ok=false or HTTP error
   */
  async call<T extends SlackResponse>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const isGet = GET_METHODS.has(method);

    let response: T;
    if (isGet) {
      // Convert params to query string format for GET
      const queryParams: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
      response = await this.httpClient.get<T>(`/${method}`, queryParams);
    } else {
      response = await this.httpClient.post<T>(`/${method}`, params);
    }

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error || 'Unknown error'}`);
    }

    return response;
  }

  /**
   * Resolve a channel name or ID to a channel ID
   *
   * @param channel - Channel ID (C...) or name (#channel or channel)
   * @returns The channel ID
   */
  async resolveChannelId(channel: string): Promise<string> {
    // If it's already an ID (starts with C, G, or D), return it
    if (/^[CGD][A-Z0-9]+$/.test(channel)) {
      return channel;
    }

    // Remove # prefix if present
    const channelName = channel.replace(/^#/, '');

    // Check cache
    if (this.channelCache.has(channelName)) {
      return this.channelCache.get(channelName)!;
    }

    // Fetch channels and find by name
    interface ChannelListResponse extends SlackResponse {
      channels: Array<{ id: string; name: string }>;
    }

    const data = await this.call<ChannelListResponse>('conversations.list', {
      types: 'public_channel,private_channel',
      limit: 200,
    });

    for (const ch of data.channels) {
      this.channelCache.set(ch.name, ch.id);
      if (ch.name === channelName) {
        return ch.id;
      }
    }

    throw new Error(`Channel not found: ${channel}`);
  }

  /**
   * Get user info with caching
   *
   * @param userId - Slack user ID (U...)
   * @returns User name and real name
   */
  async enrichUserInfo(userId: string): Promise<{ name: string; realName: string }> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      interface UserInfoResponse extends SlackResponse {
        user: { name: string; real_name: string };
      }

      const data = await this.call<UserInfoResponse>('users.info', { user: userId });
      const info = { name: data.user.name, realName: data.user.real_name };
      this.userCache.set(userId, info);
      return info;
    } catch {
      return { name: userId, realName: userId };
    }
  }

  /**
   * Make a raw fetch request with authentication (for downloading files)
   */
  async fetchRaw(url: string): Promise<Response> {
    return this.fetchFn(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
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
