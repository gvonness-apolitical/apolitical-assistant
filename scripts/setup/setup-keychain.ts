#!/usr/bin/env npx tsx

import * as readline from 'node:readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
import { TODOS_CONFIG_PATH, getProjectRoot } from '../../packages/shared/src/paths.js';

const CREDENTIALS: CredentialKey[] = [
  'google-oauth-client-id',
  'google-oauth-client-secret',
  'google-refresh-token',
  'slack-token',
  'github-token',
  'linear-api-key',
  'humaans-api-token',
  'incidentio-api-key',
];

// Path configurations
interface PathConfig {
  key: string;
  description: string;
  configPath: string[];  // Path within the config object
  defaultValue: string;
  validate?: (path: string) => boolean;
}

const PATH_CONFIGS: PathConfig[] = [
  {
    key: 'dev-analytics-reports',
    description: 'Path to apolitical-dev-analytics reports directory',
    configPath: ['collectors', 'devAnalytics', 'reportsPath'],
    defaultValue: join(getProjectRoot(), '../apolitical-dev-analytics/reports'),
    validate: (path: string) => existsSync(path),
  },
];

interface TodoConfig {
  collectors?: {
    devAnalytics?: {
      enabled?: boolean;
      reportsPath?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function loadConfig(): TodoConfig {
  if (!existsSync(TODOS_CONFIG_PATH)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(TODOS_CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config: TodoConfig): void {
  const dir = dirname(TODOS_CONFIG_PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(TODOS_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getConfigValue(config: TodoConfig, path: string[]): string | undefined {
  let current: unknown = config;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function setConfigValue(config: TodoConfig, path: string[], value: string): void {
  let current: Record<string, unknown> = config;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]!] = value;
}

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
  console.log('  Apolitical Assistant - Setup');
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

function printPathStatus() {
  console.log('Current path configuration:\n');

  const config = loadConfig();

  for (const pathConfig of PATH_CONFIGS) {
    const value = getConfigValue(config, pathConfig.configPath);
    const isSet = !!value;
    const isValid = value && pathConfig.validate ? pathConfig.validate(value) : true;

    if (isSet && isValid) {
      console.log(`  \x1b[32m✓\x1b[0m ${pathConfig.key}`);
      console.log(`    ${value}`);
    } else if (isSet && !isValid) {
      console.log(`  \x1b[33m!\x1b[0m ${pathConfig.key} (path not found)`);
      console.log(`    ${value}`);
    } else {
      console.log(`  \x1b[90m-\x1b[0m ${pathConfig.key} (using default)`);
      console.log(`    ${pathConfig.defaultValue}`);
    }
  }

  console.log('');
}

async function configurePath(pathConfig: PathConfig): Promise<boolean> {
  console.log(`\n${pathConfig.description}`);

  const config = loadConfig();
  const currentValue = getConfigValue(config, pathConfig.configPath);

  if (currentValue) {
    console.log(`Current value: ${currentValue}`);
  } else {
    console.log(`Default value: ${pathConfig.defaultValue}`);
  }

  const newValue = await question('\nEnter new path (or press Enter to keep current): ');

  if (!newValue.trim()) {
    console.log('Keeping current value.');
    return false;
  }

  const resolvedPath = newValue.trim();

  // Validate the path if validator exists
  if (pathConfig.validate && !pathConfig.validate(resolvedPath)) {
    console.log(`\x1b[33mWarning: Path does not exist: ${resolvedPath}\x1b[0m`);
    const proceed = await question('Save anyway? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      return false;
    }
  }

  setConfigValue(config, pathConfig.configPath, resolvedPath);
  saveConfig(config);
  console.log('\x1b[32m✓ Path saved to config\x1b[0m');
  return true;
}

async function configureAllPaths() {
  for (const pathConfig of PATH_CONFIGS) {
    await configurePath(pathConfig);
  }
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
  printPathStatus();

  console.log('Options:');
  console.log('  1. Configure all credentials');
  console.log('  2. Configure missing credentials only');
  console.log('  3. Configure a specific credential');
  console.log('  4. Configure paths');
  console.log('  5. Test credentials');
  console.log('  6. Exit');
  console.log('');

  const choice = await question('Select an option (1-6): ');

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

    case '3': {
      console.log('\nAvailable credentials:');
      CREDENTIALS.forEach((key, idx) => {
        console.log(`  ${idx + 1}. ${key}`);
      });
      const indexStr = await question('\nSelect credential number: ');
      const selectedIndex = parseInt(indexStr, 10) - 1;
      if (selectedIndex >= 0 && selectedIndex < CREDENTIALS.length) {
        await configureCredential(CREDENTIALS[selectedIndex]!);
      } else {
        console.log('Invalid selection.');
      }
      break;
    }

    case '4': {
      if (PATH_CONFIGS.length === 1) {
        await configurePath(PATH_CONFIGS[0]!);
      } else {
        console.log('\nAvailable paths:');
        PATH_CONFIGS.forEach((config, idx) => {
          console.log(`  ${idx + 1}. ${config.key}`);
        });
        console.log(`  ${PATH_CONFIGS.length + 1}. Configure all paths`);
        const indexStr = await question('\nSelect path number: ');
        const selectedIndex = parseInt(indexStr, 10) - 1;
        if (selectedIndex === PATH_CONFIGS.length) {
          await configureAllPaths();
        } else if (selectedIndex >= 0 && selectedIndex < PATH_CONFIGS.length) {
          await configurePath(PATH_CONFIGS[selectedIndex]!);
        } else {
          console.log('Invalid selection.');
        }
      }
      break;
    }

    case '5':
      await testCredentials();
      break;

    case '6':
      console.log('Goodbye!');
      rl.close();
      return;

    default:
      console.log('Invalid option.');
  }

  // Show updated status and loop
  printStatus();
  printPathStatus();
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
