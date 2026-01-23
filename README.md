# Apolitical Engineering Leadership Assistant

A Claude Code-powered assistant for the Director of Engineering that integrates with Gmail, Slack, Google Drive/Docs, Google Calendar, GitHub, Linear, Humaans, Incident.io, and Notion.

## Overview

This assistant uses Claude Code with MCP (Model Context Protocol) servers to provide a conversational interface for engineering leadership tasks. Instead of rigid automation, it offers flexible, context-aware assistance through natural conversation.

## Features

- **Morning Briefings**: Daily summary of calendar, emails, incidents, and priorities
- **Email Triage**: Intelligent email categorisation with user confirmation
- **Meeting Prep & Scheduling**: Context gathering and smart scheduling with availability checking
- **Meeting Notes**: Process Gemini auto-transcripts into structured notes
- **EOD & Weekly Reviews**: End-of-day summaries and weekly retrospectives
- **Blocker & Status Analysis**: Check what's blocking a person, project, or team
- **Context Finder**: Search across all systems for information on any topic
- **Response Drafting**: Draft replies to emails, Slack, PRs, and Linear tickets
- **RFC Reviews**: Technical reviews of RFCs in Notion with structured feedback

## Available Skills

Use `/[skill-name]` in Claude Code to invoke workflows:

### Daily Operations
| Skill | Purpose |
|-------|---------|
| `/morning-briefing` | Generate daily briefing |
| `/end-of-day` | Generate EOD summary |
| `/triage-inbox` | Review and categorise emails |

### Meetings
| Skill | Purpose |
|-------|---------|
| `/prep-meeting [meeting]` | Prepare for an upcoming meeting |
| `/meeting-notes [doc-id]` | Process Gemini notes into structured format |
| `/schedule-meeting [attendees] [topic]` | Smart scheduling with availability checking |

### Communication
| Skill | Purpose |
|-------|---------|
| `/draft-email [message-id]` | Draft an email response |
| `/respond-to [url/id]` | Draft response to email, Slack, PR, or Linear |
| `/summarise [url]` | Summarise a thread, document, or conversation |

### Research & Status
| Skill | Purpose |
|-------|---------|
| `/find-context [person/project/topic]` | Search all systems for context |
| `/team-status [squad]` | Comprehensive team status |
| `/whats-blocking [person/project]` | Check blockers |
| `/weekly-review` | End-of-week summary and retrospective |

### Technical Review
| Skill | Purpose |
|-------|---------|
| `/review-rfc [notion-url]` | RFC review with Notion comments (quick/standard/deep) |
| `/review-doc [doc-url]` | Review Google Docs/Slides from non-technical stakeholders |

## Project Structure

```
apolitical-assistant/
├── .claude/
│   ├── CLAUDE.md              # Assistant instructions and guidelines
│   ├── commands/              # Skill definitions (15 skills)
│   └── settings.local.json    # Local MCP permissions
├── mcp-servers/
│   ├── google/                # Gmail, Calendar, Drive, Docs, Sheets, Slides
│   ├── slack/                 # Slack channels, DMs, search, messaging
│   ├── humaans/               # HR, org chart, time off
│   └── incident-io/           # Incidents and follow-ups
├── morning-briefing/          # Daily briefings
├── meetings/output/           # Meeting prep and notes (by type)
├── tech-notes/                # Technical documentation
├── context/                   # Session notes, EOD, weekly reviews
└── 121/                       # Raw 1:1 transcripts from Gemini
```

## Integrations

### Custom MCP Servers (included)
| Service | Capabilities |
|---------|--------------|
| Google | Gmail (read/send/draft), Calendar (read/create/freebusy), Drive, Docs, Sheets, Slides |
| Slack | Search, read channels/DMs, send messages, add reactions |
| Humaans | HR, org chart, time off |
| Incident.io | Incidents (read/create/update), follow-ups (read/create) |

### External MCP Servers
| Service | Purpose |
|---------|---------|
| GitHub | Repos, PRs, Issues |
| Linear | Project management |
| Notion | Documentation |

## Required Scopes & Permissions

Each integration requires specific API permissions. If you only need read operations, you can omit the write scopes.

