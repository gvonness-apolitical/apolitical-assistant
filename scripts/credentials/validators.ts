/**
 * Per-service API validation functions.
 */

import type { ValidationResult } from './types.js';
import { GOOGLE_SCOPES, GITHUB_REQUIRED_SCOPES } from './types.js';

export async function validateGoogleToken(
  _refreshToken: string,
  allCreds: Map<string, string>
): Promise<ValidationResult> {
  const clientId = allCreds.get('GOOGLE_CLIENT_ID');
  const clientSecret = allCreds.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = allCreds.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      valid: false,
      message: 'Missing required Google credentials',
    };
  }

  try {
    // Attempt token refresh
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return {
        valid: false,
        message: 'Token refresh failed',
        details: error,
      };
    }

    const tokens = (await tokenResponse.json()) as { access_token: string };

    // Get token info to check scopes
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${tokens.access_token}`
    );

    if (!tokenInfoResponse.ok) {
      return {
        valid: true,
        message: 'Valid (could not verify scopes)',
      };
    }

    const tokenInfo = (await tokenInfoResponse.json()) as { scope: string };
    const grantedScopes = tokenInfo.scope?.split(' ') || [];
    const missingScopes = GOOGLE_SCOPES.filter((s) => !grantedScopes.includes(s));

    // Check for key capabilities
    const capabilities: string[] = [];
    const hasGmailModify = grantedScopes.includes('https://www.googleapis.com/auth/gmail.modify');
    const hasCalendarEvents = grantedScopes.includes(
      'https://www.googleapis.com/auth/calendar.events'
    );
    const hasCalendarReadonly = grantedScopes.includes(
      'https://www.googleapis.com/auth/calendar.readonly'
    );
    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.readonly');

    if (hasGmailModify) capabilities.push('gmail:rw');
    if (hasCalendarEvents) capabilities.push('calendar:rw');
    else if (hasCalendarReadonly) capabilities.push('calendar:ro');
    if (hasDrive) capabilities.push('drive:ro');

    if (missingScopes.length > 0) {
      // Categorize missing scopes
      const missingWrite = missingScopes.filter(
        (s) => s.includes('calendar.events') || s.includes('gmail.modify')
      );
      const missingRead = missingScopes.filter(
        (s) => !s.includes('calendar.events') && !s.includes('gmail.modify')
      );

      const details: string[] = [];
      if (missingWrite.length > 0) {
        details.push(`Write: ${missingWrite.map((s) => s.split('/').pop()).join(', ')}`);
      }
      if (missingRead.length > 0) {
        details.push(`Read: ${missingRead.map((s) => s.split('/').pop()).join(', ')}`);
      }

      return {
        valid: false,
        message: `Missing ${missingScopes.length} scope(s)`,
        details: details.join('; '),
      };
    }

    return {
      valid: true,
      message: `Valid (${capabilities.join(', ')})`,
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Validation error',
      details: String(err),
    };
  }
}

export async function validateSlackToken(token: string): Promise<ValidationResult> {
  try {
    // First check if token is valid
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const authData = (await authResponse.json()) as {
      ok: boolean;
      error?: string;
      user?: string;
      team?: string;
    };

    if (!authData.ok) {
      return {
        valid: false,
        message: authData.error || 'Invalid token',
      };
    }

    // Check scopes by trying to list conversations (requires channels:read)
    // The response headers don't include scopes, so we test by attempting operations
    const scopeTests: { scope: string; test: () => Promise<boolean> }[] = [
      {
        scope: 'channels:read',
        test: async () => {
          const r = await fetch(
            'https://slack.com/api/conversations.list?limit=1&types=public_channel',
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'users:read',
        test: async () => {
          const r = await fetch('https://slack.com/api/users.list?limit=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'search:read',
        test: async () => {
          const r = await fetch('https://slack.com/api/search.messages?query=test&count=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'chat:write',
        test: async () => {
          // We can't actually test write without sending a message
          // Check if we can call chat.postMessage with missing channel (different error = has scope)
          const r = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channel: 'test', text: 'test' }),
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          // If error is 'channel_not_found' or 'not_in_channel', we have the scope
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
      {
        scope: 'reactions:write',
        test: async () => {
          const r = await fetch('https://slack.com/api/reactions.add', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channel: 'test', timestamp: '1234.5678', name: 'thumbsup' }),
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
      // NOTE: canvases:read test removed - the scope is useless.
      // There is no public canvases.read API method. We read canvas content
      // via files.info + url_private_download (requires files:read scope).
      {
        scope: 'canvases:write',
        test: async () => {
          // Test by trying to edit a non-existent canvas
          const r = await fetch('https://slack.com/api/canvases.edit', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ canvas_id: 'F000000000', changes: [] }),
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
      {
        scope: 'files:read',
        test: async () => {
          // Test by trying to list files
          const r = await fetch('https://slack.com/api/files.list?count=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
      {
        scope: 'bookmarks:read',
        test: async () => {
          // Test by trying to list bookmarks for a non-existent channel
          const r = await fetch('https://slack.com/api/bookmarks.list?channel_id=C000000000', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          // If error is 'channel_not_found', we have the scope
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
      {
        scope: 'groups:read',
        test: async () => {
          // Test by listing private channels
          const r = await fetch(
            'https://slack.com/api/conversations.list?limit=1&types=private_channel',
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'im:read',
        test: async () => {
          // Test by listing DM conversations
          const r = await fetch('https://slack.com/api/conversations.list?limit=1&types=im', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'mpim:read',
        test: async () => {
          // Test by listing group DM conversations
          const r = await fetch('https://slack.com/api/conversations.list?limit=1&types=mpim', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || d.error !== 'missing_scope';
        },
      },
      {
        scope: 'im:write',
        test: async () => {
          // Test by trying to open a DM (will fail with user_not_found, not missing_scope)
          const r = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ users: 'U000000000' }),
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
    ];

    const missingScopes: string[] = [];
    for (const { scope, test } of scopeTests) {
      const hasScope = await test();
      if (!hasScope) {
        missingScopes.push(scope);
      }
    }

    if (missingScopes.length > 0) {
      return {
        valid: false,
        message: `Missing scopes: ${missingScopes.length}`,
        details: missingScopes.join(', '),
      };
    }

    return {
      valid: true,
      message: `Valid (user: ${authData.user}, team: ${authData.team})`,
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Connection error',
      details: String(err),
    };
  }
}

export async function validateIncidentioToken(token: string): Promise<ValidationResult> {
  try {
    // Test read access
    const readResponse = await fetch('https://api.incident.io/v2/incidents?page_size=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (readResponse.status === 401 || readResponse.status === 403) {
      return {
        valid: false,
        message: 'Invalid or unauthorized token',
      };
    }

    if (!readResponse.ok) {
      return {
        valid: false,
        message: `API error: ${readResponse.status}`,
      };
    }

    const permissions: string[] = ['read:incidents'];

    // Test write access by checking if we can access incident types (needed for creation)
    const typesResponse = await fetch('https://api.incident.io/v1/incident_types', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (typesResponse.ok) {
      permissions.push('read:incident_types');
    }

    // Test severities access
    const severitiesResponse = await fetch('https://api.incident.io/v1/severities', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (severitiesResponse.ok) {
      permissions.push('read:severities');
    }

    // Test follow-ups access
    const followupsResponse = await fetch('https://api.incident.io/v2/follow_ups', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (followupsResponse.ok) {
      permissions.push('read:follow_ups');
    }

    // Note: We can't easily test write without creating real data
    // The API doesn't have a dry-run mode

    return {
      valid: true,
      message: `Valid (${permissions.length} permissions)`,
      details: permissions.join(', '),
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Connection error',
      details: String(err),
    };
  }
}

export async function validateHumaansToken(token: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://app.humaans.io/api/people?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Invalid or unauthorized token',
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        message: `API error: ${response.status}`,
      };
    }

    return {
      valid: true,
      message: 'Valid',
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Connection error',
      details: String(err),
    };
  }
}

export async function validateGithubToken(token: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'apolitical-assistant',
      },
    });

    if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid token',
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        message: `API error: ${response.status}`,
      };
    }

    const user = (await response.json()) as { login: string };

    // Check scopes from header
    const scopesHeader = response.headers.get('X-OAuth-Scopes');
    const grantedScopes = scopesHeader?.split(', ').map((s) => s.trim()) || [];

    // Check for required scopes
    const missingScopes = GITHUB_REQUIRED_SCOPES.filter((s) => {
      // Handle hierarchical scopes (e.g., 'repo' includes 'repo:status')
      return !grantedScopes.some((gs) => gs === s || gs.startsWith(`${s}:`));
    });

    if (missingScopes.length > 0) {
      return {
        valid: false,
        message: `Missing scopes: ${missingScopes.join(', ')}`,
        details: `Granted: ${grantedScopes.join(', ')}`,
      };
    }

    return {
      valid: true,
      message: `Valid (user: ${user.login})`,
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Connection error',
      details: String(err),
    };
  }
}

export async function validateLinearToken(token: string): Promise<ValidationResult> {
  try {
    // Query for viewer info and check access to various resources
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
          viewer { id name email admin }
          teams(first: 1) { nodes { id name } }
          issues(first: 1) { nodes { id title } }
          projects(first: 1) { nodes { id name } }
        }`,
      }),
    });

    if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid token',
      };
    }

    const data = (await response.json()) as {
      data?: {
        viewer?: { name: string; email: string; admin: boolean };
        teams?: { nodes: Array<{ id: string }> };
        issues?: { nodes: Array<{ id: string }> };
        projects?: { nodes: Array<{ id: string }> };
      };
      errors?: Array<{ message: string }>;
    };

    if (data.errors && data.errors.length > 0) {
      // Check if it's just a permission error for some fields
      const criticalError = data.errors.find(
        (e) => !e.message.includes('permission') && !e.message.includes('access')
      );
      if (criticalError) {
        return {
          valid: false,
          message: criticalError.message || 'API error',
        };
      }
    }

    const permissions: string[] = [];

    if (data.data?.viewer) {
      permissions.push('read:user');
    }
    if (data.data?.teams?.nodes) {
      permissions.push('read:teams');
    }
    if (data.data?.issues?.nodes !== undefined) {
      permissions.push('read:issues');
    }
    if (data.data?.projects?.nodes !== undefined) {
      permissions.push('read:projects');
    }

    // Linear API keys inherit user permissions, so if we can read issues, we can likely write
    // There's no separate write scope to check
    const userName = data.data?.viewer?.name || data.data?.viewer?.email || 'unknown';

    return {
      valid: true,
      message: `Valid (${userName}, ${permissions.length} permissions)`,
      details: permissions.join(', '),
    };
  } catch (err) {
    return {
      valid: false,
      message: 'Connection error',
      details: String(err),
    };
  }
}
