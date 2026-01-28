import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slackApi, resolveChannelId, enrichUserInfo } from '../handlers/api.js';

// Mock fetch globally
const mockFetch = vi.fn();

// Use unique names to avoid module-level cache collisions between tests
let testCounter = 0;
function uniqueChannelName(): string {
  return `test-channel-${testCounter++}`;
}
function uniqueUserId(): string {
  return `UAPITEST${String(testCounter++).padStart(5, '0')}`;
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
  } as Response;
}

describe('slackApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should use GET for GET methods and pass params as query string', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackOk({ messages: [] }));

    await slackApi('search.messages', 'xoxp-test-token', { query: 'hello', count: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('https://slack.com/api/search.messages');
    expect(url).toContain('query=hello');
    expect(url).toContain('count=10');
    expect(options.method).toBeUndefined(); // GET is default
    expect(options.headers.Authorization).toBe('Bearer xoxp-test-token');
  });

  it('should use POST for non-GET methods and pass params as JSON body', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackOk({ ts: '123.456' }));

    await slackApi('chat.postMessage', 'xoxp-test-token', {
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
    ];

    for (const method of getMethods) {
      mockFetch.mockResolvedValueOnce(mockSlackOk());
      await slackApi(method, 'token');

      const lastCall = mockFetch.mock.calls.at(-1)!;
      expect(lastCall[1].method).toBeUndefined();
    }
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(mockHttpError(500, 'Internal Server Error'));

    await expect(slackApi('chat.postMessage', 'token', {})).rejects.toThrow(
      'Slack API error: 500 Internal Server Error'
    );
  });

  it('should throw on Slack API error (ok: false)', async () => {
    mockFetch.mockResolvedValueOnce(mockSlackError('channel_not_found'));

    await expect(slackApi('conversations.history', 'token', { channel: 'C999' })).rejects.toThrow(
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

    const result = await slackApi<TestResponse>('conversations.list', 'token');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]!.id).toBe('C123');
  });
});

describe('resolveChannelId', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return channel ID directly if it matches ID pattern', async () => {
    const result = await resolveChannelId('C0123456789', 'token');
    expect(result).toBe('C0123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return group ID directly (G prefix)', async () => {
    const result = await resolveChannelId('G0123456789', 'token');
    expect(result).toBe('G0123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return DM ID directly (D prefix)', async () => {
    const result = await resolveChannelId('D0123456789', 'token');
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

    const result = await resolveChannelId(channelName, 'token');
    expect(result).toBe('C222');
  });

  it('should strip # prefix from channel name', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C333', name: channelName }],
      })
    );

    const result = await resolveChannelId(`#${channelName}`, 'token');
    expect(result).toBe('C333');
  });

  it('should cache resolved channel IDs', async () => {
    const channelName = uniqueChannelName();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        channels: [{ id: 'C444', name: channelName }],
      })
    );

    const result1 = await resolveChannelId(channelName, 'token');
    const result2 = await resolveChannelId(channelName, 'token');

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

    await expect(resolveChannelId(channelName, 'token')).rejects.toThrow(
      `Channel not found: ${channelName}`
    );
  });
});

describe('enrichUserInfo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch and return user info', async () => {
    const userId = uniqueUserId();
    mockFetch.mockResolvedValueOnce(
      mockSlackOk({
        user: { name: 'johndoe', real_name: 'John Doe' },
      })
    );

    const result = await enrichUserInfo(userId, 'token');

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

    const result1 = await enrichUserInfo(userId, 'token');
    const result2 = await enrichUserInfo(userId, 'token');

    expect(result1).toEqual({ name: 'cached', realName: 'Cached User' });
    expect(result2).toEqual({ name: 'cached', realName: 'Cached User' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should return fallback on API error', async () => {
    const userId = uniqueUserId();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await enrichUserInfo(userId, 'token');

    expect(result).toEqual({ name: userId, realName: userId });
  });
});