### Google OAuth Scopes

Configure these in your Google Cloud Console OAuth consent screen.

**Required for read operations:**
| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read and search emails |
| `calendar.readonly` | View calendar events |
| `drive.readonly` | Search and list files |
| `documents.readonly` | Read Google Docs content |
| `spreadsheets.readonly` | Read Google Sheets |
| `presentations.readonly` | Read Google Slides |

**Required for write operations:**
| Scope | Purpose |
|-------|---------|
| `gmail.send` | Send emails |
| `gmail.compose` | Create drafts |
| `calendar.events` | Create/update calendar events |
| `calendar.freebusy` | Check availability (for `/schedule-meeting`) |

Full scope URLs use the prefix `https://www.googleapis.com/auth/`

### Slack App Scopes

Configure these in your Slack App's OAuth & Permissions settings.

**Required for read operations:**
| Scope | Purpose |
|-------|---------|
| `channels:read` | List public channels |
| `groups:read` | List private channels |
| `im:read` | List DM conversations |
| `mpim:read` | List group DMs |
| `channels:history` | Read public channel messages |
| `groups:history` | Read private channel messages |
| `im:history` | Read DM messages |
| `mpim:history` | Read group DM messages |
| `users:read` | List users |
| `users:read.email` | Get user emails |
| `search:read` | Search messages |

**Required for write operations:**
| Scope | Purpose |
|-------|---------|
| `chat:write` | Send messages to channels and DMs |
| `reactions:write` | Add emoji reactions |

### Incident.io API Key

Create an API key at incident.io with these permissions:

| Permission | Purpose |
|------------|---------|
| Incidents: Read | List and view incidents |
| Incidents: Write | Create and update incidents |
| Follow-ups: Read | List follow-up actions |
| Follow-ups: Write | Create follow-up actions |
| Severities: Read | List severity levels |

### Humaans API Key

Create an API key at app.humaans.io with read access to:
- People
- Time off requests
- Org structure / reporting

### GitHub (External MCP)

Uses the official GitHub MCP server. Requires a GitHub Personal Access Token with:
- `repo` - Full repository access
- `read:org` - Read org membership
- `read:user` - Read user profile

### Linear (External MCP)

Uses the official Linear MCP server. Requires a Linear API key with access to:
- Issues (read/write)
- Projects (read)
- Teams (read)
- Users (read)

### Notion (External MCP)

Uses the official Notion MCP server. Requires a Notion integration token with:
- Read access to pages and databases you want to query
- Search capability enabled

## Setup

### Prerequisites

- Node.js 20+
- Claude CLI (`claude`)

### Installation

```bash
# Install dependencies
npm install

# Build MCP servers
cd mcp-servers/google && npm run build
cd ../slack && npm run build
cd ../humaans && npm run build
cd ../incident-io && npm run build
```

### Credential Setup

Each MCP server requires credentials. Claude Code resolves `${VAR_NAME}` references in `.mcp.json` from the macOS Keychain.

#### Storing Credentials in Keychain

Use the `security` command to store each credential:

```bash
security add-generic-password -a "claude" -s "CREDENTIAL_NAME" -w "your-secret-value"
```

To update an existing credential, delete it first:

```bash
security delete-generic-password -a "claude" -s "CREDENTIAL_NAME"
security add-generic-password -a "claude" -s "CREDENTIAL_NAME" -w "new-secret-value"
```

The following credentials are required (names must match exactly):

| Credential Name | Service |
|-----------------|---------|
| `GOOGLE_CLIENT_ID` | Google |
| `GOOGLE_CLIENT_SECRET` | Google |
| `GOOGLE_REFRESH_TOKEN` | Google |
| `SLACK_TOKEN` | Slack |
| `INCIDENTIO_API_KEY` | Incident.io |
| `HUMAANS_API_TOKEN` | Humaans |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub |
| `LINEAR_API_KEY` | Linear |

Follow the guides below to generate each credential.

