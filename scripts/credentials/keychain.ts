/**
 * macOS Keychain read/write/delete operations.
 */

import { execSync } from 'node:child_process';
import { colors } from './types.js';

export function getKeychainCredential(name: string): string | null {
  try {
    const result = execSync(
      `security find-generic-password -a "claude" -s "${name}" -w 2>/dev/null`,
      { encoding: 'utf8' }
    );
    return result.trim();
  } catch {
    return null;
  }
}

export function setKeychainCredential(name: string, value: string): boolean {
  try {
    // First try to delete existing (ignore errors if not found)
    try {
      execSync(`security delete-generic-password -a "claude" -s "${name}" 2>/dev/null`);
    } catch {
      // Ignore - credential may not exist
    }

    // Add the new credential
    execSync(`security add-generic-password -a "claude" -s "${name}" -w "${value}"`, {
      encoding: 'utf8',
    });
    return true;
  } catch (err) {
    console.error(`${colors.red}Failed to store credential: ${err}${colors.reset}`);
    return false;
  }
}

export function deleteKeychainCredential(name: string): boolean {
  try {
    execSync(`security delete-generic-password -a "claude" -s "${name}"`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}
