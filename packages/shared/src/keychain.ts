import { execSync } from 'node:child_process';
import type { CredentialKey } from './types.js';

const SERVICE_PREFIX = 'apolitical-assistant-';

export class KeychainError extends Error {
  constructor(message: string, public readonly key: string) {
    super(message);
    this.name = 'KeychainError';
  }
}

/**
 * Get a credential from macOS Keychain
 */
export function getCredential(key: CredentialKey): string | null {
  const service = `${SERVICE_PREFIX}${key}`;
  try {
    const result = execSync(
      `security find-generic-password -s "${service}" -w 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Set a credential in macOS Keychain
 */
export function setCredential(key: CredentialKey, value: string): void {
  const service = `${SERVICE_PREFIX}${key}`;
  const account = 'apolitical-assistant';

  // First try to delete any existing entry (ignore errors if it doesn't exist)
  try {
    execSync(
      `security delete-generic-password -s "${service}" 2>/dev/null`,
      { encoding: 'utf-8' }
    );
  } catch {
    // Ignore - item might not exist
  }

  // Add the new credential
  try {
    execSync(
      `security add-generic-password -s "${service}" -a "${account}" -w "${value.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8' }
    );
  } catch (error) {
    throw new KeychainError(`Failed to store credential: ${key}`, key);
  }
}

/**
 * Delete a credential from macOS Keychain
 */
export function deleteCredential(key: CredentialKey): boolean {
  const service = `${SERVICE_PREFIX}${key}`;
  try {
    execSync(
      `security delete-generic-password -s "${service}" 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a credential exists in macOS Keychain
 */
export function hasCredential(key: CredentialKey): boolean {
  return getCredential(key) !== null;
}

/**
 * Get all configured credentials
 */
export function listConfiguredCredentials(): CredentialKey[] {
  const keys: CredentialKey[] = [
    'google-oauth-client-id',
    'google-oauth-client-secret',
    'google-refresh-token',
    'slack-token',
    'github-token',
    'linear-api-key',
    'humaans-api-token',
    'incidentio-api-key',
  ];

  return keys.filter((key) => hasCredential(key));
}

/**
 * Get credentials required for a specific service
 */
export function getServiceCredentials(service: 'google' | 'slack' | 'github' | 'linear' | 'humaans' | 'incidentio'): Record<string, string | null> {
  const serviceKeys: Record<typeof service, CredentialKey[]> = {
    google: ['google-oauth-client-id', 'google-oauth-client-secret', 'google-refresh-token'],
    slack: ['slack-token'],
    github: ['github-token'],
    linear: ['linear-api-key'],
    humaans: ['humaans-api-token'],
    incidentio: ['incidentio-api-key'],
  };

  const keys = serviceKeys[service];
  const result: Record<string, string | null> = {};

  for (const key of keys) {
    result[key] = getCredential(key);
  }

  return result;
}
