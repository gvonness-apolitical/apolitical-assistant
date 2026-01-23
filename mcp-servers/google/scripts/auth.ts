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

// Scopes for the MCP server
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify', // Read, send, delete, manage labels
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
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

          console.log('\n✅ Success! Here is your refresh token:\n');
          console.log('─'.repeat(60));
          console.log(tokens.refresh_token);
          console.log('─'.repeat(60));
          console.log('\nAdd this to your environment:');
          console.log(`\nexport GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
          console.log('\nOr add to your .env file:');
          console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
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
