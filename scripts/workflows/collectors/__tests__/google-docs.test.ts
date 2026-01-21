/**
 * Google Docs Collector Integration Tests
 *
 * Tests the Google Docs collector with mocked API responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GoogleDocsCollector } from '../google-docs.js';
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

describe('GoogleDocsCollector', () => {
  let collector: GoogleDocsCollector;

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
    collector = new GoogleDocsCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when google-docs collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should return empty results when credentials are missing', async () => {
      (shared.getCredential as Mock).mockReturnValue(null);

      const result = await collector.collect({ verbose: false });

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('google-docs');
    });

    it('should extract @TODO patterns from documents', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Mock Drive API - list files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-001',
              name: 'Project Notes',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/doc-001/edit',
            },
          ],
        }),
      });

      // Mock Docs API - get document content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            content: [
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: '@TODO: Complete the API integration\n',
                      },
                    },
                  ],
                },
              },
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: 'Some other content here.\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Doc: Complete the API integration');
      expect(result.todos[0].sourceUrl).toBe('https://docs.google.com/document/d/doc-001/edit');
      expect(result.todos[0].tags).toContain('google-docs');
      expect(result.todos[0].tags).toContain('Project Notes');
    });

    it('should extract ACTION: patterns', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-action',
              name: 'Meeting Notes',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/doc-action/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            content: [
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: 'ACTION: Schedule follow-up meeting with team\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Doc: Schedule follow-up meeting with team');
    });

    it('should extract unchecked checkbox patterns', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-checkbox',
              name: 'Task List',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/doc-checkbox/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            content: [
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: '[ ] Review pull request #123\n',
                      },
                    },
                  ],
                },
              },
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: '[x] Already completed task\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Doc: Review pull request #123');
    });

    it('should handle multiple TODOs in one document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-multi',
              name: 'Multiple TODOs',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/doc-multi/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            content: [
              {
                paragraph: {
                  elements: [
                    {
                      textRun: {
                        content: '@TODO: First task\n@TODO: Second task\nACTION: Third task\n',
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos).toHaveLength(3);
    });

    it('should use requestDate from document modification time', async () => {
      const modifiedTime = '2026-01-15T14:30:00Z';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-date',
              name: 'Dated Doc',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime,
              webViewLink: 'https://docs.google.com/document/d/doc-date/edit',
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          body: {
            content: [
              {
                paragraph: {
                  elements: [{ textRun: { content: '@TODO: Task with date\n' } }],
                },
              },
            ],
          },
        }),
      });

      const result = await collector.collect();

      expect(result.todos[0].requestDate).toBe(modifiedTime);
    });

    it('should handle Drive API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await collector.collect();

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle Docs API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'doc-error',
              name: 'Error Doc',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: '2026-01-20T10:00:00Z',
              webViewLink: 'https://docs.google.com/document/d/doc-error/edit',
            },
          ],
        }),
      });

      // Docs API fails for this document
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await collector.collect();

      // Should not crash, just skip the problematic document
      expect(result.todos).toHaveLength(0);
    });

    it('should limit documents processed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      // Return more than 10 documents
      const manyDocs = Array.from({ length: 20 }, (_, i) => ({
        id: `doc-${i}`,
        name: `Document ${i}`,
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '2026-01-20T10:00:00Z',
        webViewLink: `https://docs.google.com/document/d/doc-${i}/edit`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: manyDocs }),
      });

      // Mock doc content for each (limit to 10)
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            body: {
              content: [
                {
                  paragraph: {
                    elements: [{ textRun: { content: `@TODO: Task from doc ${i}\n` } }],
                  },
                },
              ],
            },
          }),
        });
      }

      const result = await collector.collect();

      // Should only process first 10 documents
      expect(result.todos).toHaveLength(10);
    });

    it('should update cache after successful collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access_token_12345' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('google-docs.json')
      );
      expect(writeCall).toBeDefined();
    });
  });
});
