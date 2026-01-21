import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mocking
import { getDateString, getTimestamp, runClaudeCommand } from '../workflow-utils.js';

const mockedSpawn = childProcess.spawn as Mock;

describe('workflow-utils', () => {
  describe('getDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const testDate = new Date('2026-01-21T12:30:00Z');
      const result = getDateString(testDate);
      expect(result).toBe('2026-01-21');
    });

    it('should use current date when no argument provided', () => {
      const result = getDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle dates at midnight', () => {
      const testDate = new Date('2026-06-15T00:00:00Z');
      const result = getDateString(testDate);
      expect(result).toBe('2026-06-15');
    });
  });

  describe('getTimestamp', () => {
    it('should return ISO timestamp with colons and periods replaced', () => {
      const testDate = new Date('2026-01-21T12:30:45.123Z');
      const result = getTimestamp(testDate);

      expect(result).not.toContain(':');
      expect(result).not.toContain('.');
      expect(result).toContain('2026-01-21');
      expect(result).toContain('12-30-45-123Z');
    });

    it('should use current date when no argument provided', () => {
      const result = getTimestamp();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('runClaudeCommand', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should resolve with stdout when command succeeds', async () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };
      const mockProcess = {
        stdout: mockStdout,
        stderr: mockStderr,
        stdin: mockStdin,
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            // Simulate async close with success
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockedSpawn.mockReturnValue(mockProcess as never);

      const promise = runClaudeCommand('test prompt');

      // Emit stdout data
      mockStdout.emit('data', 'test output');

      const result = await promise;

      expect(result).toBe('test output');
      expect(mockStdin.write).toHaveBeenCalledWith('test prompt');
      expect(mockStdin.end).toHaveBeenCalled();
    });

    it('should reject when command fails', async () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };
      const mockProcess = {
        stdout: mockStdout,
        stderr: mockStderr,
        stdin: mockStdin,
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10);
          }
        }),
      };

      mockedSpawn.mockReturnValue(mockProcess as never);

      const promise = runClaudeCommand('test prompt');

      mockStderr.emit('data', 'error message');

      await expect(promise).rejects.toThrow('Claude exited with code 1');
    });

    it('should reject when spawn errors', async () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };
      const mockProcess = {
        stdout: mockStdout,
        stderr: mockStderr,
        stdin: mockStdin,
        on: vi.fn((event: string, callback: (err: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn failed')), 10);
          }
        }),
      };

      mockedSpawn.mockReturnValue(mockProcess as never);

      const promise = runClaudeCommand('test prompt');

      await expect(promise).rejects.toThrow('spawn failed');
    });

    it('should use cwd option when provided', async () => {
      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      };
      const mockProcess = {
        stdout: mockStdout,
        stderr: mockStderr,
        stdin: mockStdin,
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockedSpawn.mockReturnValue(mockProcess as never);

      runClaudeCommand('test prompt', { cwd: '/custom/path' });

      expect(mockedSpawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--output-format', 'text'],
        expect.objectContaining({ cwd: '/custom/path' })
      );
    });
  });
});
