/**
 * Notion Collector Integration Tests
 *
 * Tests the Notion collector with mocked Claude CLI responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NotionCollector } from '../notion.js';
import * as shared from '@apolitical-assistant/shared';
import * as fs from 'node:fs';

// Mock dependencies
vi.mock('@apolitical-assistant/shared', async () => {
  const actual = await vi.importActual('@apolitical-assistant/shared');
  return {
    ...actual,
    getCredential: vi.fn(),
    generateFingerprint: vi.fn((title: string) => `fp-${title.slice(0, 10)}`),
    runClaudeCommand: vi.fn(),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('NotionCollector', () => {
  let collector: NotionCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new NotionCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when notion collector is enabled in config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('collect', () => {
    it('should collect TODOs from Claude CLI response', async () => {
      const mockResponse = `Here are your TODOs:
[
  {
    "title": "Review Q4 planning doc",
    "sourceId": "notion-page-abc123",
    "sourceUrl": "https://notion.so/Review-Q4-planning-abc123",
    "requestDate": "2026-01-15T10:00:00Z",
    "dueDate": "2026-01-25"
  },
  {
    "title": "Update team roadmap",
    "sourceId": "notion-page-def456",
    "sourceUrl": "https://notion.so/Team-roadmap-def456",
    "requestDate": "2026-01-18T14:00:00Z",
    "dueDate": null
  }
]`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].title).toBe('Review Q4 planning doc');
      expect(result.todos[0].sourceUrl).toBe('https://notion.so/Review-Q4-planning-abc123');
      expect(result.todos[0].dueDate).toBe('2026-01-25');
      expect(result.todos[0].source).toBe('notion');
      expect(result.todos[1].title).toBe('Update team roadmap');
    });

    it('should handle JSON embedded in other text', async () => {
      const mockResponse = `I found the following TODOs in your Notion workspace:

[
  {
    "title": "Embedded JSON task",
    "sourceId": "notion-embedded",
    "sourceUrl": "https://notion.so/embedded"
  }
]

Let me know if you need more information!`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('Embedded JSON task');
    });

    it('should return empty results when no JSON is found', async () => {
      const mockResponse = 'I could not find any TODOs in your Notion workspace.';

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle Claude CLI errors gracefully', async () => {
      (shared.runClaudeCommand as Mock).mockRejectedValue(new Error('Claude CLI failed'));

      const result = await collector.collect();

      // Should not throw, just return empty results
      expect(result.todos).toHaveLength(0);
      expect(result.errors).toHaveLength(0); // Error is caught internally
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockResponse = `[{"title": "Incomplete JSON`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      // Should handle parse error
      expect(result.todos).toHaveLength(0);
    });

    it('should set default priority and urgency', async () => {
      const mockResponse = `[
  {
    "title": "Default priority task",
    "sourceId": "notion-default",
    "sourceUrl": "https://notion.so/default"
  }
]`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      expect(result.todos[0].basePriority).toBe(3);
      expect(result.todos[0].urgency).toBe(3);
      expect(result.todos[0].tags).toContain('notion');
    });

    it('should preserve requestDate and dueDate from response', async () => {
      const mockResponse = `[
  {
    "title": "Task with dates",
    "sourceId": "notion-dates",
    "sourceUrl": "https://notion.so/dates",
    "requestDate": "2026-01-10T09:00:00Z",
    "dueDate": "2026-02-01"
  }
]`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      const result = await collector.collect();

      expect(result.todos[0].requestDate).toBe('2026-01-10T09:00:00Z');
      expect(result.todos[0].dueDate).toBe('2026-02-01');
    });

    it('should update cache after successful collection', async () => {
      const mockResponse = `[
  {
    "title": "Cache test task",
    "sourceId": "notion-cache"
  }
]`;

      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      await collector.collect();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as Mock).mock.calls.find(
        (call) => call[0].includes('notion.json')
      );
      expect(writeCall).toBeDefined();
    });

    it('should call runClaudeCommand with appropriate prompt', async () => {
      const mockResponse = '[]';
      (shared.runClaudeCommand as Mock).mockResolvedValue(mockResponse);

      await collector.collect();

      expect(shared.runClaudeCommand).toHaveBeenCalledTimes(1);
      const prompt = (shared.runClaudeCommand as Mock).mock.calls[0][0];
      expect(prompt).toContain('TODO');
      expect(prompt).toContain('JSON');
    });
  });
});
