#!/usr/bin/env npx tsx

/**
 * Credential Health Check Script
 *
 * Verifies that all configured credentials are valid and have the correct permissions.
 * Run regularly (e.g., daily) to catch expired or revoked credentials early.
 */

import * as readline from 'node:readline';
import { execSync } from 'node:child_process';
import {
  getCredential,
  hasCredential,
} from '../../packages/shared/src/keychain.js';
import type { CredentialKey } from '../../packages/shared/src/types.js';

interface CredentialCheck {
  key: CredentialKey;
  name: string;
  check: () => Promise<CheckResult>;
  refreshCommand?: string;
}

interface CheckResult {
  valid: boolean;
  error?: string;
  details?: string;
  permissions?: string[];
  missingPermissions?: string[];
}

// ==================== CREDENTIAL CHECKS ====================

async function checkGoogle(): Promise<CheckResult> {
  const clientId = getCredential('google-oauth-client-id' as CredentialKey);
  const clientSecret = getCredential('google-oauth-client-secret' as CredentialKey);
  const refreshToken = getCredential('google-refresh-token' as CredentialKey);

  if (!clientId || !clientSecret) {
    return { valid: false, error: 'Client ID or Secret not configured' };
  }

  if (!refreshToken) {
    return { valid: false, error: 'Refresh token not configured. Run: npm run google-auth' };
  }

  try {
    // Try to get an access token
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
      if (error.includes('invalid_grant')) {
        return { valid: false, error: 'Refresh token expired or revoked. Run: npm run google-auth' };
      }
      return { valid: false, error: `Token refresh failed: ${error}` };
    }

    const tokenData = await tokenResponse.json() as { access_token: string; scope?: string };
    const accessToken = tokenData.access_token;

    // Check which scopes we have
    const tokenInfo = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    const tokenInfoData = await tokenInfo.json() as { scope?: string; error?: string };

    if (tokenInfoData.error) {
      return { valid: false, error: tokenInfoData.error };
    }

    const grantedScopes = (tokenInfoData.scope || '').split(' ');
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/presentations.readonly',
    ];

    const missingScopes = requiredScopes.filter(
      (scope) => !grantedScopes.some((g) => g.includes(scope.split('/').pop()!))
    );

    // Test Gmail access
    const gmailTest = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!gmailTest.ok) {
      return { valid: false, error: 'Gmail API access failed', missingPermissions: ['gmail.modify'] };
    }

    const profile = await gmailTest.json() as { emailAddress: string };

    if (missingScopes.length > 0) {
      return {
        valid: false,
        error: 'Missing required scopes',
        details: `Authenticated as ${profile.emailAddress}`,
        permissions: grantedScopes,
        missingPermissions: missingScopes.map((s) => s.split('/').pop()!),
      };
    }

    return {
      valid: true,
      details: `Authenticated as ${profile.emailAddress}`,
      permissions: grantedScopes.map((s) => s.split('/').pop() || s),
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkSlack(): Promise<CheckResult> {
  const token = getCredential('slack-token' as CredentialKey);

  if (!token) {
    return { valid: false, error: 'Token not configured' };
  }

  try {
    // Test auth
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const authData = await authResponse.json() as {
      ok: boolean;
      error?: string;
      user?: string;
      team?: string;
    };

    if (!authData.ok) {
      if (authData.error === 'token_revoked' || authData.error === 'invalid_auth') {
        return { valid: false, error: 'Token revoked or invalid. Create a new token in Slack App settings.' };
      }
      return { valid: false, error: `Auth failed: ${authData.error}` };
    }

    // Check scopes by trying operations
    const scopeChecks: { scope: string; test: () => Promise<boolean> }[] = [
      {
        scope: 'channels:read',
        test: async () => {
          const r = await fetch('https://slack.com/api/conversations.list?limit=1&types=public_channel', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = await r.json() as { ok: boolean };
          return d.ok;
        },
      },
      {
        scope: 'users:read',
        test: async () => {
          const r = await fetch('https://slack.com/api/users.list?limit=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = await r.json() as { ok: boolean };
          return d.ok;
        },
      },
      {
        scope: 'search:read',
        test: async () => {
          const r = await fetch('https://slack.com/api/search.messages?query=test&count=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = await r.json() as { ok: boolean };
          return d.ok;
        },
      },
    ];

    const permissions: string[] = [];
    const missingPermissions: string[] = [];

    for (const check of scopeChecks) {
      const hasScope = await check.test();
      if (hasScope) {
        permissions.push(check.scope);
      } else {
        missingPermissions.push(check.scope);
      }
    }

    if (missingPermissions.length > 0) {
      return {
        valid: false,
        error: 'Missing required scopes',
        details: `Authenticated as ${authData.user} in ${authData.team}`,
        permissions,
        missingPermissions,
      };
    }

    return {
      valid: true,
      details: `Authenticated as ${authData.user} in ${authData.team}`,
      permissions,
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkGitHub(): Promise<CheckResult> {
  const token = getCredential('github-token' as CredentialKey);

  if (!token) {
    return { valid: false, error: 'Token not configured' };
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'apolitical-assistant',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Token expired or revoked. Create a new PAT in GitHub settings.' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    const user = await response.json() as { login: string };

    // Check scopes from response header
    const scopes = response.headers.get('x-oauth-scopes')?.split(', ') || [];

    const requiredScopes = ['repo', 'read:org', 'read:user'];
    const missingScopes = requiredScopes.filter((s) => !scopes.includes(s));

    if (missingScopes.length > 0) {
      return {
        valid: false,
        error: 'Missing required scopes',
        details: `Authenticated as ${user.login}`,
        permissions: scopes,
        missingPermissions: missingScopes,
      };
    }

    return {
      valid: true,
      details: `Authenticated as ${user.login}`,
      permissions: scopes,
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkLinear(): Promise<CheckResult> {
  const token = getCredential('linear-api-key' as CredentialKey);

  if (!token) {
    return { valid: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ viewer { id name email } }',
      }),
    });

    const data = await response.json() as {
      data?: { viewer: { name: string; email: string } };
      errors?: Array<{ message: string }>;
    };

    if (data.errors) {
      return { valid: false, error: data.errors[0]?.message || 'GraphQL error' };
    }

    if (!data.data?.viewer) {
      return { valid: false, error: 'Invalid response from Linear API' };
    }

    return {
      valid: true,
      details: `Authenticated as ${data.data.viewer.name} (${data.data.viewer.email})`,
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkHumaans(): Promise<CheckResult> {
  const token = getCredential('humaans-api-token' as CredentialKey);

  if (!token) {
    return { valid: false, error: 'API token not configured' };
  }

  try {
    const response = await fetch('https://app.humaans.io/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Token expired or invalid. Generate a new token in Humaans.' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    const user = await response.json() as { firstName: string; lastName: string; email: string };

    return {
      valid: true,
      details: `Authenticated as ${user.firstName} ${user.lastName}`,
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkIncidentIo(): Promise<CheckResult> {
  const token = getCredential('incidentio-api-key' as CredentialKey);

  if (!token) {
    return { valid: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://api.incident.io/v2/incidents?page_size=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'API key invalid. Generate a new key in Incident.io.' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    return { valid: true, details: 'API key valid' };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== MAIN LOGIC ====================

const CREDENTIAL_CHECKS: CredentialCheck[] = [
  {
    key: 'google-oauth-client-id' as CredentialKey,
    name: 'Google',
    check: checkGoogle,
    refreshCommand: 'npm run google-auth',
  },
  {
    key: 'slack-token' as CredentialKey,
    name: 'Slack',
    check: checkSlack,
    refreshCommand: 'npm run setup (then update slack-token)',
  },
  {
    key: 'github-token' as CredentialKey,
    name: 'GitHub',
    check: checkGitHub,
    refreshCommand: 'npm run setup (then update github-token)',
  },
  {
    key: 'linear-api-key' as CredentialKey,
    name: 'Linear',
    check: checkLinear,
    refreshCommand: 'npm run setup (then update linear-api-key)',
  },
  {
    key: 'humaans-api-token' as CredentialKey,
    name: 'Humaans',
    check: checkHumaans,
    refreshCommand: 'npm run setup (then update humaans-api-token)',
  },
  {
    key: 'incidentio-api-key' as CredentialKey,
    name: 'Incident.io',
    check: checkIncidentIo,
    refreshCommand: 'npm run setup (then update incidentio-api-key)',
  },
];

async function runChecks(): Promise<Map<string, { result: CheckResult; check: CredentialCheck }>> {
  const results = new Map<string, { result: CheckResult; check: CredentialCheck }>();

  console.log('Checking credentials...\n');

  for (const check of CREDENTIAL_CHECKS) {
    // Skip if not configured at all
    if (!hasCredential(check.key)) {
      process.stdout.write(`  ${check.name}: `);
      console.log('\x1b[90m○ Not configured\x1b[0m');
      continue;
    }

    process.stdout.write(`  ${check.name}: `);

    try {
      const result = await check.check();
      results.set(check.name, { result, check });

      if (result.valid) {
        console.log(`\x1b[32m✓ Valid\x1b[0m`);
        if (result.details) {
          console.log(`    ${result.details}`);
        }
      } else {
        console.log(`\x1b[31m✗ Invalid\x1b[0m`);
        console.log(`    Error: ${result.error}`);
        if (result.missingPermissions && result.missingPermissions.length > 0) {
          console.log(`    Missing: ${result.missingPermissions.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`\x1b[31m✗ Error\x1b[0m`);
      console.log(`    ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.set(check.name, {
        result: { valid: false, error: error instanceof Error ? error.message : 'Unknown error' },
        check,
      });
    }
  }

  return results;
}

async function promptRefresh(
  failedChecks: Array<{ name: string; check: CredentialCheck; result: CheckResult }>
): Promise<void> {
  if (failedChecks.length === 0) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n----------------------------------------');
  console.log('The following credentials need attention:\n');

  for (let i = 0; i < failedChecks.length; i++) {
    const { name, check, result } = failedChecks[i]!;
    console.log(`  ${i + 1}. ${name}`);
    console.log(`     Error: ${result.error}`);
    console.log(`     Fix: ${check.refreshCommand}`);
    console.log('');
  }

  const answer = await question('Would you like to refresh any credentials now? (y/n): ');

  if (answer.toLowerCase() === 'y') {
    for (const { name, check } of failedChecks) {
      const refresh = await question(`\nRefresh ${name}? (y/n): `);

      if (refresh.toLowerCase() === 'y') {
        console.log(`\nTo fix ${name}:`);
        console.log(`  ${check.refreshCommand}\n`);

        if (check.refreshCommand?.includes('google-auth')) {
          const runNow = await question('Run npm run google-auth now? (y/n): ');
          if (runNow.toLowerCase() === 'y') {
            rl.close();
            console.log('\nRunning Google OAuth flow...\n');
            execSync('npm run google-auth', { stdio: 'inherit' });
            return;
          }
        } else if (check.refreshCommand?.includes('npm run setup')) {
          const runNow = await question('Run npm run setup now? (y/n): ');
          if (runNow.toLowerCase() === 'y') {
            rl.close();
            console.log('\nRunning setup wizard...\n');
            execSync('npm run setup', { stdio: 'inherit' });
            return;
          }
        }
      }
    }
  }

  rl.close();
}

async function main() {
  console.log('========================================');
  console.log('  Credential Health Check');
  console.log('========================================\n');

  const results = await runChecks();

  const failedChecks = Array.from(results.entries())
    .filter(([, { result }]) => !result.valid)
    .map(([name, { result, check }]) => ({ name, result, check }));

  const validCount = results.size - failedChecks.length;
  const configuredCount = results.size;

  console.log('\n----------------------------------------');
  console.log(`Summary: ${validCount}/${configuredCount} credentials valid`);

  if (failedChecks.length === 0) {
    console.log('\n\x1b[32mAll configured credentials are working!\x1b[0m\n');
    process.exit(0);
  }

  // In interactive mode, prompt to refresh
  if (process.stdin.isTTY && !process.argv.includes('--ci')) {
    await promptRefresh(failedChecks);
  } else {
    // In CI mode, just exit with error
    console.log('\n\x1b[31mSome credentials are invalid or expired.\x1b[0m');
    console.log('Run this script interactively to refresh them.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
