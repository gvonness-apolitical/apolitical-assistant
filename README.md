# Apolitical Engineering Leadership Assistant

A Claude-powered assistant for the Director of Engineering that integrates with Gmail, Slack, Google Drive/Docs, Google Calendar, GitHub, Linear, Humaans, Incident.io, and Notion.

## Features

- **Morning Briefings**: Daily summary of calendar, emails, incidents, and priorities
- **Email Triage**: Intelligent email cleanup with user confirmation
- **Meeting Prep**: Context gathering for upcoming meetings
- **EOD Summaries**: End-of-day review and tomorrow preview
- **Ad-hoc Assistance**: Document drafting, research, and queries

## Quick Start

```bash
# Install dependencies
npm install

# Run setup wizard
npm run setup

# Build all packages
npm run build

# Install scheduled tasks
bash scripts/setup/install-launchd.sh
```

## Project Structure

```
apolitical-assistant/
├── packages/
│   ├── shared/           # Shared utilities (keychain, notifications)
│   └── context-store/    # SQLite persistence layer
├── mcp-servers/
│   ├── google/           # Gmail, Calendar, Drive, Docs, Sheets, Slides
│   ├── slack/            # Slack search, channels, DMs
│   ├── humaans/          # Humaans HR integration
│   └── incident-io/      # Incident.io integration
├── scripts/
│   ├── setup/            # Installation and configuration
│   └── workflows/        # Automated workflow scripts
├── launchd/              # macOS launch agent configs
├── context/              # Encrypted user data (git-crypt)
└── output/               # Generated briefings
```

## Integrations

### Custom MCP Servers (included in this repo)
| Service | Purpose |
|---------|---------|
| Google | Gmail, Calendar, Drive, Docs, Sheets, Slides |
| Slack | Search, channels, DMs, users |
| Humaans | HR, org chart, time off |
| Incident.io | Incidents and follow-ups |

### External MCP Servers
| Service | Purpose |
|---------|---------|
| GitHub | Repos, PRs, Issues |
| Linear | Project management (hosted) |
| Notion | Documentation (hosted) |

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Claude CLI (`claude`)
- git-crypt (optional, for encrypted storage)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Credentials

Run the interactive setup wizard to store credentials in macOS Keychain:

```bash
npm run setup
```

