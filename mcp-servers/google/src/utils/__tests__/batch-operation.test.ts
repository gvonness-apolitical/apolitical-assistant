import { describe, it, expect, vi } from 'vitest';
import { executeBatchOperation } from '../batch-operation.js';
import type { GoogleAuth } from '../../auth.js';

// Helper to create mock response
function mockResponse(ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({}),
    text: async () => '',
  } as Response;
}

// Create a mock GoogleAuth for testing
function createMockAuth(fetchMock: typeof fetch): GoogleAuth {
  return {
    fetch: async (url: string, options?: RequestInit) => {
      return fetchMock(url, options);
    },
    getAccessToken: async () => 'mock-token',
  } as GoogleAuth;
}

describe('batch-operation', () => {
  describe('executeBatchOperation', () => {
    it('should execute operation on all message IDs', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse());
      const auth = createMockAuth(fetchMock as typeof fetch);

      const result = await executeBatchOperation(
        ['msg1', 'msg2', 'msg3'],
        {
          buildUrl: (id) => `https://example.com/messages/${id}`,
          method: 'POST',
        },
        auth
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.details).toHaveLength(3);
    });

    it('should track failed operations', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(true))
        .mockResolvedValueOnce(mockResponse(false, 404))
        .mockResolvedValueOnce(mockResponse(true));
      const auth = createMockAuth(fetchMock as typeof fetch);

      const result = await executeBatchOperation(
        ['msg1', 'msg2', 'msg3'],
        {
          buildUrl: (id) => `https://example.com/messages/${id}`,
          method: 'DELETE',
        },
        auth
      );

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.details[1]?.success).toBe(false);
      expect(result.details[1]?.error).toBe('HTTP 404');
    });

    it('should handle exceptions', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse())
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse());
      const auth = createMockAuth(fetchMock as typeof fetch);

      const result = await executeBatchOperation(
        ['msg1', 'msg2', 'msg3'],
        {
          buildUrl: (id) => `https://example.com/messages/${id}`,
          method: 'POST',
        },
        auth
      );

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.details[1]?.error).toContain('Network error');
    });

    it('should include headers when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse());
      const auth = createMockAuth(fetchMock as typeof fetch);

      await executeBatchOperation(
        ['msg1'],
        {
          buildUrl: (id) => `https://example.com/messages/${id}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        auth
      );

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/messages/msg1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should include body when buildBody is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse());
      const auth = createMockAuth(fetchMock as typeof fetch);

      await executeBatchOperation(
        ['msg1'],
        {
          buildUrl: (id) => `https://example.com/messages/${id}/modify`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          buildBody: () => ({ removeLabelIds: ['INBOX'] }),
        },
        auth
      );

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/messages/msg1/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      });
    });

    it('should handle empty message array', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse());
      const auth = createMockAuth(fetchMock as typeof fetch);

      const result = await executeBatchOperation(
        [],
        {
          buildUrl: (id) => `https://example.com/messages/${id}`,
          method: 'POST',
        },
        auth
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.details).toHaveLength(0);
    });
  });
});
