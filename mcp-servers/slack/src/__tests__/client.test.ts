import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackClient } from '../client.js';

// Use unique names to avoid cache collisions between tests
let testCounter = 0;
function uniqueChannelName(): string {
  return `test-channel-${testCounter++}`;
}
function uniqueUserId(): string {
  return `UCLIENTTEST${String(testCounter++).padStart(5, '0')}`;
}

function mockSlackOk(data: Record<string, unknown> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ ok: true, ...data }),
  } as Response;
}

function mockSlackError(error: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ ok: false, error }),
  } as Response;
}

function mockHttpError(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => statusText,
  } as Response;
}

describe('SlackClient.call', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: SlackClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new SlackClient('xoxp-test-token', mockFetch);
  });

  it('should use GET for GET methods and pass params as query string', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackOk({ messages: [] }));

    await client.call('search.messages', { query: 'hello', count: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('https://slack.com/api/search.messages');
    expect(url).toContain('query=hello');
    expect(url).toContain('count=10');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer xoxp-test-token');
  });

  it('should use POST for non-GET methods and pass params as JSON body', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackOk({ ts: '123.456' }));

    await client.call('chat.postMessage', {
      channel: 'C123',
      text: 'Hello!',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer xoxp-test-token');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ channel: 'C123', text: 'Hello!' });
  });

  it('should use GET for all defined GET methods', async () => {
    const getMethods = [
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
    ];

    for (const method of getMethods) {
      mockFetch.mockResolvedValueOnce(mockSlackOk());
      await client.call(method);

      const lastCall = mockFetch.mock.calls.at(-1)!;
      expect(lastCall[1].method).toBe('GET');
    }
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(mockHttpError(500, 'Internal Server Error'));

    await expect(client.call('chat.postMessage', {})).rejects.toThrow('HTTP 500');
  });

  it('should throw on Slack API error (ok: false)', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackError('channel_not_found'));

    await expect(client.call('conversations.history', { channel: 'C999' })).rejects.toThrow(
      'Slack API error: channel_not_found'
    );
  });

  it('should return typed response data', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C123', name: 'general' }],
      })
    );

    interface TestResponse {
      ok: boolean;
      channels: Array<{ id: string; name: string }>;
    }

    const result = await client.call<TestResponse>('conversations.list');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]!.id).toBe('C123');
  });
});

describe('SlackClient.resolveChannelId', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: SlackClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new SlackClient('xoxp-test-token', mockFetch);
  });

  it('should return channel ID directly if it matches ID pattern', async () => {
    const result = await client.resolveChannelId('C0123456789');
    expect(result).toBe('C0123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return group ID directly (G prefix)', async () => {
    const result = await client.resolveChannelId('G0123456789');
    expect(result).toBe('G0123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return DM ID directly (D prefix)', async () => {
    const result = await client.resolveChannelId('D0123456789');
    expect(result).toBe('D0123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should look up channel by name', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [
          { id: 'C111', name: 'other-channel' },
          { id: 'C222', name: channelName },
        ],
      })
    );

    const result = await client.resolveChannelId(channelName);
    expect(result).toBe('C222');
  });

  it('should strip # prefix from channel name', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C333', name: channelName }],
      })
    );

    const result = await client.resolveChannelId(`#${channelName}`);
    expect(result).toBe('C333');
  });

  it('should cache resolved channel IDs', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C444', name: channelName }],
      })
    );

    const result1 = await client.resolveChannelId(channelName);
    const result2 = await client.resolveChannelId(channelName);

    expect(result1).toBe('C444');
    expect(result2).toBe('C444');
    expect(mockFetch).toHaveBeenCalledOnce(); // Only one API call
  });

  it('should throw when channel is not found', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C555', name: 'different-channel' }],
      })
    );

    await expect(client.resolveChannelId(channelName)).rejects.toThrow(
      `Channel not found: ${channelName}`
    );
  });
});

describe('SlackClient.enrichUserInfo', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: SlackClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new SlackClient('xoxp-test-token', mockFetch);
  });

  it('should fetch and return user info', async () => {
    const userId = uniqueUserId();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        user: { name: 'johndoe', real_name: 'John Doe' },
      })
    );

    const result = await client.enrichUserInfo(userId);

    expect(result).toEqual({ name: 'johndoe', realName: 'John Doe' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should cache user info', async () => {
    const userId = uniqueUserId();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        user: { name: 'cached', real_name: 'Cached User' },
      })
    );

    const result1 = await client.enrichUserInfo(userId);
    const result2 = await client.enrichUserInfo(userId);

    expect(result1).toEqual({ name: 'cached', realName: 'Cached User' });
    expect(result2).toEqual({ name: 'cached', realName: 'Cached User' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should return fallback on API error', async () => {
    const userId = uniqueUserId();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await client.enrichUserInfo(userId);

    expect(result).toEqual({ name: userId, realName: userId });
  });
});

describe('SlackClient.fetchRaw', () => {
  it('should fetch with authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => 'file content',
    } as Response);

    const client = new SlackClient('xoxp-test-token', mockFetch);
    const response = await client.fetchRaw('https://files.slack.com/files-pri/T123/download');

    expect(mockFetch).toHaveBeenCalledWith('https://files.slack.com/files-pri/T123/download', {
      headers: {
        Authorization: 'Bearer xoxp-test-token',
      },
    });
    expect(await response.text()).toBe('file content');
  });
});