#### Google OAuth Credentials

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable APIs**
   - Navigate to "APIs & Services" > "Library"
   - Enable: Gmail API, Google Calendar API, Google Drive API, Google Docs API, Google Sheets API, Google Slides API

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Select "Internal" (for workspace) or "External" (for personal)
   - Add the scopes listed in [Google OAuth Scopes](#google-oauth-scopes)

4. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Desktop app" as application type
   - Download the credentials JSON

5. **Generate Refresh Token**
   ```bash
   cd mcp-servers/google
   GOOGLE_CLIENT_ID="your-client-id" \
   GOOGLE_CLIENT_SECRET="your-client-secret" \
   npx tsx scripts/auth.ts
   ```
   This opens a browser for OAuth consent and outputs your refresh token.

6. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "GOOGLE_CLIENT_ID" -w "your-client-id"
   security add-generic-password -a "claude" -s "GOOGLE_CLIENT_SECRET" -w "your-client-secret"
   security add-generic-password -a "claude" -s "GOOGLE_REFRESH_TOKEN" -w "your-refresh-token"
   ```

#### Slack App Credentials

1. **Create a Slack App**
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Click "Create New App" > "From scratch"
   - Name your app and select your workspace

2. **Configure OAuth Scopes**
   - Navigate to "OAuth & Permissions"
   - Under "Scopes" > "User Token Scopes", add all scopes from [Slack App Scopes](#slack-app-scopes)
   - Note: Use **User Token Scopes**, not Bot Token Scopes

3. **Install to Workspace**
   - Click "Install to Workspace" and authorize
   - Copy the "User OAuth Token" (starts with `xoxp-`)

4. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "SLACK_TOKEN" -w "xoxp-your-token"
   ```

#### Incident.io API Key

1. **Access API Settings**
   - Go to [incident.io](https://app.incident.io) > Settings > API Keys

2. **Create API Key**
   - Click "Create API Key"
   - Name it (e.g., "Claude Assistant")
   - Select permissions:
     - Incidents: Read + Write
     - Follow-ups: Read + Write
     - Severities: Read

3. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "INCIDENTIO_API_KEY" -w "your-api-key"
   ```

#### Humaans API Key

1. **Access API Settings**
   - Go to [Humaans](https://app.humaans.io) > Settings > API Keys

2. **Create API Key**
   - Click "Generate new token"
   - The token has read access to all data by default

3. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "HUMAANS_API_TOKEN" -w "your-api-key"
   ```

#### GitHub Personal Access Token

1. **Create Token**
   - Go to GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `read:org`, `read:user`
   - Set an expiration (or no expiration for convenience)

2. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "GITHUB_PERSONAL_ACCESS_TOKEN" -w "ghp_your-token"
   ```

#### Linear API Key

1. **Create API Key**
   - Go to Linear > Settings > API > Personal API keys
   - Click "Create key"
   - The key has access based on your Linear permissions

2. **Store in Keychain**
   ```bash
   security add-generic-password -a "claude" -s "LINEAR_API_KEY" -w "lin_api_your-key"
   ```

#### Notion Integration Token

1. **Create Integration**
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Name it and select capabilities (read content, read comments)

2. **Share Pages with Integration**
   - Open each Notion page/database you want accessible
   - Click "..." > "Connections" > Add your integration

3. **Authenticate**
   - Notion uses `mcp-remote` which handles OAuth in the browser
   - On first use, you'll be prompted to authorize in your browser

### Configuration

1. **MCP Configuration**: The `.mcp.json` file configures which MCP servers are available
2. **Credentials**: Store in macOS Keychain as described above
3. **Local Settings**: `.claude/settings.local.json` controls tool permissions

## Usage

Start Claude Code in this directory:

```bash
claude
```

Then use natural conversation or invoke skills:

```
/morning-briefing
/prep-meeting Joel 1:1
/triage-inbox
```

## Output Directories

| Directory | Contents |
|-----------|----------|
| `morning-briefing/` | Daily briefings (`YYYY-MM-DD.md`) |
| `meetings/output/` | Meeting prep and notes by type (`one-on-ones/`, `squad/`, `planning/`, `external/`, `general/`) |
| `tech-notes/` | Technical documentation and deep dives |
| `context/` | Session notes, EOD summaries, weekly reviews |
| `121/` | Raw 1:1 meeting transcripts from Gemini |

## License

Private - Apolitical internal use only
