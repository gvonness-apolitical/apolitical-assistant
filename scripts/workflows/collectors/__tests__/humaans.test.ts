/**
 * Humaans Collector Integration Tests
 *
 * Tests the Humaans HR platform collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { HumaansCollector } from '../humaans.js';
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

describe('HumaansCollector', () => {
  let collector: HumaansCollector;
  const mockToken = 'humaans_api_token_12345';

  beforeEach(() => {
    vi.clearAllMocks();
    (shared.getCredential as Mock).mockResolvedValue(mockToken);
    collector = new HumaansCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when humaans collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when no token is available', async () => {
      (shared.getCredential as Mock).mockResolvedValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('humaans');
    });

    it('should collect pending time-off approvals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'timeoff-001',
              personId: 'person-123',
              person: {
                firstName: 'John',
                lastName: 'Doe',
              },
              type: 'Annual Leave',
              startDate: '2026-02-01',
              endDate: '2026-02-05',
              status: 'pending',
              createdAt: '2026-01-18T10:00:00Z',
            },
            {
              id: 'timeoff-002',
              personId: 'person-456',
              person: {
                firstName: 'Jane',
                lastName: 'Smith',
              },
              type: 'Sick Leave',
              startDate: '2026-01-25',
              endDate: '2026-01-25',
              status: 'pending',
              createdAt: '2026-01-20T08:00:00Z',
            },
          ],
          total: 2,
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].title).toBe('Approve time off: John Doe (Annual Leave)');
      expect(result.todos[0].description).toBe('2026-02-01 to 2026-02-05');
      expect(result.todos[0].sourceId).toBe('humaans-timeoff-timeoff-001');
      expect(result.todos[0].basePriority).toBe(2); // High priority
      expect(result.todos[0].tags).toContain('humaans');
      expect(result.todos[0].tags).toContain('time-off');
      expect(result.todos[0].tags).toContain('approval');

      expect(result.todos[1].title).toBe('Approve time off: Jane Smith (Sick Leave)');
    });

    it('should handle missing person data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'timeoff-unknown',
              personId: 'person-unknown',
              // No person object
              type: 'Personal Leave',
              startDate: '2026-02-10',
              endDate: '2026-02-11',
              status: 'pending',
              createdAt: '2026-01-20T10:00:00Z',
            },
          ],
          total: 1,
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Approve time off: Unknown (Personal Leave)');
    });

    it('should create correct Humaans URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'timeoff-url-test',
              personId: 'person-789',
              person: { firstName: 'Test', lastName: 'User' },
              type: 'WFH',
              startDate: '2026-02-15',
              endDate: '2026-02-15',
              status: 'pending',
              createdAt: '2026-01-21T10:00:00Z',
            },
          ],
          total: 1,
        }),
      });

      const result = await collector.collect();

      expect(result.todos[0].sourceUrl).toBe('https://app.humaans.io/time-away/timeoff-url-test');
    });

    it('should return empty results when no pending requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          total: 0,
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      // When the API returns an error, the collector throws internally
      // which gets caught by the base collector
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await collector.collect();

      // The error is caught internally by getPendingTimeOffApprovals
      // and results in empty todos being returned
      expect(result.todos).toHaveLength(0);
      expect(result.source).toBe('humaans');
    });

    it('should make correct API calls with proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      await collector.collect();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.humaans.io/api/time-away?status=pending',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should preserve requestDate from createdAt', async () => {
      const createdAt = '2026-01-15T09:30:00Z';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'timeoff-date',
              personId: 'person-date',
              person: { firstName: 'Date', lastName: 'Test' },
              type: 'Leave',
              startDate: '2026-02-01',
              endDate: '2026-02-01',
              status: 'pending',
              createdAt,
            },
          ],
          total: 1,
        }),
      });

      const result = await collector.collect();

      expect(result.todos[0].requestDate).toBe(createdAt);
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'timeoff-cache',
              personId: 'person-cache',
              person: { firstName: 'Cache', lastName: 'Test' },
              type: 'Leave',
              startDate: '2026-02-01',
              endDate: '2026-02-01',
              status: 'pending',
              createdAt: '2026-01-20T10:00:00Z',
            },
          ],
          total: 1,
        }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('humaans.json')
      );
      expect(writeCall).toBeDefined();
      const cacheData = JSON.parse(writeCall[1]);
      expect(cacheData.lastSourceIds).toContain('humaans-timeoff-timeoff-cache');
    });
  });
});
