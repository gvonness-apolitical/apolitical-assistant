import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';
import { handleToolCall } from '../tools.js';
import type { SlackContext } from '../index.js';

// Mock the global fetch
const mockFetch = vi.fn();

// Create mock response helper
function mockSlackResponse(data: Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => ({ ok: true, ...data }),
  } as Response;
}

// Create a mock context
function createMockContext(): SlackContext {
  return {
    client: {} as HttpClient,
    token: 'xoxb-mock-token',
  };
}

// Use unique user IDs per test to avoid cache issues
let testCounter = 0;
function uniqueUserId(): string {
  return `UTEST${String(testCounter++).padStart(8, '0')}`;
}

describe('Slack Handlers', () => {
  let context: SlackContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Replace global fetch with our mock
    vi.stubGlobal('fetch', mockFetch);
    context = createMockContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('handleToolCall - slack_search', () => {
    it('should return search results with user enrichment', async () => {
      const userId = uniqueUserId();

      // Search API call
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          messages: {
            total: 2,
            matches: [
              {
                ts: '1234567890.123456',
                text: 'Hello world',
                user: userId,
                channel: { id: 'C456', name: 'general' },
                permalink: 'https://slack.com/archives/C456/p1234567890123456',
              },
            ],
          },
        })
      );

      // User info enrichment call
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          user: { name: 'johndoe', real_name: 'John Doe' },
        })
      );

      const result = await handleToolCall(
        'slack_search',
        { query: 'hello', count: 20, sort: 'score' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.total).toBe(2);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].text).toBe('Hello world');
      expect(data.messages[0].user).toBe('John Doe');
      expect(data.messages[0].channel).toBe('general');
    });
  });

  describe('handleToolCall - slack_list_channels', () => {
    it('should return channel list', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channels: [
            {
              id: 'C123',
              name: 'general',
              is_private: false,
              is_member: true,
              num_members: 50,
              purpose: { value: 'General discussion' },
            },
            {
              id: 'C456',
              name: 'engineering',
              is_private: true,
              is_member: true,
              num_members: 20,
              purpose: { value: 'Engineering team' },
            },
          ],
        })
      );

      const result = await handleToolCall('slack_list_channels', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('general');
      expect(data[0].isPrivate).toBe(false);
      expect(data[1].name).toBe('engineering');
      expect(data[1].isPrivate).toBe(true);
    });
  });

  describe('handleToolCall - slack_read_channel', () => {
    it('should return channel messages with user info', async () => {
      const userId1 = uniqueUserId();
      const userId2 = uniqueUserId();

      // History API call (channel ID starts with C, so no resolution needed)
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          messages: [
            {
              ts: '1234567890.123456',
              text: 'First message',
              user: userId1,
              thread_ts: undefined,
              reply_count: 0,
            },
            {
              ts: '1234567891.123456',
              text: 'Second message',
              user: userId2,
              thread_ts: '1234567890.123456',
              reply_count: 5,
            },
          ],
        })
      );

      // User info calls
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'alice', real_name: 'Alice' } })
      );
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'bob', real_name: 'Bob' } })
      );

      const result = await handleToolCall(
        'slack_read_channel',
        { channel: 'C123456789', limit: 20 },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.channelId).toBe('C123456789');
      expect(data.messages).toHaveLength(2);
      // Messages should be reversed (chronological order)
      expect(data.messages[0].text).toBe('Second message');
      expect(data.messages[1].text).toBe('First message');
    });
  });

  describe('handleToolCall - slack_read_thread', () => {
    it('should return thread replies', async () => {
      const userId1 = uniqueUserId();
      const userId2 = uniqueUserId();
      const userId3 = uniqueUserId();

      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          messages: [
            { ts: '123.456', text: 'Parent message', user: userId1 },
            { ts: '123.457', text: 'Reply 1', user: userId2 },
            { ts: '123.458', text: 'Reply 2', user: userId3 },
          ],
        })
      );

      // User info calls
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'user1', real_name: 'User 1' } })
      );
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'user2', real_name: 'User 2' } })
      );
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'user3', real_name: 'User 3' } })
      );

      const result = await handleToolCall(
        'slack_read_thread',
        { channel: 'C123', threadTs: '123.456', limit: 50 },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.messages).toHaveLength(3);
      expect(data.messages[0].text).toBe('Parent message');
      expect(data.messages[2].text).toBe('Reply 2');
    });
  });

  describe('handleToolCall - slack_list_users', () => {
    it('should return filtered user list', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          members: [
            {
              id: uniqueUserId(),
              name: 'alice',
              real_name: 'Alice Smith',
              is_bot: false,
              deleted: false,
              profile: { title: 'Engineer', email: 'alice@example.com' },
            },
            {
              id: uniqueUserId(),
              name: 'slackbot',
              real_name: 'Slackbot',
              is_bot: true,
              deleted: false,
              profile: {},
            },
            {
              id: uniqueUserId(),
              name: 'olduser',
              real_name: 'Old User',
              is_bot: false,
              deleted: true,
              profile: {},
            },
          ],
        })
      );

      const result = await handleToolCall('slack_list_users', { limit: 100 }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      // Should filter out bots and deleted users
      expect(data).toHaveLength(1);
      expect(data[0].username).toBe('alice');
      expect(data[0].email).toBe('alice@example.com');
    });
  });

  describe('handleToolCall - slack_get_user', () => {
    it('should return user details', async () => {
      const userId = uniqueUserId();

      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          user: {
            id: userId,
            name: 'johndoe',
            real_name: 'John Doe',
            tz: 'America/New_York',
            profile: {
              title: 'Senior Engineer',
              email: 'john@example.com',
              phone: '+1234567890',
              status_emoji: ':coffee:',
              status_text: 'In a meeting',
              image_192: 'https://example.com/avatar.png',
            },
          },
        })
      );

      const result = await handleToolCall('slack_get_user', { userId }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.id).toBe(userId);
      expect(data.username).toBe('johndoe');
      expect(data.realName).toBe('John Doe');
      expect(data.timezone).toBe('America/New_York');
      expect(data.status).toBe(':coffee: In a meeting');
    });
  });

  describe('handleToolCall - slack_get_channel_info', () => {
    it('should return channel details', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channel: {
            id: 'C123',
            name: 'engineering',
            is_private: false,
            is_archived: false,
            num_members: 25,
            topic: { value: 'Engineering discussions' },
            purpose: { value: 'All things engineering' },
            created: 1609459200,
          },
        })
      );

      const result = await handleToolCall('slack_get_channel_info', { channel: 'C123' }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.id).toBe('C123');
      expect(data.name).toBe('engineering');
      expect(data.memberCount).toBe(25);
      expect(data.topic).toBe('Engineering discussions');
    });
  });

  describe('handleToolCall - slack_send_message', () => {
    it('should send message and return result', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          ts: '1234567890.123456',
          channel: 'C123',
          message: { text: 'Hello!' },
        })
      );

      const result = await handleToolCall(
        'slack_send_message',
        { channel: 'C123456789', text: 'Hello!', unfurlLinks: true },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBe('1234567890.123456');
      expect(data.text).toBe('Hello!');
    });
  });

  describe('handleToolCall - slack_send_dm', () => {
    it('should open DM and send message', async () => {
      // Open conversation
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channel: { id: 'D123' },
        })
      );

      // Send message
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          ts: '1234567890.123456',
          channel: 'D123',
          message: { text: 'Hi there!' },
        })
      );

      const result = await handleToolCall(
        'slack_send_dm',
        { userId: uniqueUserId(), text: 'Hi there!' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('D123');
    });
  });

  describe('handleToolCall - slack_add_reaction', () => {
    it('should add reaction and return result', async () => {
      mockFetch.mockResolvedValueOnce(mockSlackResponse({}));

      const result = await handleToolCall(
        'slack_add_reaction',
        { channel: 'C123', timestamp: '123.456', emoji: 'thumbsup' },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.success).toBe(true);
      expect(data.emoji).toBe('thumbsup');
    });
  });

  describe('handleToolCall - slack_list_dms', () => {
    it('should list DM conversations', async () => {
      const userId = uniqueUserId();

      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channels: [{ id: 'D123', user: userId }],
        })
      );

      // User enrichment
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'testuser', real_name: 'Test User' } })
      );

      const result = await handleToolCall('slack_list_dms', { limit: 50 }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data).toHaveLength(1);
      expect(data[0].channelId).toBe('D123');
      expect(data[0].userName).toBe('testuser');
    });
  });

  describe('handleToolCall - slack_read_dm', () => {
    it('should read DM messages', async () => {
      const userId = uniqueUserId();
      const messageUserId = uniqueUserId();

      // Open conversation
      mockFetch.mockResolvedValueOnce(mockSlackResponse({ channel: { id: 'D456' } }));

      // Get history
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          messages: [{ ts: '123.456', text: 'Hi there', user: messageUserId }],
        })
      );

      // User enrichment
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({ user: { name: 'someone', real_name: 'Someone' } })
      );

      const result = await handleToolCall('slack_read_dm', { userId, limit: 20 }, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.channelId).toBe('D456');
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].text).toBe('Hi there');
    });
  });

  describe('handleToolCall - error handling', () => {
    it('should return error for unknown tool', async () => {
      const result = await handleToolCall('unknown_tool', {}, context);

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.error).toBe('Unknown tool: unknown_tool');
    });
  });

  describe('handleToolCall - slack_list_canvases', () => {
    it('should return both channel canvas and standalone canvases', async () => {
      // conversations.info returns channel canvas
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channel: {
            id: 'D123',
            name: 'dm-channel',
            properties: {
              canvas: {
                file_id: 'F_CHANNEL_CANVAS',
                is_empty: false,
              },
            },
          },
        })
      );

      // files.list returns standalone canvases
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          files: [
            {
              id: 'F_STANDALONE_1',
              name: '121 Agenda Items',
              title: '121 Agenda Items',
              filetype: 'canvas',
              created: 1700000000,
              updated: 1700001000,
              user: 'U123',
            },
            {
              id: 'F_STANDALONE_2',
              name: 'Meeting Notes',
              title: 'Meeting Notes',
              filetype: 'canvas',
              created: 1700002000,
              updated: 1700003000,
              user: 'U456',
            },
          ],
        })
      );

      const result = await handleToolCall(
        'slack_list_canvases',
        { channel_id: 'D123', limit: 20 },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.canvases).toHaveLength(3);
      expect(data.canvases[0].id).toBe('F_CHANNEL_CANVAS');
      expect(data.canvases[0].type).toBe('channel_canvas');
      expect(data.canvases[1].id).toBe('F_STANDALONE_1');
      expect(data.canvases[1].type).toBe('standalone');
      expect(data.canvases[1].title).toBe('121 Agenda Items');
      expect(data.canvases[2].id).toBe('F_STANDALONE_2');
    });

    it('should dedupe canvases that appear in both sources', async () => {
      const sharedCanvasId = 'F_SHARED_CANVAS';

      // conversations.info returns channel canvas
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channel: {
            id: 'D123',
            properties: {
              canvas: {
                file_id: sharedCanvasId,
                is_empty: false,
              },
            },
          },
        })
      );

      // files.list returns same canvas (should be deduped)
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          files: [
            {
              id: sharedCanvasId,
              name: 'Shared Canvas',
              title: 'Shared Canvas',
              filetype: 'canvas',
              created: 1700000000,
              updated: 1700001000,
              user: 'U123',
            },
          ],
        })
      );

      const result = await handleToolCall(
        'slack_list_canvases',
        { channel_id: 'D123', limit: 20 },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.canvases).toHaveLength(1);
      expect(data.canvases[0].id).toBe(sharedCanvasId);
    });

    it('should return standalone canvases when no channel canvas exists', async () => {
      // conversations.info returns no canvas
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          channel: {
            id: 'D123',
            properties: {},
          },
        })
      );

      // files.list returns standalone canvases
      mockFetch.mockResolvedValueOnce(
        mockSlackResponse({
          files: [
            {
              id: 'F_STANDALONE',
              name: '121 Agenda Items',
              title: '121 Agenda Items',
              filetype: 'canvas',
              created: 1700000000,
              updated: 1700001000,
              user: 'U123',
            },
          ],
        })
      );

      const result = await handleToolCall(
        'slack_list_canvases',
        { channel_id: 'D123', limit: 20 },
        context
      );

      const data = JSON.parse((result.content[0] as { text: string }).text);
      expect(data.canvases).toHaveLength(1);
      expect(data.canvases[0].id).toBe('F_STANDALONE');
      expect(data.canvases[0].type).toBe('standalone');
      expect(data.canvases[0].title).toBe('121 Agenda Items');
    });
  });
});
