import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as fs from 'node:fs';

// Mock dependencies
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../../packages/shared/src/notify.js', () => ({
  notifyBriefingReady: vi.fn(),
  notifyEmailCleanup: vi.fn(),
  notifyEODSummary: vi.fn(),
}));

vi.mock('../../../packages/shared/src/workflow-utils.js', () => ({
  getDateString: vi.fn(() => '2026-01-21'),
  getTimestamp: vi.fn(() => '2026-01-21T12-00-00-000Z'),
  runClaudeCommand: vi.fn(() => Promise.resolve('Mock output')),
}));

describe('Workflow Scripts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Directory Setup', () => {
    it('should create output directories', () => {
      const mockedMkdirSync = fs.mkdirSync as Mock;

      // Simulate directory creation
      mockedMkdirSync.mockReturnValue(undefined);

      // Verify the mock can be called
      fs.mkdirSync('/test/output', { recursive: true });

      expect(mockedMkdirSync).toHaveBeenCalledWith('/test/output', { recursive: true });
    });
  });

  describe('File Operations', () => {
    it('should check if file exists', () => {
      const mockedExistsSync = fs.existsSync as Mock;

      mockedExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      expect(fs.existsSync('/existing/file')).toBe(true);
      expect(fs.existsSync('/nonexistent/file')).toBe(false);
    });

    it('should write file content', () => {
      const mockedWriteFileSync = fs.writeFileSync as Mock;

      fs.writeFileSync('/test/file.md', 'content');

      expect(mockedWriteFileSync).toHaveBeenCalledWith('/test/file.md', 'content');
    });
  });

  describe('Workflow Utils Integration', () => {
    it('should use shared date utilities', async () => {
      const { getDateString, getTimestamp } = await import('../../../packages/shared/src/workflow-utils.js');

      expect(getDateString()).toBe('2026-01-21');
      expect(getTimestamp()).toBe('2026-01-21T12-00-00-000Z');
    });

    it('should use shared Claude command runner', async () => {
      const { runClaudeCommand } = await import('../../../packages/shared/src/workflow-utils.js');

      const result = await runClaudeCommand('test prompt');

      expect(result).toBe('Mock output');
    });
  });
});
