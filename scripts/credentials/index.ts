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

import { colors, type CredentialDef, type CredentialStatus } from './types.js';
import { getKeychainCredential, setKeychainCredential } from './keychain.js';
import {
  validateGoogleToken,
  validateSlackToken,
  validateIncidentioToken,
  validateHumaansToken,
  validateGithubToken,
  validateLinearToken,
} from './validators.js';
import { runGoogleOAuthFlow } from './oauth.js';
import { createReadline, prompt, promptCredential, printStatusTable } from './ui.js';

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
