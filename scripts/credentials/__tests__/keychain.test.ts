import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import {
  getKeychainCredential,
  setKeychainCredential,
  deleteKeychainCredential,
} from '../keychain.js';

const mockExecSync = vi.mocked(execSync);

describe('getKeychainCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the credential value from keychain', () => {
    mockExecSync.mockReturnValueOnce('my-secret-token\n');

    const result = getKeychainCredential('SLACK_TOKEN');

    expect(result).toBe('my-secret-token');
    expect(mockExecSync).toHaveBeenCalledWith(
      'security find-generic-password -a "claude" -s "SLACK_TOKEN" -w 2>/dev/null',
      { encoding: 'utf8' }
    );
  });

  it('should trim whitespace from the returned value', () => {
    mockExecSync.mockReturnValueOnce('  spaced-value  \n');

    const result = getKeychainCredential('TEST_CRED');

    expect(result).toBe('spaced-value');
  });

  it('should return null when credential is not found', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('The specified item could not be found in the keychain');
    });

    const result = getKeychainCredential('MISSING_CRED');

    expect(result).toBeNull();
  });
});

describe('setKeychainCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete existing and add new credential', () => {
    mockExecSync.mockReturnValue('' as never);

    const result = setKeychainCredential('SLACK_TOKEN', 'new-token');

    expect(result).toBe(true);
    // First call: delete existing
    expect(mockExecSync).toHaveBeenCalledWith(
      'security delete-generic-password -a "claude" -s "SLACK_TOKEN" 2>/dev/null'
    );
    // Second call: add new
    expect(mockExecSync).toHaveBeenCalledWith(
      'security add-generic-password -a "claude" -s "SLACK_TOKEN" -w "new-token"',
      { encoding: 'utf8' }
    );
  });

  it('should succeed even if delete fails (credential does not exist)', () => {
    // Delete throws (not found) but add succeeds
    mockExecSync
      .mockImplementationOnce(() => {
        throw new Error('not found');
      })
      .mockReturnValueOnce('' as never);

    const result = setKeychainCredential('NEW_CRED', 'value');

    expect(result).toBe(true);
  });

  it('should return false when add fails', () => {
    // Delete succeeds, add fails
    mockExecSync.mockReturnValueOnce('' as never).mockImplementationOnce(() => {
      throw new Error('Keychain access denied');
    });

    const result = setKeychainCredential('FAIL_CRED', 'value');

    expect(result).toBe(false);
  });
});

describe('deleteKeychainCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete credential and return true', () => {
    mockExecSync.mockReturnValueOnce('' as never);

    const result = deleteKeychainCredential('SLACK_TOKEN');

    expect(result).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith(
      'security delete-generic-password -a "claude" -s "SLACK_TOKEN"',
      { encoding: 'utf8' }
    );
  });

  it('should return false when credential does not exist', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not found');
    });

    const result = deleteKeychainCredential('MISSING_CRED');

    expect(result).toBe(false);
  });
});
