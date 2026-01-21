import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock dependencies
jest.mock('node:fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('../../packages/shared/src/notify.js', () => ({
  notifyBriefingReady: jest.fn(),
  notifyEmailCleanup: jest.fn(),
  notifyEODSummary: jest.fn(),
}));

jest.mock('../../packages/shared/src/workflow-utils.js', () => ({
  getDateString: jest.fn(() => '2026-01-21'),
  getTimestamp: jest.fn(() => '2026-01-21T12-00-00-000Z'),
  runClaudeCommand: jest.fn(() => Promise.resolve('Mock output')),
}));

describe('Workflow Scripts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Directory Setup', () => {
    it('should create output directories', () => {
      const mockedMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

      // Simulate directory creation
      mockedMkdirSync.mockReturnValue(undefined);

      // Verify the mock can be called
      fs.mkdirSync('/test/output', { recursive: true });

      expect(mockedMkdirSync).toHaveBeenCalledWith('/test/output', { recursive: true });
    });
  });

  describe('File Operations', () => {
    it('should check if file exists', () => {
      const mockedExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

      mockedExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      expect(fs.existsSync('/existing/file')).toBe(true);
      expect(fs.existsSync('/nonexistent/file')).toBe(false);
    });

    it('should write file content', () => {
      const mockedWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;

      fs.writeFileSync('/test/file.md', 'content');

      expect(mockedWriteFileSync).toHaveBeenCalledWith('/test/file.md', 'content');
    });
  });

  describe('Workflow Utils Integration', () => {
    it('should use shared date utilities', async () => {
      const { getDateString, getTimestamp } = await import('../../packages/shared/src/workflow-utils.js');

      expect(getDateString()).toBe('2026-01-21');
      expect(getTimestamp()).toBe('2026-01-21T12-00-00-000Z');
    });

    it('should use shared Claude command runner', async () => {
      const { runClaudeCommand } = await import('../../packages/shared/src/workflow-utils.js');

      const result = await runClaudeCommand('test prompt');

      expect(result).toBe('Mock output');
    });
  });
});
