/**
 * Linear Collector Integration Tests
 *
 * Tests the Linear collector with mocked GraphQL API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { LinearCollector } from '../linear.js';
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

describe('LinearCollector', () => {
  let collector: LinearCollector;
  const mockToken = 'lin_api_test_token_12345';

  beforeEach(() => {
    vi.clearAllMocks();
    (shared.getCredential as Mock).mockResolvedValue(mockToken);
    collector = new LinearCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when linear collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when no token is available', async () => {
      (shared.getCredential as Mock).mockResolvedValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('linear');
    });

    it('should collect assigned issues', async () => {
      // Mock viewer query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              id: 'user-123',
              name: 'Test User',
              email: 'test@example.com',
            },
          },
        }),
      });

      // Mock issues query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'issue-abc',
                  identifier: 'ENG-123',
                  title: 'Implement user authentication',
                  description: 'Add OAuth2 login flow',
                  url: 'https://linear.app/org/issue/ENG-123',
                  createdAt: '2026-01-10T09:00:00Z',
                  updatedAt: '2026-01-18T14:00:00Z',
                  dueDate: '2026-01-25',
                  priority: 2, // High
                  state: { name: 'In Progress', type: 'started' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [{ name: 'backend' }, { name: 'security' }] },
                },
              ],
            },
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('ENG-123: Implement user authentication');
      expect(result.todos[0].sourceUrl).toBe('https://linear.app/org/issue/ENG-123');
      expect(result.todos[0].basePriority).toBe(2); // High priority
      expect(result.todos[0].dueDate).toBe('2026-01-25');
      expect(result.todos[0].tags).toContain('ENG');
      expect(result.todos[0].tags).toContain('backend');
      expect(result.todos[0].tags).toContain('security');
    });

    it('should skip backlog items without due dates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'issue-backlog',
                  identifier: 'ENG-456',
                  title: 'Nice to have feature',
                  url: 'https://linear.app/org/issue/ENG-456',
                  createdAt: '2026-01-01T09:00:00Z',
                  updatedAt: '2026-01-01T09:00:00Z',
                  dueDate: null, // No due date
                  priority: 0, // No priority
                  state: { name: 'Backlog', type: 'backlog' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
              ],
            },
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should include backlog items with due dates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'issue-backlog-due',
                  identifier: 'ENG-789',
                  title: 'Scheduled task',
                  url: 'https://linear.app/org/issue/ENG-789',
                  createdAt: '2026-01-01T09:00:00Z',
                  updatedAt: '2026-01-01T09:00:00Z',
                  dueDate: '2026-02-01', // Has due date
                  priority: 0,
                  state: { name: 'Backlog', type: 'backlog' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
              ],
            },
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('ENG-789: Scheduled task');
    });

    it('should convert Linear priority correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'urgent-issue',
                  identifier: 'ENG-001',
                  title: 'Urgent fix',
                  url: 'https://linear.app/org/issue/ENG-001',
                  createdAt: '2026-01-20T09:00:00Z',
                  updatedAt: '2026-01-20T09:00:00Z',
                  priority: 1, // Urgent
                  state: { name: 'Todo', type: 'unstarted' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
                {
                  id: 'low-issue',
                  identifier: 'ENG-002',
                  title: 'Low priority task',
                  url: 'https://linear.app/org/issue/ENG-002',
                  createdAt: '2026-01-20T09:00:00Z',
                  updatedAt: '2026-01-20T09:00:00Z',
                  priority: 4, // Low
                  state: { name: 'Todo', type: 'unstarted' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
              ],
            },
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].basePriority).toBe(1); // Urgent
      expect(result.todos[1].basePriority).toBe(4); // Low
    });

    it('should handle GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Authentication failed' }],
        }),
      });

      const result = await collector.collect();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Linear GraphQL error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await collector.collect();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Linear API error');
    });

    it('should make correct GraphQL calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { issues: { nodes: [] } },
        }),
      });

      await collector.collect();

      // Verify GraphQL endpoint and headers
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linear.app/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: mockToken,
          }),
        })
      );
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'issue-xyz',
                  identifier: 'ENG-999',
                  title: 'Test issue',
                  url: 'https://linear.app/org/issue/ENG-999',
                  createdAt: '2026-01-20T09:00:00Z',
                  updatedAt: '2026-01-20T09:00:00Z',
                  priority: 3,
                  state: { name: 'Todo', type: 'unstarted' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
              ],
            },
          },
        }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('linear.json')
      );
      expect(writeCall).toBeDefined();
      const cacheData = JSON.parse(writeCall[1]);
      expect(cacheData.lastSourceIds).toContain('issue-xyz');
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            viewer: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [
                {
                  id: 'issue-long',
                  identifier: 'ENG-LONG',
                  title: 'Issue with long description',
                  description: longDescription,
                  url: 'https://linear.app/org/issue/ENG-LONG',
                  createdAt: '2026-01-20T09:00:00Z',
                  updatedAt: '2026-01-20T09:00:00Z',
                  priority: 3,
                  state: { name: 'Todo', type: 'unstarted' },
                  team: { name: 'Engineering', key: 'ENG' },
                  labels: { nodes: [] },
                },
              ],
            },
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos[0].description?.length).toBeLessThanOrEqual(200);
    });
  });
});
