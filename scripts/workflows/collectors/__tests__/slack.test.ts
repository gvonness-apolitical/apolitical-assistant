/**
 * Slack Collector Integration Tests
 *
 * Tests the Slack collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { SlackCollector } from '../slack.js';
import * as shared from '@apolitical-assistant/shared';
import * as fs from 'node:fs';

// Mock dependencies
vi.mock('@apolitical-assistant/shared', async () => {
  const actual = await vi.importActual('@apolitical-assistant/shared');
  return {
    ...actual,
    getCredential: vi.fn(),
    generateFingerprint: vi.fn((title: string) => `fp-${title.slice(0, 10)}`),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SlackCollector', () => {
  let collector: SlackCollector;
  const mockToken = 'xoxb-test-token-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    (shared.getCredential as Mock).mockResolvedValue(mockToken);
    collector = new SlackCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when slack collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when no token is available', async () => {
      (shared.getCredential as Mock).mockResolvedValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('slack');
    });

    it('should collect action items from messages', async () => {
      const timestamp = Date.now() / 1000;

      // Mock search for "action item" pattern
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: {
            matches: [
              {
                ts: String(timestamp),
                text: 'Action item: Review the quarterly report',
                user: 'U12345',
                channel: 'C12345',
                permalink: 'https://slack.com/archives/C12345/p123456',
              },
            ],
            total: 1,
          },
        }),
      });

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: { id: 'U12345', name: 'johndoe', real_name: 'John Doe' },
        }),
      });

      // Mock remaining pattern searches (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: { matches: [], total: 0 } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: { matches: [], total: 0 } }),
      });

      // Mock saved items (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [] }),
      });

      const result = await collector.collect();

      expect(result.todos.length).toBeGreaterThanOrEqual(1);
      const actionTodo = result.todos.find((t) => t.tags?.includes('action-item'));
      expect(actionTodo).toBeDefined();
      expect(actionTodo?.title).toContain('Slack:');
      expect(actionTodo?.sourceUrl).toBe('https://slack.com/archives/C12345/p123456');
    });

    it('should collect saved items (stars)', async () => {
      const timestamp = Date.now() / 1000;

      // Mock empty search results for action patterns
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: { matches: [], total: 0 } }),
        });
      }

      // Mock saved items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          items: [
            {
              type: 'message',
              message: {
                ts: String(timestamp),
                text: 'Important: Remember to follow up on this',
                user: 'U67890',
                permalink: 'https://slack.com/archives/C67890/p789012',
              },
              date_create: timestamp,
            },
          ],
        }),
      });

      // Mock user info for saved item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: { id: 'U67890', name: 'janedoe', real_name: 'Jane Doe' },
        }),
      });

      const result = await collector.collect();

      const savedTodo = result.todos.find((t) => t.tags?.includes('saved'));
      expect(savedTodo).toBeDefined();
      expect(savedTodo?.basePriority).toBe(2); // Saved items are high priority
    });

    it('should extract title from message text', async () => {
      const timestamp = Date.now() / 1000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: {
            matches: [
              {
                ts: String(timestamp),
                text: 'Can you please review the PR?\nIt has some important changes.',
                user: 'U12345',
                permalink: 'https://slack.com/archives/C12345/p123456',
              },
            ],
            total: 1,
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: { id: 'U12345', name: 'dev', real_name: 'Developer' },
        }),
      });

      for (let i = 0; i < 2; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: { matches: [], total: 0 } }),
        });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [] }),
      });

      const result = await collector.collect();

      // Title should be the first sentence
      expect(result.todos[0].title).toContain('Slack: Can you please review the PR');
    });

    it('should clean up Slack formatting in titles', async () => {
      const timestamp = Date.now() / 1000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: {
            matches: [
              {
                ts: String(timestamp),
                text: '<@U12345> check <#C12345|general>',
                user: 'U67890',
                permalink: 'https://slack.com/archives/C12345/p123456',
              },
            ],
            total: 1,
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: { id: 'U67890', name: 'sender' },
        }),
      });

      for (let i = 0; i < 2; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: { matches: [], total: 0 } }),
        });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [] }),
      });

      const result = await collector.collect();

      // Slack formatting should be cleaned up
      expect(result.todos[0].title).toContain('@user');
      expect(result.todos[0].title).toContain('#general');
      expect(result.todos[0].title).not.toContain('<@U12345>');
    });

    it('should handle API errors gracefully', async () => {
      // First search throws an error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // The collector catches errors internally for individual searches
      // but continues with other patterns
      const result = await collector.collect();

      // When network errors occur, the collector catches them
      // and returns empty results (errors are logged internally)
      expect(result.todos).toHaveLength(0);
      expect(result.source).toBe('slack');
    });

    it('should cache user lookups', async () => {
      const timestamp = Date.now() / 1000;

      // Two messages from same user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: {
            matches: [
              {
                ts: String(timestamp),
                text: 'First action item',
                user: 'U_SAME',
                permalink: 'https://slack.com/archives/C1/p1',
              },
              {
                ts: String(timestamp + 1),
                text: 'Second action item',
                user: 'U_SAME', // Same user
                permalink: 'https://slack.com/archives/C1/p2',
              },
            ],
            total: 2,
          },
        }),
      });

      // User lookup - should only happen once
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: { id: 'U_SAME', name: 'cached_user', real_name: 'Cached User' },
        }),
      });

      for (let i = 0; i < 2; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: { matches: [], total: 0 } }),
        });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [] }),
      });

      await collector.collect();

      // Count user info calls - should only be 1 due to caching
      const userInfoCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('users.info')
      );
      expect(userInfoCalls).toHaveLength(1);
    });

    it('should update cache after successful collection', async () => {
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: { matches: [], total: 0 } }),
        });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [] }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('slack.json')
      );
      expect(writeCall).toBeDefined();
    });
  });
});
