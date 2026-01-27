#!/usr/bin/env npx tsx

/**
 * Google OAuth Helper Script
 *
 * Obtains a refresh token for the Google MCP server.
 *
 * Usage:
 *   npx tsx scripts/auth.ts
 *
 * Required environment variables:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';
import { exec } from 'node:child_process';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;

// Scopes for the MCP server (must match Google Cloud Console OAuth consent screen)
const SCOPES = [
  // Gmail
  'https://www.googleapis.com/auth/gmail.modify', // Read, compose, send emails
  'https://www.googleapis.com/auth/gmail.compose', // Manage drafts and send emails
  'https://www.googleapis.com/auth/gmail.send', // Send email on your behalf
  // Calendar
  'https://www.googleapis.com/auth/calendar', // Full calendar access
  'https://www.googleapis.com/auth/calendar.events', // View and edit events
  // Drive
  'https://www.googleapis.com/auth/drive.readonly', // See and download files
  'https://www.googleapis.com/auth/drive.metadata', // View and manage metadata
  // Docs, Sheets, Slides (full access for create/edit)
  'https://www.googleapis.com/auth/documents', // Create, edit, delete docs
  'https://www.googleapis.com/auth/spreadsheets', // Create, edit, delete sheets
  'https://www.googleapis.com/auth/presentations', // Create, edit, delete slides
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Missing required environment variables');
  console.error('  - GOOGLE_CLIENT_ID');
  console.error('  - GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${command} "${url}"`);
}

function saveToKeychain(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      console.log('\n⚠️  Keychain storage is only supported on macOS');
      resolve();
      return;
    }

    // Use -U to update existing entry, -a for account, -s for service, -w for password
    const cmd = `security add-generic-password -a "claude" -s "GOOGLE_REFRESH_TOKEN" -w "${token}" -U`;

    exec(cmd, (error) => {
      if (error) {
        reject(new Error(`Failed to save to Keychain: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

async function main(): Promise<void> {
  console.log('🔐 Google OAuth Helper\n');

  // Build authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force refresh token

  // Start local server to capture redirect
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${REDIRECT_PORT}`);

    if (url.pathname === '/') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${error}</p>`);
        console.error(`\n❌ Authorization failed: ${error}`);
        server.close();
        process.exit(1);
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Success!</h1><p>You can close this window.</p>');

        try {
          console.log('\n⏳ Exchanging code for tokens...');
          const tokens = await exchangeCodeForTokens(code);

          console.log('\n✅ Token exchange successful!');

          // Save to macOS Keychain
          try {
            await saveToKeychain(tokens.refresh_token);
            console.log('🔑 Saved refresh token to macOS Keychain');
            console.log('\n✅ All done! Restart Claude Code to use the new token.');
          } catch (keychainErr) {
            console.error(`\n⚠️  Could not save to Keychain: ${keychainErr}`);
            console.log('\nManually add this to your Keychain or environment:\n');
            console.log('─'.repeat(60));
            console.log(tokens.refresh_token);
            console.log('─'.repeat(60));
          }
        } catch (err) {
          console.error(`\n❌ Token exchange failed: ${err}`);
        }

        server.close();
      }
    }
  });

  server.listen(REDIRECT_PORT, '127.0.0.1', () => {
    console.log(`📡 Listening on http://127.0.0.1:${REDIRECT_PORT}`);
    console.log('\n🌐 Opening browser for authorization...\n');
    console.log('If the browser does not open, visit this URL:');
    console.log(authUrl.toString());
    console.log('');

    openBrowser(authUrl.toString());
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
