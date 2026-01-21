/**
 * GitHub Collector Integration Tests
 *
 * Tests the GitHub collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GitHubCollector } from '../github.js';
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

describe('GitHubCollector', () => {
  let collector: GitHubCollector;
  const mockToken = 'ghp_test_token_12345';

  beforeEach(() => {
    vi.clearAllMocks();
    (shared.getCredential as Mock).mockResolvedValue(mockToken);
    collector = new GitHubCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when github collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when no token is available', async () => {
      (shared.getCredential as Mock).mockResolvedValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('github');
    });

    it('should collect PR review requests', async () => {
      // Mock user endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      // Mock PR search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 123,
              number: 42,
              title: 'Add new feature',
              html_url: 'https://github.com/org/repo/pull/42',
              created_at: '2026-01-15T10:00:00Z',
              updated_at: '2026-01-16T10:00:00Z',
              user: { login: 'author' },
              repository_url: 'https://api.github.com/repos/org/repo',
              draft: false,
            },
          ],
        }),
      });

      // Mock issues search endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Review PR #42: Add new feature');
      expect(result.todos[0].sourceUrl).toBe('https://github.com/org/repo/pull/42');
      expect(result.todos[0].basePriority).toBe(2);
      expect(result.todos[0].tags).toContain('review');
      expect(result.todos[0].tags).toContain('pr');
      expect(result.todos[0].tags).toContain('org/repo');
    });

    it('should skip draft PRs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 123,
              number: 42,
              title: 'Draft PR',
              html_url: 'https://github.com/org/repo/pull/42',
              created_at: '2026-01-15T10:00:00Z',
              updated_at: '2026-01-16T10:00:00Z',
              user: { login: 'author' },
              repository_url: 'https://api.github.com/repos/org/repo',
              draft: true, // Draft PR
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should collect assigned issues', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 456,
              number: 100,
              title: 'Fix critical bug',
              html_url: 'https://github.com/org/repo/issues/100',
              created_at: '2026-01-10T08:00:00Z',
              updated_at: '2026-01-15T08:00:00Z',
              repository_url: 'https://api.github.com/repos/org/repo',
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Issue #100: Fix critical bug');
      expect(result.todos[0].sourceUrl).toBe('https://github.com/org/repo/issues/100');
      expect(result.todos[0].basePriority).toBe(3);
      expect(result.todos[0].tags).toContain('issue');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await collector.collect();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('GitHub API error');
    });

    it('should make correct API calls with proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await collector.collect();

      // Verify first call (get user)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `token ${mockToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'apolitical-assistant',
          }),
        })
      );
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 123,
              number: 42,
              title: 'Test PR',
              html_url: 'https://github.com/org/repo/pull/42',
              created_at: '2026-01-15T10:00:00Z',
              updated_at: '2026-01-16T10:00:00Z',
              user: { login: 'author' },
              repository_url: 'https://api.github.com/repos/org/repo',
              draft: false,
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('github.json')
      );
      expect(writeCall).toBeDefined();
      const cacheData = JSON.parse(writeCall[1]);
      expect(cacheData.lastFetch).toBeDefined();
      expect(cacheData.lastSourceIds).toContain('pr-123');
    });
  });

  describe('createTodo', () => {
    it('should create TODO with correct structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 789,
              number: 55,
              title: 'Important update',
              html_url: 'https://github.com/org/repo/pull/55',
              created_at: '2026-01-20T14:30:00Z',
              updated_at: '2026-01-20T15:00:00Z',
              user: { login: 'contributor' },
              repository_url: 'https://api.github.com/repos/org/repo',
              draft: false,
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await collector.collect();
      const todo = result.todos[0];

      expect(todo).toMatchObject({
        title: 'Review PR #55: Important update',
        source: 'github',
        sourceId: 'pr-789',
        sourceUrl: 'https://github.com/org/repo/pull/55',
        status: 'pending',
        basePriority: 2,
        urgency: 2,
      });
      expect(todo.id).toBeDefined();
      expect(todo.fingerprint).toBeDefined();
      expect(todo.createdAt).toBeDefined();
      expect(todo.updatedAt).toBeDefined();
    });
  });
});