See [Obtaining API Credentials](#obtaining-api-credentials) below for detailed instructions on getting each token.

### 3. Build the Project

```bash
npm run build
```

### 4. Set Up Encryption (Optional)

If you have git-crypt installed:

```bash
bash scripts/setup/setup-git-crypt.sh
```

This encrypts the `context/` directory containing personal data.

### 5. Install Scheduled Tasks

```bash
bash scripts/setup/install-launchd.sh
```

## Usage

### Manual Commands

```bash
# Generate morning briefing
npm run morning-briefing

# Run email cleanup (interactive)
npm run email-cleanup

# Generate EOD summary
npm run eod-summary
```

### Scheduled Tasks

By default, launchd runs:
- Morning Briefing: 8:00 AM
- EOD Summary: 5:00 PM

Check status:
```bash
bash scripts/setup/install-launchd.sh status
```

### Interactive Use

Use Claude CLI directly with all integrations:

```bash
cd /path/to/apolitical-assistant
claude

# Example queries:
# "Prepare me for my 2pm meeting"
# "Summarize my unread emails"
# "Who's out of office this week?"
# "Show active incidents"
# "What are my top priorities today?"
```

## Configuration

### User Preferences

Edit `context/preferences.json` to customize:
- Working hours
- Notification settings
- Integration-specific options
- Briefing preferences

### MCP Server Configuration

Edit `.claude/settings.json` to modify MCP server settings.

## Troubleshooting

### Credentials Not Working

```bash
# Test keychain access
npx tsx scripts/setup/setup-keychain.ts --test
```

### MCP Server Issues

```bash
# List configured servers
claude mcp list

# Test a specific integration
claude "List my calendar events for today"
```

### Launchd Issues

```bash
# Check agent status
launchctl list | grep apolitical

# View logs
tail -f logs/morning-briefing.stderr.log
```

## Development

### Building Individual Packages

```bash
# Build shared utilities
npm run build --workspace=@apolitical-assistant/shared

# Build context store
npm run build --workspace=@apolitical-assistant/context-store

# Build MCP servers
npm run build --workspace=@apolitical-assistant/mcp-humaans
```

### Adding New MCP Servers

1. Create directory in `mcp-servers/`
2. Copy structure from existing server
3. Implement tools in `src/tools.ts`
4. Add configuration to `.claude/settings.json`

## Obtaining API Credentials

### Google (Gmail, Calendar, Drive, Docs, Sheets, Slides)

Requires creating a Google Cloud project with OAuth credentials.

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Sign in with your Google Workspace account
   - Create a new project (e.g., "Personal Assistant")

2. **Enable APIs**
   - Go to "APIs & Services" → "Library"
   - Enable: Gmail API, Google Calendar API, Google Drive API, Google Docs API, Google Sheets API, Google Slides API

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen" (or "Google Auth Platform")
   - Select "Internal" (for Workspace accounts - tokens won't expire)
   - Fill in app name, support email
   - Under "Data Access" or "Scopes", add:
     - `gmail.modify`
     - `calendar.readonly`
     - `drive.metadata.readonly`
     - `documents.readonly`
     - `spreadsheets.readonly`
     - `presentations.readonly`

4. **Create OAuth Credentials**
   - Go to "Credentials" (or "Clients")
   - Create OAuth client ID → Desktop app
   - Copy **Client ID** and **Client Secret**

5. **Store and Authorize**
   ```bash
   npm run setup          # Store Client ID and Client Secret
   npm run google-auth    # Authorize and get refresh token
   ```

---

### Slack

Requires creating a Slack App with user token scopes.

1. **Create a Slack App**
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name it and select your workspace

2. **Add User Token Scopes**
   - Go to "OAuth & Permissions"
   - Under "User Token Scopes" (not Bot Token Scopes), add:
     - `search:read` (or `search:read.public`)
     - `channels:history`
     - `channels:read`
     - `groups:history`
     - `groups:read`
     - `im:history`
     - `im:read`
     - `users:read`

3. **Install to Workspace**
   - Click "Install to Workspace"
   - Authorize the app
   - Copy the **User OAuth Token** (`xoxp-...`)

4. **Store the Token**
   ```bash
   npm run setup  # Save as 'slack-token'
   ```

> **Note**: Using a User Token means the app acts as you, accessing only what you can already see. No admin approval needed unless your workspace restricts app installation.

---

### GitHub

Requires a Personal Access Token (classic or fine-grained).

1. **Create a Personal Access Token**
   - Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
   - Click "Generate new token" (classic) or "Fine-grained tokens"

2. **Select Scopes** (for classic tokens)
   - `repo` - Full repository access
   - `read:org` - Read org membership
   - `read:user` - Read user profile

3. **Copy and Store**
   ```bash
   npm run setup  # Save as 'github-token'
   ```

---

### Linear

1. **Create an API Key**
   - Go to [Linear Settings → API](https://linear.app/settings/api)
   - Click "Create key"
   - Give it a label (e.g., "Personal Assistant")
   - Copy the key

2. **Store the Key**
   ```bash
   npm run setup  # Save as 'linear-api-key'
   ```

---

### Notion

Notion uses **hosted OAuth** - no API key setup required. When you first use Notion tools in Claude, you'll be prompted to authorize via browser.

1. **Authorize When Prompted**
   - Claude will provide an authorization link
   - Click it and sign in to Notion
   - Select the pages you want to grant access to

2. **Share Parent Pages for Broad Access**
   - When authorizing, select top-level workspace pages (e.g., "Engineering", "Projects")
   - All child/nested pages will inherit access automatically
   - This avoids having to share individual pages

> **Note**: Creating a Notion integration requires workspace owner status. The hosted OAuth approach bypasses this requirement.

---

### Humaans

1. **Get API Token**
   - Log in to [Humaans](https://app.humaans.io/)
   - Go to Settings → API → Generate new token
   - Copy the token

2. **Store the Token**
   ```bash
   npm run setup  # Save as 'humaans-api-token'
   ```

---

### Incident.io

1. **Create an API Key**
   - Log in to [Incident.io](https://app.incident.io/)
   - Go to Settings → API Keys
   - Create a new key with read permissions
   - Copy the key

2. **Store the Key**
   ```bash
   npm run setup  # Save as 'incidentio-api-key'
   ```

---

## Security

- All credentials stored in macOS Keychain
- Personal data encrypted with git-crypt
- No credentials in code or config files
- MCP servers run locally

## License

Private - Apolitical internal use only.
