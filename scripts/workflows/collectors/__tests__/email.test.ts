/**
 * Email Collector Integration Tests
 *
 * Tests the Email/Gmail collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EmailCollector } from '../email.js';
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

describe('EmailCollector', () => {
  let collector: EmailCollector;

  const mockCredentials = {
    'google-refresh-token': 'refresh_token_12345',
    'google-oauth-client-id': 'client_id_12345',
    'google-oauth-client-secret': 'client_secret_12345',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (shared.getCredential as Mock).mockImplementation(
      (key: string) => mockCredentials[key as keyof typeof mockCredentials] || null
    );
    collector = new EmailCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when email collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when credentials are missing', async () => {
      (shared.getCredential as Mock).mockReturnValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('email');
    });

    it('should return empty results when token refresh fails', async () => {
      // Token refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should collect starred emails', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock starred emails search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'msg-001', threadId: 'thread-001' }],
        }),
      });

      // Mock message details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg-001',
          threadId: 'thread-001',
          snippet: 'Please review the attached document...',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'Important: Review needed' },
              { name: 'From', value: 'boss@company.com' },
            ],
          },
        }),
      });

      // Mock action-required emails (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      // Mock Applied emails (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      const result = await collector.collect();

      expect(result.todos.length).toBeGreaterThanOrEqual(1);
      const starredTodo = result.todos.find((t) => t.tags?.includes('starred'));
      expect(starredTodo?.title).toBe('Email: Important: Review needed');
      expect(starredTodo?.basePriority).toBe(2);
    });

    it('should collect Applied HR platform emails', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock starred emails (empty)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      // Mock action-required emails (empty for all patterns)
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });
      }

      // Mock Applied emails search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'applied-001', threadId: 'thread-applied-001' }],
        }),
      });

      // Mock Applied message details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'applied-001',
          threadId: 'thread-applied-001',
          snippet: 'New candidate application for review...',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'Action required: Review candidate John Doe' },
              { name: 'From', value: 'notifications@beapplied.com' },
            ],
          },
        }),
      });

      const result = await collector.collect();

      const appliedTodo = result.todos.find((t) => t.tags?.includes('applied'));
      expect(appliedTodo).toBeDefined();
      expect(appliedTodo?.title).toContain('Applied:');
      expect(appliedTodo?.tags).toContain('hr');
      expect(appliedTodo?.basePriority).toBe(2);
    });

    it('should deduplicate emails by message ID', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock starred emails - same message appears
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'dupe-msg', threadId: 'thread-dupe' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'dupe-msg',
          threadId: 'thread-dupe',
          snippet: 'Duplicate message',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'Duplicate subject' },
              { name: 'From', value: 'sender@example.com' },
            ],
          },
        }),
      });

      // Mock action-required returning same message ID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'dupe-msg', threadId: 'thread-dupe' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'dupe-msg',
          threadId: 'thread-dupe',
          snippet: 'Duplicate message',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'Duplicate subject' },
              { name: 'From', value: 'sender@example.com' },
            ],
          },
        }),
      });

      // Rest of pattern searches return empty
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });
      }

      // Applied emails empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      const result = await collector.collect();

      // Should only have one TODO despite message appearing in multiple searches
      const dupeCount = result.todos.filter((t) => t.sourceId === 'dupe-msg').length;
      expect(dupeCount).toBe(1);
    });

    it('should handle Gmail API errors gracefully', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock API error for starred search - will throw and be caught
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // The collector catches errors internally and continues
      // It will throw only if all searches fail
      const result = await collector.collect();

      // When an error occurs in starred emails, the collector catches it
      // and continues with other searches, returning empty results
      expect(result.todos).toHaveLength(0);
      expect(result.source).toBe('email');
    });

    it('should create correct Gmail URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'url-test-msg', threadId: 'url-test-thread' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'url-test-msg',
          threadId: 'url-test-thread',
          snippet: 'Test message',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'URL Test' },
              { name: 'From', value: 'test@example.com' },
            ],
          },
        }),
      });

      // Empty responses for remaining searches
      for (let i = 0; i < 7; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });
      }

      const result = await collector.collect();

      const todo = result.todos[0];
      expect(todo.sourceUrl).toBe('https://mail.google.com/mail/u/0/#inbox/url-test-thread');
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: 'cache-test-msg', threadId: 'cache-test-thread' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cache-test-msg',
          threadId: 'cache-test-thread',
          snippet: 'Cache test',
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: 'Subject', value: 'Cache Test' },
              { name: 'From', value: 'test@example.com' },
            ],
          },
        }),
      });

      for (let i = 0; i < 7; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });
      }

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('email.json')
      );
      expect(writeCall).toBeDefined();
    });
  });
});
