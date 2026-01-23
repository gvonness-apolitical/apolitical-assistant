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
    description: 'Bot User OAuth Token (xoxb-...)',
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

// Required Google OAuth scopes
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
];

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

    if (missingScopes.length > 0) {
      return {
        valid: false,
        message: `Missing scopes: ${missingScopes.length}`,
        details: missingScopes.join(', '),
      };
    }

    return {
      valid: true,
      message: `Valid (${grantedScopes.length} scopes)`,
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
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      user?: string;
      team?: string;
    };

    if (!data.ok) {
      return {
        valid: false,
        message: data.error || 'Invalid token',
      };
    }

    return {
      valid: true,
      message: `Valid (user: ${data.user}, team: ${data.team})`,
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
    const response = await fetch('https://api.incident.io/v2/incidents?page_size=1', {
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
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ viewer { id name } }',
      }),
    });

    if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid token',
      };
    }

    const data = (await response.json()) as {
      data?: { viewer?: { name: string } };
      errors?: Array<{ message: string }>;
    };

    if (data.errors) {
      return {
        valid: false,
        message: data.errors[0]?.message || 'API error',
      };
    }

    return {
      valid: true,
      message: `Valid (user: ${data.data?.viewer?.name || 'unknown'})`,
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

    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://127.0.0.1:${REDIRECT_PORT}`);

      if (url.pathname === '/') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error</h1><p>${error}</p>`);
          console.error(`${colors.red}Authorization failed: ${error}${colors.reset}`);
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
              server.close();
              resolve(null);
              return;
            }

            const tokens = (await tokenResponse.json()) as { refresh_token: string };
            console.log(`${colors.green}✓ OAuth flow completed successfully${colors.reset}`);
            server.close();
            resolve(tokens.refresh_token);
          } catch (err) {
            console.error(`${colors.red}Token exchange error: ${err}${colors.reset}`);
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
    setTimeout(
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
