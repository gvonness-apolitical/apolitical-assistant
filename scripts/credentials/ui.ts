/**
 * Terminal prompts and status display for the credentials manager.
 */

import { createInterface } from 'node:readline';
import { colors, symbols, type CredentialDef, type CredentialStatus } from './types.js';

export function createReadline(): ReturnType<typeof createInterface> {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export async function prompt(
  rl: ReturnType<typeof createInterface>,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function promptCredential(
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

export function printStatusTable(statuses: CredentialStatus[], showValidation: boolean): void {
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
