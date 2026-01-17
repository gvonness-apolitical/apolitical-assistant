# Apolitical Engineering Leadership Assistant

A Claude-powered assistant for the Director of Engineering that integrates with Gmail, Slack, Google Drive/Docs, Google Calendar, GitHub, Linear, Humaans, Incident.io, Notion, and Lattice.

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
│   ├── humaans/          # Humaans HR integration
│   ├── incident-io/      # Incident.io integration
│   └── lattice/          # Lattice performance integration
├── scripts/
│   ├── setup/            # Installation and configuration
│   └── workflows/        # Automated workflow scripts
├── launchd/              # macOS launch agent configs
├── context/              # Encrypted user data (git-crypt)
└── output/               # Generated briefings
```

## Integrations

### External MCP Servers (pre-built)
| Service | Purpose |
|---------|---------|
| Google Workspace | Gmail, Calendar, Drive, Docs |
| GitHub | Repos, PRs, Issues |
| Linear | Project management |
| Slack | Team communication |
| Notion | Documentation |

### Custom MCP Servers (included)
| Service | Purpose |
|---------|---------|
| Humaans | HR, org chart, time off |
| Incident.io | Incidents and follow-ups |
| Lattice | Reviews, goals, 1:1s |

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

Run the interactive setup wizard:

```bash
npm run setup
```

This will guide you through adding credentials to macOS Keychain:
- Google OAuth credentials
- Slack bot token
- GitHub personal access token
- Linear API key
- Humaans API token
- Incident.io API key
- Lattice API key
- Notion integration token

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

## Security

- All credentials stored in macOS Keychain
- Personal data encrypted with git-crypt
- No credentials in code or config files
- MCP servers run locally

## License

Private - Apolitical internal use only.
