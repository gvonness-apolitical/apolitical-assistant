import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as childProcess from 'node:child_process';

// Mock child_process module
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Import after mocking
import {
  getCredential,
  setCredential,
  deleteCredential,
  hasCredential,
  listConfiguredCredentials,
  getServiceCredentials,
  KeychainError,
} from '../keychain.js';

const mockedExecSync = childProcess.execSync as Mock;

describe('keychain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCredential', () => {
    it('should return credential value when found', () => {
      mockedExecSync.mockReturnValue('secret-token\n');

      const result = getCredential('slack-token');

      expect(result).toBe('secret-token');
      expect(mockedExecSync).toHaveBeenCalledWith(
        'security find-generic-password -s "apolitical-assistant-slack-token" -w 2>/dev/null',
        { encoding: 'utf-8' }
      );
    });

    it('should return null when credential not found', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('The specified item could not be found');
      });

      const result = getCredential('slack-token');

      expect(result).toBeNull();
    });

    it('should trim whitespace from credential value', () => {
      mockedExecSync.mockReturnValue('  secret-token  \n');

      const result = getCredential('github-token');

      expect(result).toBe('secret-token');
    });
  });

  describe('setCredential', () => {
    it('should set credential successfully', () => {
      mockedExecSync.mockReturnValue('');

      expect(() => setCredential('slack-token', 'new-token')).not.toThrow();

      // Should call delete first, then add
      expect(mockedExecSync).toHaveBeenCalledTimes(2);
    });

    it('should throw KeychainError when set fails', () => {
      // First call (delete) succeeds
      mockedExecSync.mockReturnValueOnce('');
      // Second call (add) fails
      mockedExecSync.mockImplementationOnce(() => {
        throw new Error('Keychain access denied');
      });

      expect(() => setCredential('slack-token', 'new-token')).toThrow(KeychainError);
    });

    it('should escape double quotes in value', () => {
      mockedExecSync.mockReturnValue('');

      setCredential('slack-token', 'token"with"quotes');

      expect(mockedExecSync).toHaveBeenLastCalledWith(
        expect.stringContaining('token\\"with\\"quotes'),
        expect.any(Object)
      );
    });
  });

  describe('deleteCredential', () => {
    it('should return true when deletion succeeds', () => {
      mockedExecSync.mockReturnValue('');

      const result = deleteCredential('slack-token');

      expect(result).toBe(true);
    });

    it('should return false when credential does not exist', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('The specified item could not be found');
      });

      const result = deleteCredential('slack-token');

      expect(result).toBe(false);
    });
  });

  describe('hasCredential', () => {
    it('should return true when credential exists', () => {
      mockedExecSync.mockReturnValue('secret-token');

      const result = hasCredential('slack-token');

      expect(result).toBe(true);
    });

    it('should return false when credential does not exist', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = hasCredential('slack-token');

      expect(result).toBe(false);
    });
  });

  describe('listConfiguredCredentials', () => {
    it('should return only configured credentials', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('slack-token') || cmd.includes('github-token')) {
          return 'token-value';
        }
        throw new Error('Not found');
      });

      const result = listConfiguredCredentials();

      expect(result).toContain('slack-token');
      expect(result).toContain('github-token');
      expect(result).not.toContain('linear-api-key');
    });

    it('should return empty array when no credentials configured', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = listConfiguredCredentials();

      expect(result).toEqual([]);
    });
  });

  describe('getServiceCredentials', () => {
    it('should return google credentials', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('google-oauth-client-id')) return 'client-id';
        if (cmd.includes('google-oauth-client-secret')) return 'client-secret';
        if (cmd.includes('google-refresh-token')) return 'refresh-token';
        throw new Error('Not found');
      });

      const result = getServiceCredentials('google');

      expect(result).toEqual({
        'google-oauth-client-id': 'client-id',
        'google-oauth-client-secret': 'client-secret',
        'google-refresh-token': 'refresh-token',
      });
    });

    it('should return null for missing credentials', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = getServiceCredentials('slack');

      expect(result).toEqual({
        'slack-token': null,
      });
    });
  });
});
