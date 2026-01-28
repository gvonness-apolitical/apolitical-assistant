import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockJsonResponse } from '@apolitical-assistant/mcp-shared/testing';
import { GoogleAuth } from '../auth.js';

describe('GoogleAuth', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createAuth(): GoogleAuth {
    return new GoogleAuth('test-client-id', 'test-client-secret', 'test-refresh-token');
  }

  describe('getAccessToken', () => {
    it('should fetch a new access token from Google OAuth', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'new-access-token', expires_in: 3600 })
      );

      const auth = createAuth();
      const token = await auth.getAccessToken();

      expect(token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: expect.any(URLSearchParams),
      });

      // Verify the body parameters
      const body = mockFetch.mock.calls[0]![1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('refresh_token')).toBe('test-refresh-token');
      expect(body.get('grant_type')).toBe('refresh_token');
    });

    it('should return cached token when not expired', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'cached-token', expires_in: 3600 })
      );

      const auth = createAuth();

      const token1 = await auth.getAccessToken();
      const token2 = await auth.getAccessToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledOnce(); // Only one fetch call
    });

    it('should refresh token when within 5-minute expiry buffer', async () => {
      // First call - token that expires very soon
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'short-lived-token', expires_in: 60 }) // 1 minute
      );

      const auth = createAuth();
      const token1 = await auth.getAccessToken();
      expect(token1).toBe('short-lived-token');

      // Advance time past the 5-minute buffer (token expires in 60s, buffer is 300s)
      // Since 60s < 300s buffer, next call should refresh
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'refreshed-token', expires_in: 3600 })
      );

      const token2 = await auth.getAccessToken();
      expect(token2).toBe('refreshed-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid refresh token',
      } as Response);

      const auth = createAuth();

      await expect(auth.getAccessToken()).rejects.toThrow(
        'Token refresh failed: Invalid refresh token'
      );
    });
  });

  describe('fetch', () => {
    it('should add Authorization header to requests', async () => {
      // Token refresh
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'bearer-token', expires_in: 3600 })
      );

      // Actual API call
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: 'test' }));

      const auth = createAuth();
      await auth.fetch('https://www.googleapis.com/api/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const apiCall = mockFetch.mock.calls[1]!;
      expect(apiCall[0]).toBe('https://www.googleapis.com/api/test');

      const headers = apiCall[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer bearer-token');
    });

    it('should preserve existing headers and options', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'bearer-token', expires_in: 3600 })
      );
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ result: 'ok' }));

      const auth = createAuth();
      await auth.fetch('https://www.googleapis.com/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      });

      const apiCall = mockFetch.mock.calls[1]!;
      expect(apiCall[1].method).toBe('POST');
      expect(apiCall[1].body).toBe(JSON.stringify({ key: 'value' }));

      const headers = apiCall[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer bearer-token');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should use cached token for subsequent fetch calls', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: 'cached-token', expires_in: 3600 })
      );
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: 'first' }));
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: 'second' }));

      const auth = createAuth();
      await auth.fetch('https://api.example.com/first');
      await auth.fetch('https://api.example.com/second');

      // 1 token refresh + 2 API calls = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
