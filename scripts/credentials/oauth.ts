/**
 * Google OAuth browser flow for obtaining refresh tokens.
 */

import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { colors, GOOGLE_SCOPES } from './types.js';
import { getKeychainCredential } from './keychain.js';

export async function runGoogleOAuthFlow(): Promise<string | null> {
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
