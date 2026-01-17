#!/usr/bin/env npx tsx

import * as readline from 'node:readline';
import {
  setCredential,
  getCredential,
  hasCredential,
  listConfiguredCredentials,
} from '../../packages/shared/src/keychain.js';
import {
  type CredentialKey,
  CREDENTIAL_DESCRIPTIONS,
} from '../../packages/shared/src/types.js';

const CREDENTIALS: CredentialKey[] = [
  'google-oauth-client-id',
  'google-oauth-client-secret',
  'google-refresh-token',
  'slack-token',
  'github-token',
  'linear-api-key',
  'humaans-api-token',
  'incidentio-api-key',
  'lattice-api-key',
  'notion-api-key',
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    const stdin = process.stdin;
    const originalRawMode = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let input = '';

    const onData = (char: Buffer) => {
      const c = char.toString();

      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          if (stdin.isTTY) {
            stdin.setRawMode(originalRawMode ?? false);
          }
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u007F': // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          break;
        default:
          input += c;
          break;
      }
    };

    stdin.on('data', onData);
    stdin.resume();
  });
}

function printHeader() {
  console.log('\n========================================');
  console.log('  Apolitical Assistant - Credential Setup');
  console.log('========================================\n');
}

function printStatus() {
  console.log('Current credential status:\n');

  for (const key of CREDENTIALS) {
    const configured = hasCredential(key);
    const status = configured ? '✓' : '✗';
    const color = configured ? '\x1b[32m' : '\x1b[31m';
    console.log(`  ${color}${status}\x1b[0m ${key}`);
  }

  console.log('');
}

async function configureCredential(key: CredentialKey): Promise<boolean> {
  const description = CREDENTIAL_DESCRIPTIONS[key];
  console.log(`\n${description}`);

  const existing = hasCredential(key);
  if (existing) {
    const overwrite = await question('This credential is already configured. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Skipped.');
      return false;
    }
  }

  const value = await questionHidden('Enter value (hidden): ');

  if (!value.trim()) {
    console.log('No value provided. Skipped.');
    return false;
  }

  try {
    setCredential(key, value.trim());
    console.log('\x1b[32m✓ Credential saved to Keychain\x1b[0m');
    return true;
  } catch (error) {
    console.error('\x1b[31mError saving credential:\x1b[0m', error);
    return false;
  }
}

async function interactiveSetup() {
  printHeader();
  printStatus();

  console.log('Options:');
  console.log('  1. Configure all credentials');
  console.log('  2. Configure missing credentials only');
  console.log('  3. Configure a specific credential');
  console.log('  4. Test credentials');
  console.log('  5. Exit');
  console.log('');

  const choice = await question('Select an option (1-5): ');

  switch (choice) {
    case '1':
      for (const key of CREDENTIALS) {
        await configureCredential(key);
      }
      break;

    case '2':
      for (const key of CREDENTIALS) {
        if (!hasCredential(key)) {
          await configureCredential(key);
        }
      }
      break;

    case '3':
      console.log('\nAvailable credentials:');
      CREDENTIALS.forEach((key, index) => {
        console.log(`  ${index + 1}. ${key}`);
      });
      const indexStr = await question('\nSelect credential number: ');
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < CREDENTIALS.length) {
        await configureCredential(CREDENTIALS[index]!);
      } else {
        console.log('Invalid selection.');
      }
      break;

    case '4':
      await testCredentials();
      break;

    case '5':
      console.log('Goodbye!');
      rl.close();
      return;

    default:
      console.log('Invalid option.');
  }

  // Show updated status and loop
  printStatus();
  await interactiveSetup();
}

async function testCredentials() {
  console.log('\nTesting configured credentials...\n');

  const configured = listConfiguredCredentials();

  if (configured.length === 0) {
    console.log('No credentials configured.');
    return;
  }

  for (const key of configured) {
    const value = getCredential(key);
    if (value) {
      // Just show that we can read it (don't expose the actual value)
      const preview = value.substring(0, 8) + '...';
      console.log(`  \x1b[32m✓\x1b[0m ${key}: ${preview}`);
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${key}: Failed to read`);
    }
  }

  console.log('');
}

// Handle --test flag for verification
if (process.argv.includes('--test')) {
  console.log('Testing keychain access...\n');
  testCredentials().then(() => {
    process.exit(0);
  });
} else {
  interactiveSetup().then(() => {
    rl.close();
  });
}
