#!/usr/bin/env npx tsx

/**
 * Apolitical Assistant - Credentials Manager
 *
 * Validates and manages macOS Keychain credentials for all MCP server integrations.
 *
 * Usage:
 *   npm run credentials              # Check all credentials
 *   npm run credentials -- --validate  # Validate with API tests
 *   npm run credentials -- --setup     # Interactive setup mode
 *   npm run credentials -- --update CREDENTIAL_NAME  # Update specific credential
 */

import { execSync, exec } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { URL } from 'node:url';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Status symbols
const symbols = {
  valid: `${colors.green}✓${colors.reset}`,
  missing: `${colors.red}✗${colors.reset}`,
  warning: `${colors.yellow}⚠${colors.reset}`,
};

// Credential definitions
interface CredentialDef {
  name: string;
  service: string;
  description: string;
  required: boolean;
  validator?: (value: string, allCreds: Map<string, string>) => Promise<ValidationResult>;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

const CREDENTIALS: CredentialDef[] = [
  {
    name: 'GOOGLE_CLIENT_ID',
    service: 'Google',
    description: 'OAuth 2.0 Client ID',
    required: true,
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    service: 'Google',
    description: 'OAuth 2.0 Client Secret',
    required: true,
  },
  {
    name: 'GOOGLE_REFRESH_TOKEN',
    service: 'Google',
    description: 'OAuth 2.0 Refresh Token',
    required: true,
    validator: validateGoogleToken,
  },
  {
    name: 'SLACK_TOKEN',
    service: 'Slack',
    description: 'User OAuth Token (xoxp-...)',
    required: true,
    validator: validateSlackToken,
  },
  {
    name: 'INCIDENTIO_API_KEY',
    service: 'Incident.io',
    description: 'API Key',
    required: true,
    validator: validateIncidentioToken,
  },
  {
    name: 'HUMAANS_API_TOKEN',
    service: 'Humaans',
    description: 'API Token',
    required: true,
    validator: validateHumaansToken,
  },
  {
    name: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    service: 'GitHub',
    description: 'Personal Access Token (classic or fine-grained)',
    required: true,
    validator: validateGithubToken,
  },
  {
    name: 'LINEAR_API_KEY',
    service: 'Linear',
    description: 'Personal API Key',
    required: true,
    validator: validateLinearToken,
  },
];

// Required Google OAuth scopes (read + write)
const GOOGLE_SCOPES = [
  // Gmail - need modify for full read/write/labels
  'https://www.googleapis.com/auth/gmail.modify',
  // Calendar - need events scope for creating meetings
  'https://www.googleapis.com/auth/calendar.events',
  // Drive - readonly is sufficient
  'https://www.googleapis.com/auth/drive.readonly',
  // Docs, Sheets, Slides - readonly
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
];

// Required Slack scopes (read + write) - for reference
// Actual scope testing is done via API calls in validateSlackToken
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Documentation reference
const SLACK_REQUIRED_SCOPES = {
  read: [
    'channels:read',
    'groups:read',
    'im:read',
    'channels:history',
    'groups:history',
    'im:history',
    'users:read',
    'search:read',
    'canvases:read',
    'bookmarks:read',
  ],
  write: ['chat:write', 'reactions:write', 'canvases:write'],
};

// Required GitHub scopes
const GITHUB_REQUIRED_SCOPES = ['repo', 'read:org', 'read:user'];

// ==================== Keychain Helpers ====================

function getKeychainCredential(name: string): string | null {
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

function setKeychainCredential(name: string, value: string): boolean {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Available for future --delete command
function deleteKeychainCredential(name: string): boolean {
  try {
    execSync(`security delete-generic-password -a "claude" -s "${name}"`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

// ==================== Validators ====================

async function validateGoogleToken(
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

async function validateSlackToken(token: string): Promise<ValidationResult> {
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
      {
        scope: 'canvases:read',
        test: async () => {
          // Test by trying to read a non-existent canvas
          const r = await fetch('https://slack.com/api/canvases.read', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = (await r.json()) as { ok: boolean; error?: string };
          // If error is 'canvas_not_found' or similar, we have the scope
          return d.ok || (d.error !== 'missing_scope' && d.error !== 'not_allowed_token_type');
        },
      },
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

async function validateIncidentioToken(token: string): Promise<ValidationResult> {
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

async function validateHumaansToken(token: string): Promise<ValidationResult> {
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

async function validateGithubToken(token: string): Promise<ValidationResult> {
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

async function validateLinearToken(token: string): Promise<ValidationResult> {
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

// ==================== Interactive Prompts ====================

function createReadline(): ReturnType<typeof createInterface> {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function promptCredential(
  rl: ReturnType<typeof createInterface>,
  cred: CredentialDef
): Promise<string | null> {
  console.log(`\n${colors.bold}${cred.service}: ${cred.name}${colors.reset}`);
  console.log(`${colors.dim}${cred.description}${colors.reset}\n`);

  const value = await prompt(rl, 'Enter value (or press Enter to skip): ');

  if (!value) {
    return null;
  }

  return value;
}

// ==================== Google OAuth Flow ====================

async function runGoogleOAuthFlow(): Promise<string | null> {
  const clientId = getKeychainCredential('GOOGLE_CLIENT_ID');
  const clientSecret = getKeychainCredential('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error(
      `${colors.red}Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set first${colors.reset}`
    );
    return null;
  }

  const REDIRECT_PORT = 8089;
  const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;

  console.log(`\n${colors.cyan}Starting Google OAuth flow...${colors.reset}\n`);

  return new Promise((resolve) => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // eslint-disable-next-line prefer-const -- assigned later in setTimeout
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://127.0.0.1:${REDIRECT_PORT}`);

      if (url.pathname === '/') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error</h1><p>${error}</p>`);
          console.error(`${colors.red}Authorization failed: ${error}${colors.reset}`);
          cleanup();
          server.close();
          resolve(null);
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success!</h1><p>You can close this window.</p>');

          try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
              }),
            });

            if (!tokenResponse.ok) {
              const errorText = await tokenResponse.text();
              console.error(`${colors.red}Token exchange failed: ${errorText}${colors.reset}`);
              cleanup();
              server.close();
              resolve(null);
              return;
            }

            const tokens = (await tokenResponse.json()) as { refresh_token: string };
            console.log(`${colors.green}✓ OAuth flow completed successfully${colors.reset}`);
            cleanup();
            server.close();
            resolve(tokens.refresh_token);
          } catch (err) {
            console.error(`${colors.red}Token exchange error: ${err}${colors.reset}`);
            cleanup();
            server.close();
            resolve(null);
          }
        }
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      console.log(`Listening on http://127.0.0.1:${REDIRECT_PORT}`);
      console.log('\nOpening browser for authorization...');
      console.log(`${colors.dim}If the browser does not open, visit:${colors.reset}`);
      console.log(`${colors.cyan}${authUrl.toString()}${colors.reset}\n`);

      const openCmd =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      exec(`${openCmd} "${authUrl.toString()}"`);
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(
      () => {
        console.error(`${colors.red}OAuth flow timed out${colors.reset}`);
        server.close();
        resolve(null);
      },
      5 * 60 * 1000
    );
  });
}

// ==================== Status Display ====================

interface CredentialStatus {
  cred: CredentialDef;
  value: string | null;
  validation?: ValidationResult;
}

function printStatusTable(statuses: CredentialStatus[], showValidation: boolean): void {
  console.log(`\n${colors.bold}Service       Credential                    Status${colors.reset}`);
  console.log('─'.repeat(65));

  let currentService = '';

  for (const status of statuses) {
    const serviceName = status.cred.service === currentService ? '' : status.cred.service;
    currentService = status.cred.service;

    let statusText: string;
    if (!status.value) {
      statusText = `${symbols.missing} Missing`;
    } else if (showValidation && status.validation) {
      if (status.validation.valid) {
        statusText = `${symbols.valid} ${status.validation.message}`;
      } else {
        statusText = `${symbols.warning} ${status.validation.message}`;
      }
    } else {
      statusText = `${symbols.valid} Found`;
    }

    const serviceCol = serviceName.padEnd(13);
    const credCol = status.cred.name.padEnd(29);

    console.log(`${serviceCol} ${credCol} ${statusText}`);

    // Show details if validation failed
    if (showValidation && status.validation?.details && !status.validation.valid) {
      console.log(`${' '.repeat(44)}${colors.dim}${status.validation.details}${colors.reset}`);
    }
  }
}

// ==================== Main Commands ====================

async function checkCredentials(validate: boolean): Promise<CredentialStatus[]> {
  const statuses: CredentialStatus[] = [];
  const allCreds = new Map<string, string>();

  // First pass: collect all credentials
  for (const cred of CREDENTIALS) {
    const value = getKeychainCredential(cred.name);
    if (value) {
      allCreds.set(cred.name, value);
    }
  }

  // Second pass: validate
  for (const cred of CREDENTIALS) {
    const value = allCreds.get(cred.name) || null;
    const status: CredentialStatus = { cred, value };

    if (validate && value && cred.validator) {
      process.stdout.write(`${colors.dim}Validating ${cred.name}...${colors.reset}\r`);
      status.validation = await cred.validator(value, allCreds);
      process.stdout.write(' '.repeat(50) + '\r');
    }

    statuses.push(status);
  }

  return statuses;
}

async function setupCredentials(): Promise<void> {
  const rl = createReadline();

  console.log(`\n${colors.bold}Interactive Credential Setup${colors.reset}\n`);
  console.log('This wizard will help you configure credentials for each service.');
  console.log('Press Enter to skip a credential, or Ctrl+C to exit.\n');

  const allCreds = new Map<string, string>();

  // Collect existing credentials
  for (const cred of CREDENTIALS) {
    const value = getKeychainCredential(cred.name);
    if (value) {
      allCreds.set(cred.name, value);
    }
  }

  for (const cred of CREDENTIALS) {
    const existing = allCreds.get(cred.name);

    if (existing) {
      const update = await prompt(rl, `\n${cred.name} is already set. Update? (y/N): `);
      if (update.toLowerCase() !== 'y') {
        continue;
      }
    }

    // Special handling for Google OAuth
    if (cred.name === 'GOOGLE_REFRESH_TOKEN') {
      const clientId = allCreds.get('GOOGLE_CLIENT_ID');
      const clientSecret = allCreds.get('GOOGLE_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        console.log(
          `${colors.yellow}⚠ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first${colors.reset}`
        );
        continue;
      }

      const runOAuth = await prompt(rl, '\nRun OAuth flow to get refresh token? (Y/n): ');

      if (runOAuth.toLowerCase() !== 'n') {
        const refreshToken = await runGoogleOAuthFlow();
        if (refreshToken) {
          if (setKeychainCredential(cred.name, refreshToken)) {
            console.log(`${colors.green}✓ Stored ${cred.name}${colors.reset}`);
            allCreds.set(cred.name, refreshToken);
          }
        }
        continue;
      }
    }

    const value = await promptCredential(rl, cred);

    if (value) {
      if (setKeychainCredential(cred.name, value)) {
        console.log(`${colors.green}✓ Stored ${cred.name}${colors.reset}`);
        allCreds.set(cred.name, value);
      }
    }
  }

  rl.close();
  console.log(`\n${colors.green}Setup complete!${colors.reset}`);
}

async function updateCredential(name: string): Promise<void> {
  const cred = CREDENTIALS.find((c) => c.name === name);

  if (!cred) {
    console.error(`${colors.red}Unknown credential: ${name}${colors.reset}`);
    console.log('\nAvailable credentials:');
    for (const c of CREDENTIALS) {
      console.log(`  - ${c.name}`);
    }
    process.exit(1);
  }

  const rl = createReadline();

  // Special handling for Google OAuth
  if (cred.name === 'GOOGLE_REFRESH_TOKEN') {
    const runOAuth = await prompt(rl, 'Run OAuth flow to get new refresh token? (Y/n): ');

    if (runOAuth.toLowerCase() !== 'n') {
      const refreshToken = await runGoogleOAuthFlow();
      if (refreshToken) {
        if (setKeychainCredential(cred.name, refreshToken)) {
          console.log(`${colors.green}✓ Updated ${cred.name}${colors.reset}`);
        }
      }
      rl.close();
      return;
    }
  }

  const value = await promptCredential(rl, cred);

  if (value) {
    if (setKeychainCredential(cred.name, value)) {
      console.log(`${colors.green}✓ Updated ${cred.name}${colors.reset}`);
    }
  }

  rl.close();
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log(`\n🔐 ${colors.bold}Apolitical Assistant - Credentials Manager${colors.reset}\n`);

  // Parse arguments
  const validate = args.includes('--validate');
  const setup = args.includes('--setup');
  const updateIndex = args.indexOf('--update');
  const updateName = updateIndex !== -1 ? args[updateIndex + 1] : null;

  if (setup) {
    await setupCredentials();
    return;
  }

  if (updateName) {
    await updateCredential(updateName);
    return;
  }

  // Default: check and optionally validate credentials
  const statuses = await checkCredentials(validate);
  printStatusTable(statuses, validate);

  // Summary
  const missing = statuses.filter((s) => !s.value).length;
  const invalid = validate ? statuses.filter((s) => s.validation && !s.validation.valid).length : 0;

  console.log('');

  if (missing > 0) {
    console.log(`${colors.yellow}${missing} credential(s) missing${colors.reset}`);
  }

  if (invalid > 0) {
    console.log(`${colors.yellow}${invalid} credential(s) invalid or have issues${colors.reset}`);
  }

  if (missing === 0 && invalid === 0) {
    console.log(
      `${colors.green}All credentials configured${validate ? ' and valid' : ''}!${colors.reset}`
    );
  } else {
    console.log(
      `\nRun with ${colors.cyan}--setup${colors.reset} to configure missing credentials.`
    );
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err}${colors.reset}`);
  process.exit(1);
});
