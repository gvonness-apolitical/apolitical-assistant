/**
 * Shared types, constants, and credential definitions for the credentials manager.
 */

// ANSI color codes
export const colors = {
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
export const symbols = {
  valid: `${colors.green}✓${colors.reset}`,
  missing: `${colors.red}✗${colors.reset}`,
  warning: `${colors.yellow}⚠${colors.reset}`,
};

// Credential definitions
export interface CredentialDef {
  name: string;
  service: string;
  description: string;
  required: boolean;
  validator?: (value: string, allCreds: Map<string, string>) => Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

export interface CredentialStatus {
  cred: CredentialDef;
  value: string | null;
  validation?: ValidationResult;
}

// Required Google OAuth scopes (read + write)
export const GOOGLE_SCOPES = [
  // Gmail - need modify for full read/write/labels
  'https://www.googleapis.com/auth/gmail.modify',
  // Calendar - need events scope for creating meetings
  'https://www.googleapis.com/auth/calendar.events',
  // Drive - readonly is sufficient
  'https://www.googleapis.com/auth/drive.readonly',
  // Docs, Sheets, Slides - readonly
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
];

// Required Slack scopes (read + write) - for reference
// Actual scope testing is done via API calls in validateSlackToken
//
// NOTE on canvases:read:
// Despite the scope existing, there is NO public API method to read canvas content.
// The canvases:read scope only enables canvases.sections.lookup which returns section IDs, not content.
// We read canvas content using files.info + url_private_download (requires files:read).
// See: https://github.com/slackapi/node-slack-sdk/blob/main/packages/web-api/src/methods.ts
//
export const SLACK_REQUIRED_SCOPES = {
  read: [
    'channels:read',
    'groups:read',
    'im:read',
    'mpim:read',
    'channels:history',
    'groups:history',
    'im:history',
    'mpim:history',
    'users:read',
    'users:read.email',
    'search:read',
    // canvases:read is NOT needed - we read via files.info + url_private_download
    'files:read',
    'bookmarks:read',
  ],
  write: ['chat:write', 'reactions:write', 'canvases:write', 'im:write'],
};

// Required GitHub scopes
export const GITHUB_REQUIRED_SCOPES = ['repo', 'read:org', 'read:user'];
