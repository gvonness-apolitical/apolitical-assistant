/**
 * Google OAuth token management with Drive access control
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface BlockedEntry {
  id: string;
  name: string;
  reason: string;
}

export interface AccessControlConfig {
  enabled: boolean;
  blockedFolders: BlockedEntry[];
  blockedFiles: BlockedEntry[];
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

// URL patterns for extracting resource IDs from Google API calls
const RESOURCE_ID_PATTERNS: RegExp[] = [
  /\/drive\/v[23]\/files\/([^/?]+)/,
  /\/documents\/([^/?]+)/,
  /\/spreadsheets\/([^/?:]+)/,
  /\/presentations\/([^/?:]+)/,
  /\/forms\/([^/?:]+)/,
];

export function loadAccessControlConfig(): AccessControlConfig {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, 'access-control.json');
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as AccessControlConfig;
  } catch {
    // If config doesn't exist or is invalid, default to disabled
    return { enabled: false, blockedFolders: [], blockedFiles: [] };
  }
}

export function extractResourceId(url: string): string | null {
  for (const pattern of RESOURCE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

export class GoogleAuth {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private accessControlConfig: AccessControlConfig;
  private parentFolderCache: Map<string, string[]> = new Map();

  constructor(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    accessControlConfig?: AccessControlConfig,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.accessControlConfig = accessControlConfig ?? loadAccessControlConfig();
  }

  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Refresh the token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  /**
   * Raw fetch with auth header — no access control checks.
   * Used internally for parent folder resolution to avoid infinite recursion.
   */
  private async _rawFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Resolve all ancestor folder IDs for a given file.
   * Walks up the Drive folder tree recursively and caches results.
   */
  private async resolveParentFolders(fileId: string): Promise<string[]> {
    const cached = this.parentFolderCache.get(fileId);
    if (cached) {
      return cached;
    }

    const ancestors: string[] = [];
    let currentId = fileId;

    // Walk up the tree (max 20 levels to prevent runaway loops)
    for (let depth = 0; depth < 20; depth++) {
      const response = await this._rawFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(currentId)}?fields=parents`
      );

      if (!response.ok) {
        break;
      }

      const data = (await response.json()) as { parents?: string[] };
      if (!data.parents?.length) {
        break;
      }

      const parentId = data.parents[0]!;
      ancestors.push(parentId);
      currentId = parentId;
    }

    this.parentFolderCache.set(fileId, ancestors);
    return ancestors;
  }

  /**
   * Check whether a URL targets a blocked resource.
   * Throws AccessDeniedError if the resource is blocked.
   */
  private async validateAccess(url: string): Promise<void> {
    if (!this.accessControlConfig.enabled) {
      return;
    }

    const resourceId = extractResourceId(url);
    if (!resourceId) {
      return; // Search/list endpoints — no specific resource to check
    }

    // Check direct file blocklist
    const blockedFile = this.accessControlConfig.blockedFiles.find(
      (f) => f.id === resourceId
    );
    if (blockedFile) {
      throw new AccessDeniedError(
        `Access denied: File "${resourceId}" is directly blocked (${blockedFile.name}: ${blockedFile.reason}). ` +
          `This file is restricted from LLM access. See access-control.json to manage restrictions.`
      );
    }

    // Check folder blocklist — resolve parent folders and check ancestors
    if (this.accessControlConfig.blockedFolders.length > 0) {
      const ancestors = await this.resolveParentFolders(resourceId);
      for (const ancestor of ancestors) {
        const blockedFolder = this.accessControlConfig.blockedFolders.find(
          (f) => f.id === ancestor
        );
        if (blockedFolder) {
          throw new AccessDeniedError(
            `Access denied: File "${resourceId}" is in blocked folder "${blockedFolder.name}" (${ancestor}). ` +
              `This file is restricted from LLM access. See access-control.json to manage restrictions.`
          );
        }
      }
    }
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    await this.validateAccess(url);
    return this._rawFetch(url, options);
  }
}
