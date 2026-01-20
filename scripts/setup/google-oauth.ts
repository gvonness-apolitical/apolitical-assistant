#!/usr/bin/env npx tsx

/**
 * Google OAuth Setup Script
 *
 * Performs the one-time OAuth flow to get a refresh token for Google APIs.
 * Stores the refresh token in macOS Keychain.
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';
import { execSync } from 'node:child_process';
import {
  getCredential,
  setCredential,
  hasCredential,
} from '../../packages/shared/src/keychain.js';
import type { CredentialKey } from '../../packages/shared/src/types.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
];

const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function getAuthorizationCode(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>✅ Authorization Successful</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\nStarting OAuth flow...`);
      console.log(`Listening on http://localhost:${REDIRECT_PORT}`);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log(`\nOpening browser for authorization...`);
      console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

      // Open browser
      execSync(`open "${authUrl.toString()}"`);
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out'));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

async function testTokens(accessToken: string): Promise<void> {
  console.log('\nTesting access token...');

  // Test with Gmail API
  const response = await fetch(
    'https://www.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Token test failed: ${response.status}`);
  }

  const profile = await response.json() as { emailAddress: string };
  console.log(`\x1b[32m✓\x1b[0m Authenticated as: ${profile.emailAddress}`);
}

async function main() {
  console.log('========================================');
  console.log('  Google OAuth Setup');
  console.log('========================================\n');

  // Check for existing credentials
  const clientId = getCredential('google-oauth-client-id' as CredentialKey);
  const clientSecret = getCredential('google-oauth-client-secret' as CredentialKey);

  if (!clientId) {
    console.error('\x1b[31mError:\x1b[0m google-oauth-client-id not found in Keychain.');
    console.error('Run: npm run setup');
    process.exit(1);
  }

  if (!clientSecret) {
    console.error('\x1b[31mError:\x1b[0m google-oauth-client-secret not found in Keychain.');
    console.error('Run: npm run setup');
    process.exit(1);
  }

  // Check if refresh token already exists
  if (hasCredential('google-refresh-token' as CredentialKey)) {
    console.log('A refresh token is already configured.');
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Do you want to re-authorize? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Keeping existing token.');
      process.exit(0);
    }
  }

  console.log('Scopes requested:');
  SCOPES.forEach((scope) => {
    const shortScope = scope.split('/').pop();
    console.log(`  - ${shortScope}`);
  });

  try {
    // Get authorization code
    const code = await getAuthorizationCode(clientId);
    console.log('\n\x1b[32m✓\x1b[0m Authorization code received');

    // Exchange for tokens
    console.log('Exchanging code for tokens...');
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret
    );
    console.log('\x1b[32m✓\x1b[0m Tokens received');

    // Test the tokens
    await testTokens(accessToken);

    // Store refresh token
    setCredential('google-refresh-token' as CredentialKey, refreshToken);
    console.log('\x1b[32m✓\x1b[0m Refresh token saved to Keychain');

    console.log('\n========================================');
    console.log('  Google OAuth Setup Complete!');
    console.log('========================================\n');
    console.log('You can now use the Google MCP server.');

  } catch (error) {
    console.error('\n\x1b[31mError:\x1b[0m', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
