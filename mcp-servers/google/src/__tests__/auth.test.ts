import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockJsonResponse } from '@apolitical-assistant/mcp-shared/testing';
import {
  GoogleAuth,
  AccessDeniedError,
  AccessControlConfig,
  extractResourceId,
  loadAccessControlConfig,
} from '../auth.js';

describe('GoogleAuth', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createAuth(): GoogleAuth {
    return new GoogleAuth('test-client-id', 'test-client-secret', 'test-refresh-token');
  }

  function createAuthWithConfig(config: AccessControlConfig): GoogleAuth {
    return new GoogleAuth('test-client-id', 'test-client-secret', 'test-refresh-token', config);
  }

  /** Queue a token refresh response */
  function mockTokenRefresh(): void {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ access_token: 'test-token', expires_in: 3600 })
    );
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

  describe('extractResourceId', () => {
    it('should extract file ID from Drive API URLs', () => {
      expect(extractResourceId('https://www.googleapis.com/drive/v3/files/abc123')).toBe('abc123');
      expect(extractResourceId('https://www.googleapis.com/drive/v3/files/abc123?fields=parents')).toBe('abc123');
      expect(extractResourceId('https://www.googleapis.com/drive/v2/files/abc123')).toBe('abc123');
    });

    it('should extract document ID from Docs API URLs', () => {
      expect(extractResourceId('https://docs.googleapis.com/v1/documents/doc-id-123')).toBe('doc-id-123');
      expect(extractResourceId('https://docs.googleapis.com/v1/documents/doc-id-123?fields=body')).toBe('doc-id-123');
    });

    it('should extract spreadsheet ID from Sheets API URLs', () => {
      expect(extractResourceId('https://sheets.googleapis.com/v4/spreadsheets/sheet-id')).toBe('sheet-id');
      expect(extractResourceId('https://sheets.googleapis.com/v4/spreadsheets/sheet-id:batchUpdate')).toBe('sheet-id');
    });

    it('should extract presentation ID from Slides API URLs', () => {
      expect(extractResourceId('https://slides.googleapis.com/v1/presentations/pres-id')).toBe('pres-id');
      expect(extractResourceId('https://slides.googleapis.com/v1/presentations/pres-id:batchUpdate')).toBe('pres-id');
    });

    it('should extract form ID from Forms API URLs', () => {
      expect(extractResourceId('https://forms.googleapis.com/v1/forms/form-id')).toBe('form-id');
      expect(extractResourceId('https://forms.googleapis.com/v1/forms/form-id?fields=info')).toBe('form-id');
    });

    it('should return null for search/list URLs', () => {
      expect(extractResourceId('https://www.googleapis.com/drive/v3/files?q=name')).toBeNull();
      expect(extractResourceId('https://www.googleapis.com/gmail/v1/users/me/messages')).toBeNull();
      expect(extractResourceId('https://oauth2.googleapis.com/token')).toBeNull();
    });
  });

  describe('access control', () => {
    it('should block access to directly blocked files', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFiles: [{ id: 'secret-doc', name: 'Secret Doc', reason: 'Sensitive' }],
        blockedFolders: [],
      });

      mockTokenRefresh();

      await expect(
        auth.fetch('https://docs.googleapis.com/v1/documents/secret-doc')
      ).rejects.toThrow(AccessDeniedError);

      await expect(
        auth.fetch('https://docs.googleapis.com/v1/documents/secret-doc')
      ).rejects.toThrow(/directly blocked/);
    });

    it('should block access to files in blocked folders', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'blocked-folder', name: 'HR Folder', reason: 'Sensitive HR data' }],
        blockedFiles: [],
      });

      mockTokenRefresh();

      // Parent resolution: file -> blocked-folder -> root (no parents)
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ parents: ['blocked-folder'] })
      );
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({}) // root — no parents
      );

      await expect(
        auth.fetch('https://docs.googleapis.com/v1/documents/some-doc-in-folder')
      ).rejects.toThrow(AccessDeniedError);

      // Second call uses cached parents — no extra mocks needed
      await expect(
        auth.fetch('https://docs.googleapis.com/v1/documents/some-doc-in-folder')
      ).rejects.toThrow(/blocked folder "HR Folder"/);
    });

    it('should block access to files in nested subfolders of blocked folders', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'top-folder', name: 'Top Secret', reason: 'Classified' }],
        blockedFiles: [],
      });

      mockTokenRefresh();

      // Parent resolution: file -> subfolder -> top-folder -> root
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ parents: ['subfolder'] })
      );
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ parents: ['top-folder'] })
      );
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({}) // root — no parents
      );

      await expect(
        auth.fetch('https://www.googleapis.com/drive/v3/files/nested-file')
      ).rejects.toThrow(AccessDeniedError);
    });

    it('should allow access to non-blocked files', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'blocked-folder', name: 'Blocked', reason: 'test' }],
        blockedFiles: [],
      });

      mockTokenRefresh();

      // Parent resolution: file -> safe-folder -> root (no parents)
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ parents: ['safe-folder'] })
      );
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({}) // No parents — root reached
      );

      // Actual API response
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ body: { content: [] } })
      );

      const response = await auth.fetch('https://docs.googleapis.com/v1/documents/allowed-doc');
      const data = await response.json();
      expect(data).toEqual({ body: { content: [] } });
    });

    it('should allow search/list URLs through without checking', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'blocked-folder', name: 'Blocked', reason: 'test' }],
        blockedFiles: [],
      });

      mockTokenRefresh();

      // Search API call response
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ files: [{ id: 'file1', name: 'test.doc' }] })
      );

      const response = await auth.fetch(
        'https://www.googleapis.com/drive/v3/files?q=name%20contains%20%27test%27'
      );
      const data = await response.json();
      expect(data).toEqual({ files: [{ id: 'file1', name: 'test.doc' }] });

      // Only token refresh + search call, no parent resolution
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not block anything when disabled', async () => {
      const auth = createAuthWithConfig({
        enabled: false,
        blockedFiles: [{ id: 'secret-doc', name: 'Secret', reason: 'test' }],
        blockedFolders: [{ id: 'blocked-folder', name: 'Blocked', reason: 'test' }],
      });

      mockTokenRefresh();

      // API response (no parent resolution since disabled)
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ body: { content: [] } })
      );

      const response = await auth.fetch('https://docs.googleapis.com/v1/documents/secret-doc');
      const data = await response.json();
      expect(data).toEqual({ body: { content: [] } });

      // Only token refresh + API call, no access checks
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should cache parent folder resolution', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'blocked-folder', name: 'Blocked', reason: 'test' }],
        blockedFiles: [],
      });

      // First fetch: token refresh
      mockTokenRefresh();

      // First fetch: parent resolution — file is in safe-folder -> root
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ parents: ['safe-folder'] })
      );
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({}) // root
      );

      // First fetch: actual API call
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ data: 'first' })
      );

      await auth.fetch('https://docs.googleapis.com/v1/documents/cached-doc');

      // Second fetch for the same doc: should NOT resolve parents again
      // Only the actual API call
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ data: 'second' })
      );

      await auth.fetch('https://docs.googleapis.com/v1/documents/cached-doc');

      // Total: 1 token + 2 parent lookups + 1 first API + 1 second API = 5
      // (no parent lookups for the second call)
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should handle parent resolution API errors gracefully', async () => {
      const auth = createAuthWithConfig({
        enabled: true,
        blockedFolders: [{ id: 'blocked-folder', name: 'Blocked', reason: 'test' }],
        blockedFiles: [],
      });

      mockTokenRefresh();

      // Parent resolution fails (e.g., file not found)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      } as Response);

      // Actual API call proceeds (fail-open for parent resolution errors)
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ data: 'ok' })
      );

      const response = await auth.fetch('https://docs.googleapis.com/v1/documents/unknown-doc');
      const data = await response.json();
      expect(data).toEqual({ data: 'ok' });
    });
  });
});
