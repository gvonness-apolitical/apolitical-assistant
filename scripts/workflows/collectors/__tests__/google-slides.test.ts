/**
 * Google Slides Collector Integration Tests
 *
 * Tests the Google Slides collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GoogleSlidesCollector } from '../google-slides.js';
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

describe('GoogleSlidesCollector', () => {
  let collector: GoogleSlidesCollector;

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
    collector = new GoogleSlidesCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when googleSlides collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when credentials are missing', async () => {
      (shared.getCredential as Mock).mockReturnValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('google-slides');
    });

    it('should extract comments with action keywords', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      // Mock Drive search for presentations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'presentation-001',
              name: 'Q4 Planning Deck',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T15:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/presentation-001/edit',
            },
          ],
        }),
      });

      // Mock comments for the presentation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-001',
              content: 'Please review this slide and update the metrics',
              resolved: false,
              createdTime: '2026-01-19T10:00:00Z',
              modifiedTime: '2026-01-19T10:00:00Z',
              author: {
                displayName: 'Jane Smith',
                emailAddress: 'jane@example.com',
              },
              quotedFileContent: {
                value: 'Revenue Chart',
              },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toContain('Slides:');
      expect(result.todos[0].title).toContain('review this slide');
      expect(result.todos[0].description).toContain('Q4 Planning Deck');
      expect(result.todos[0].description).toContain('Jane Smith');
      expect(result.todos[0].description).toContain('Revenue Chart');
      expect(result.todos[0].sourceId).toBe('gslides-presentation-001-comment-001');
      expect(result.todos[0].tags).toContain('google-slides');
      expect(result.todos[0].tags).toContain('comment');
    });

    it('should extract comments that mention the user', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      // Mock Drive search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'presentation-002',
              name: 'Team Updates',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T12:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/presentation-002/edit',
            },
          ],
        }),
      });

      // Mock comments with user mention
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-mention',
              content: 'user@example.com can you check this section?',
              resolved: false,
              createdTime: '2026-01-20T09:00:00Z',
              modifiedTime: '2026-01-20T09:00:00Z',
              author: {
                displayName: 'Bob Johnson',
                emailAddress: 'bob@example.com',
              },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].basePriority).toBe(2); // Higher priority for direct mentions
      expect(result.todos[0].urgency).toBe(2);
    });

    it('should skip resolved comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'presentation-003',
              name: 'Resolved Test',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-18T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/presentation-003/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-resolved',
              content: 'Please review this slide',
              resolved: true, // This comment is resolved
              createdTime: '2026-01-15T10:00:00Z',
              modifiedTime: '2026-01-16T10:00:00Z',
              author: {
                displayName: 'Test User',
              },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should skip comments without action keywords', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'presentation-004',
              name: 'No Action Test',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-19T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/presentation-004/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-no-action',
              content: 'Great slide!', // No action keywords
              resolved: false,
              createdTime: '2026-01-18T10:00:00Z',
              modifiedTime: '2026-01-18T10:00:00Z',
              author: {
                displayName: 'Happy User',
              },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
    });

    it('should handle multiple presentations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'pres-a',
              name: 'Presentation A',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/pres-a/edit',
            },
            {
              id: 'pres-b',
              name: 'Presentation B',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-19T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/pres-b/edit',
            },
          ],
        }),
      });

      // Comments for presentation A
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-a1',
              content: 'TODO: add more details',
              resolved: false,
              createdTime: '2026-01-19T10:00:00Z',
              modifiedTime: '2026-01-19T10:00:00Z',
              author: { displayName: 'Author A' },
            },
          ],
        }),
      });

      // Comments for presentation B
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-b1',
              content: 'Can you update this chart?',
              resolved: false,
              createdTime: '2026-01-18T10:00:00Z',
              modifiedTime: '2026-01-18T10:00:00Z',
              author: { displayName: 'Author B' },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].description).toContain('Presentation A');
      expect(result.todos[1].description).toContain('Presentation B');
    });

    it('should fetch specific presentations when configured', async () => {
      // Create collector with specific presentation IDs configured
      // The config will be loaded by the collector
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.readFileSync as Mock).mockReturnValue(
        JSON.stringify({
          collectors: {
            googleSlides: {
              enabled: true,
              presentationIds: ['specific-pres-id'],
            },
          },
        })
      );

      collector = new GoogleSlidesCollector();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      // Mock fetching specific presentation metadata
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'specific-pres-id',
          name: 'Specific Presentation',
          mimeType: 'application/vnd.google-apps.presentation',
          modifiedTime: '2026-01-20T10:00:00Z',
          webViewLink: 'https://docs.google.com/presentation/d/specific-pres-id/edit',
        }),
      });

      // Comments
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'specific-comment',
              content: 'Action needed here',
              resolved: false,
              createdTime: '2026-01-19T10:00:00Z',
              modifiedTime: '2026-01-19T10:00:00Z',
              author: { displayName: 'Author' },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].description).toContain('Specific Presentation');
    });

    it('should handle Drive API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      // Drive API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await collector.collect();

      // Error is caught internally
      expect(result.todos).toHaveLength(0);
    });

    it('should handle comments API errors for individual presentations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'pres-error',
              name: 'Error Presentation',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/pres-error/edit',
            },
          ],
        }),
      });

      // Comments API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await collector.collect();

      // Should continue without crashing, returning empty results for this presentation
      expect(result.todos).toHaveLength(0);
    });

    it('should truncate long comment titles', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'long-comment-pres',
              name: 'Long Comment Test',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/long-comment-pres/edit',
            },
          ],
        }),
      });

      const longComment =
        'Please review this extremely long comment that goes on and on about many different things and should definitely be truncated because it exceeds the maximum allowed length for a title';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'long-comment',
              content: longComment,
              resolved: false,
              createdTime: '2026-01-19T10:00:00Z',
              modifiedTime: '2026-01-19T10:00:00Z',
              author: { displayName: 'Verbose Author' },
            },
          ],
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title.length).toBeLessThanOrEqual(115); // "Slides: " (8) + truncated (100) + "..." (3)
      expect(result.todos[0].title).toContain('...');
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'cache-test-pres',
              name: 'Cache Test',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/presentation/d/cache-test-pres/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'cache-comment',
              content: 'TODO: test caching',
              resolved: false,
              createdTime: '2026-01-19T10:00:00Z',
              modifiedTime: '2026-01-19T10:00:00Z',
              author: { displayName: 'Cache Author' },
            },
          ],
        }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find((call) =>
        call[0].includes('google-slides.json')
      );
      expect(writeCall).toBeDefined();
      const cacheData = JSON.parse(writeCall[1]);
      expect(cacheData.lastSourceIds).toContain('gslides-cache-test-pres-cache-comment');
    });
  });
});
