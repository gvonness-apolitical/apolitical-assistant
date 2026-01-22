# Apolitical Engineering Leadership Assistant

A Claude-powered assistant for the Director of Engineering that integrates with Gmail, Slack, Google Drive/Docs, Google Calendar, GitHub, Linear, Humaans, Incident.io, and Notion.

## Features

- **Morning Briefings**: Daily summary of calendar, emails, incidents, and priorities
- **Email Triage**: Intelligent email cleanup with user confirmation
- **Meeting Prep**: Context gathering for upcoming meetings
- **EOD Summaries**: End-of-day review and tomorrow preview
- **TODO Management**: Multi-source task collection, priority tracking, and deadline notifications
- **Task Helper**: Contextual assistance for TODOs with smart mode selection, response drafting, and MCP integration
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
│   ├── shared/           # Shared utilities (keychain, notifications, todo-utils)
│   └── context-store/    # SQLite persistence layer
├── mcp-servers/
│   ├── google/           # Gmail, Calendar, Drive, Docs, Sheets, Slides
│   ├── slack/            # Slack search, channels, DMs
│   ├── humaans/          # Humaans HR integration
│   └── incident-io/      # Incident.io integration
├── scripts/
│   ├── setup/            # Installation and configuration
│   └── workflows/        # Automated workflow scripts
│       ├── collectors/   # TODO source collectors
│       └── task-helper/  # Contextual task assistance system
├── launchd/              # macOS launch agent configs
├── context/              # Encrypted user data (git-crypt)
├── todos/                # TODO config and archives (git-crypt encrypted)
│   ├── config.json       # TODO system configuration
│   ├── cache/            # Collector cache (last fetch timestamps)
│   └── archive/          # Monthly archive files
├── task-helper/          # Task helper configuration
│   └── config.json       # Task helper settings
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

### 2. Configure Credentials and Paths

Run the interactive setup wizard to store credentials in macOS Keychain and configure paths:

```bash
npm run setup
```

The setup wizard provides options to:
1. Set up all credentials at once
2. Configure individual credentials
3. Test credential access
4. Configure paths (e.g., dev-analytics reports directory)

**Dev Analytics Reports Path**: If you use the dev-analytics collector for delivery metrics, you'll need to configure the path to your reports directory. This can be done via the setup wizard (option 4) or by editing `data/config/todos/config.json`:

```json
{
  "collectors": {
    "devAnalytics": {
      "reportsPath": "/path/to/your/delivery-reports"
    }
  }
}
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

# TODO Management (see TODO Management section below for details)
npm run todos                 # Display active TODOs
npm run todos:collect         # Collect TODOs from all sources
npm run todos:interactive     # Interactive TODO manager

# Task Helper (see Task Helper section below for details)
npm run task:help             # Interactive task assistance
npm run task:help:list        # List available TODOs for help
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

# Export credentials from Keychain (required before first use in each terminal session)
source scripts/setup/export-credentials.sh

# Start Claude with MCP integrations
claude

# Example queries:
# "Prepare me for my 2pm meeting"
# "Summarize my unread emails"
# "Who's out of office this week?"
# "Show active incidents"
# "What are my top priorities today?"
```

**Tip:** Add `source /path/to/apolitical-assistant/scripts/setup/export-credentials.sh` to your shell profile (`.zshrc` or `.bashrc`) to auto-export credentials.

---

## TODO Management

A comprehensive system for collecting, tracking, and managing TODOs from multiple sources with automatic priority calculation, deduplication, and deadline notifications.

### Features

- **Multi-source collection**: Automatically gathers TODOs from GitHub, Linear, Gmail, Slack, Google Docs, Notion, Humaans, and Google Meet transcripts
- **Smart priority**: Auto-boosts priority as deadlines approach (overdue items become P1)
- **Deduplication**: Detects duplicate TODOs across sources using fingerprints and fuzzy matching
- **Snooze/defer**: Temporarily hide TODOs until a specific date
- **Stale detection**: Flags TODOs that haven't been updated in 14+ days
- **Morning briefing integration**: Automatically includes priority TODOs in daily briefings
- **Archive system**: Completed TODOs are archived to monthly JSON files after 2 weeks
- **Encrypted storage**: All TODO data is encrypted via git-crypt

### Quick Start

```bash
# Collect TODOs from all enabled sources
npm run todos:collect

# View your active TODOs (sorted by priority)
npm run todos

# Launch interactive manager
npm run todos:interactive
```

### Commands Reference

| Command | Description |
|---------|-------------|
| `npm run todos` | Display active TODOs grouped by priority |
| `npm run todos:all` | Include completed TODOs in display |
| `npm run todos:json` | Output TODOs as JSON (for scripting) |
| `npm run todos:collect` | Collect from all enabled sources |
| `npm run todos:collect:verbose` | Collect with detailed progress output |
| `npm run todos:complete <id>` | Mark a TODO as complete |
| `npm run todos:snooze <id> --days 3` | Snooze for N days |
| `npm run todos:snooze <id> --until 2026-02-01` | Snooze until specific date |
| `npm run todos:snooze <id> --unsnooze` | Remove snooze from a TODO |
| `npm run todos:archive` | Archive completed TODOs older than 2 weeks |
| `npm run todos:interactive` | Interactive terminal UI |
| `npm run todos:weekly` | Generate weekly summary report |
| `npm run todos:notify` | Send macOS notifications for due items |

### Display Output

TODOs are displayed with priority indicators and status:

```
=== Active TODOs (12 items) ===

🔴 HIGH PRIORITY
  ⚠️ 🔴 [P1] Review Q4 OKRs
     ID: abc12345 | [email] | Deadline: yesterday
     Link: https://mail.google.com/...

  ⭕ 🔴 [P1] Approve time off request
     ID: def67890 | [humaans] | Due: today
     Link: https://app.humaans.io/...

🟡 MEDIUM PRIORITY
  ⭕ 🟡 [P2] Review PR #123
     ID: ghi11111 | [github] | Due: tomorrow
     Link: https://github.com/org/repo/pull/123

💤 SNOOZED
  💤 ⚪ [P5] Update documentation
     ID: jkl22222 | [notion] | Snoozed until Jan 28
     Link: https://notion.so/...
```

**Priority Indicators:**
- 🔴 P1 - Critical/Overdue
- 🟠 P2 - High priority
- 🟡 P3 - Medium priority
- 🟢 P4 - Low priority
- ⚪ P5 - Lowest/Snoozed

**Status Indicators:**
- ⚠️ Overdue
- 💤 Snoozed
- 🔄 In progress
- ⭕ Pending
- ✅ Completed

### Sources & Collectors

The system includes collectors for the following sources:

| Source | What It Collects | Configuration |
|--------|------------------|---------------|
| **GitHub** | PR review requests, assigned issues | `collectors.github.enabled` |
| **Linear** | Assigned tickets not in "Done" state | `collectors.linear.enabled` |
| **Gmail** | Starred emails, action-required subjects, Applied notifications | `collectors.email.enabled`, `collectors.email.patterns` |
| **Slack** | Messages with action items, saved items | `collectors.slack.enabled` |
| **Google Docs** | `@TODO`, `ACTION:`, and unchecked `[ ]` patterns | `collectors.googleDocs.enabled`, `collectors.googleDocs.docIds` |
| **Notion** | Pages tagged with TODO, unchecked items | `collectors.notion.enabled` |
| **Humaans** | Pending time-off approval requests | `collectors.humaans.enabled` |
| **Gemini Notes** | Action items from Google Meet transcripts | `collectors.geminiNotes.enabled` |

### Priority Calculation

Priority is automatically calculated based on:

1. **Base priority** (default P3)
2. **Deadline proximity**:
   - Overdue: +3 priority boost (becomes P1)
   - Due tomorrow: +2 boost
   - Due within 3 days: +1 boost
   - Due within 7 days (hard deadlines): +0.5 boost
3. **Urgency level**: High urgency (1-2) adds additional boost
4. **Snooze status**: Snoozed items drop to P5

Example: A P3 TODO due tomorrow becomes P1.

### Interactive Mode

The interactive mode (`npm run todos:interactive`) provides a terminal UI:

```
=== Interactive TODO Manager ===

  1. ⚠️ 🔴 Review Q4 OKRs (OVERDUE)
  2. ⭕ 🔴 Approve time off request (Due: Today)
  3. ⭕ 🟡 Review PR #123
  4. ⭕ 🟢 Update team profiles

Select TODO (1-4), or:
  [c]ollect new TODOs
  [a]rchive completed
  [r]efresh
  [q]uit

> 1

Selected: Review Q4 OKRs

  [c]omplete    [s]nooze    [o]pen link    [d]elete    [b]ack

> c
✅ Marked complete: Review Q4 OKRs
```

### Snooze Options

When snoozing in interactive mode:

- `[1]` - Snooze for 1 day
- `[3]` - Snooze for 3 days
- `[7]` - Snooze for 1 week
- `[m]` - Snooze until next Monday
- `[d]` - Enter custom date (YYYY-MM-DD)

Or via command line:

```bash
# Snooze for 3 days
npm run todos:snooze abc123 --days 3

# Snooze until specific date
npm run todos:snooze abc123 --until 2026-02-15

# Remove snooze
npm run todos:snooze abc123 --unsnooze
```

### Configuration

Edit `todos/config.json` to customize behavior:

```json
{
  "archiveAfterDays": 14,
  "retentionMonths": 12,
  "staleDays": 14,
  "notifications": {
    "dayBefore": true,
    "dayOf": true,
    "overdue": true
  },
  "deduplication": {
    "enabled": true,
    "fuzzyThreshold": 0.85
  },
  "collectors": {
    "github": { "enabled": true, "reviewRequestsOnly": true },
    "linear": { "enabled": true, "assignedOnly": true },
    "email": {
      "enabled": true,
      "patterns": ["action required", "please review", "follow up"]
    },
    "slack": { "enabled": true, "channels": [] },
    "googleDocs": { "enabled": true, "docIds": [] },
    "notion": { "enabled": true },
    "humaans": { "enabled": true },
    "geminiNotes": { "enabled": true }
  }
}
```

**Configuration Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `archiveAfterDays` | Days after completion before archiving | 14 |
| `retentionMonths` | How long to keep archives | 12 |
| `staleDays` | Days without update before flagging as stale | 14 |
| `notifications.dayBefore` | Notify day before deadline | true |
| `notifications.dayOf` | Notify on deadline day | true |
| `notifications.overdue` | Notify when overdue | true |
| `deduplication.enabled` | Enable duplicate detection | true |
| `deduplication.fuzzyThreshold` | Similarity threshold (0-1) | 0.85 |

### Scheduled Notifications

To receive macOS notifications for approaching deadlines, add to crontab:

```bash
# Edit crontab
crontab -e

# Add daily notification check at 9am
0 9 * * * cd /path/to/apolitical-assistant && npm run todos:notify --quiet
```

Or create a launchd agent for more reliable scheduling:

```xml
<!-- ~/Library/LaunchAgents/com.apolitical.todos-notify.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.apolitical.todos-notify</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>run</string>
        <string>todos:notify</string>
        <string>--</string>
        <string>--quiet</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/apolitical-assistant</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

Load the agent:

```bash
launchctl load ~/Library/LaunchAgents/com.apolitical.todos-notify.plist
```

### Weekly Summary

Generate a weekly report of TODO activity:

```bash
# Display in terminal
npm run todos:weekly

# Save to file
npm run todos:weekly -- --output weekly-report.md
```

The report includes:
- Completed TODOs this week
- Statistics (completed, new, carried over)
- Overdue items
- Stale items needing attention
- Breakdown by source

### Archive System

Completed TODOs are automatically archived after `archiveAfterDays` (default 14):

```bash
# Archive completed TODOs older than configured threshold
npm run todos:archive

# Archive with custom threshold
npm run todos:archive -- --days 7
```

Archives are stored as monthly JSON files in `todos/archive/`:
- `todos/archive/2026-01.json`
- `todos/archive/2026-02.json`

### Morning Briefing Integration

The TODO system automatically integrates with morning briefings. The briefing includes:

- **Overdue TODOs** - Highlighted prominently
- **Due today** - Items needing attention today
- **High priority** - P1 and P2 items
- **Stale TODOs** - Items that may need review

No additional configuration needed - TODOs appear automatically when you run `npm run morning-briefing`.

---

## Task Helper

A contextual task assistance system that provides intelligent help for TODOs based on their source and type. The helper gathers relevant context, provides insights, drafts responses, and where possible, applies changes directly via MCP integrations.

### Features

- **Smart mode auto-selection**: Automatically chooses the best helper mode based on TODO source
- **Multi-source context gathering**: Pulls relevant context from GitHub, Linear, Email, Slack, Notion, Calendar, and Incidents
- **Context caching**: Avoids redundant API calls with intelligent TTL-based caching
- **Multiple output options**: MCP write (direct posting), clipboard, file, or display
- **Source-specific prompts**: Tailored prompt templates for quality responses

### Quick Start

```bash
# Interactive mode - select a TODO and get help
npm run task:help

# List available TODOs
npm run task:help:list

# Help with a specific TODO
npm run task:help -- --id=<todo_id> --mode=respond
```

### Commands Reference

| Command | Description |
|---------|-------------|
| `npm run task:help` | Interactive task assistance |
| `npm run task:help:list` | List available TODOs |
| `npm run task:help -- --id=X` | Help with specific TODO |
| `npm run task:help -- --id=X --mode=respond` | Draft a response |
| `npm run task:help -- --id=X --mode=review` | Provide review feedback |
| `npm run task:help -- --id=X --mode=summarize` | Summarize context |
| `npm run task:help -- --id=X --mode=schedule` | Help with scheduling |
| `npm run task:help -- --id=X --mode=complete` | Help complete the TODO |
| `npm run task:help -- --id=X --output=clipboard` | Copy output to clipboard |
| `npm run task:help -- --source=github` | Filter by source |
| `npm run task:help -- --refresh` | Force refresh cached context |

### Helper Modes

| Mode | Description | Best For |
|------|-------------|----------|
| `respond` | Draft a response (email reply, PR comment, etc.) | Email, Slack, GitHub issues |
| `review` | Provide review points and feedback | GitHub PRs, documents, proposals |
| `summarize` | Summarize context and provide insights | Notion pages, incidents, complex threads |
| `schedule` | Help schedule or prepare for meetings | Calendar items, meeting requests |
| `complete` | Help complete or close the TODO | Linear tasks, action items |

### Smart Mode Selection

The helper automatically suggests the best mode based on TODO source:

| Source | Default Mode | Reasoning |
|--------|--------------|-----------|
| GitHub PR | `review` | PRs typically need review feedback |
| GitHub Issue | `respond` | Issues need response/comment |
| Linear | `respond` | Tasks often need status updates |
| Email | `respond` | Emails need replies |
| Slack | `respond` | Messages need replies |
| Notion | `summarize` | Pages often need summary/insights |
| Meeting/Calendar | `schedule` | Meetings involve scheduling |
| Incident | `summarize` | Incidents need status summary |

### Context Depth

Control how much context is gathered:

| Depth | What's Included |
|-------|-----------------|
| `minimal` | Just the TODO source details |
| `standard` | + thread/comments + related items + people context |
| `comprehensive` | + cross-source search + business context + wider context |

```bash
# Use comprehensive context for thorough analysis
npm run task:help -- --id=X --depth=comprehensive
```

### Output Types

| Output | Description | When to Use |
|--------|-------------|-------------|
| `mcp` | Post directly via MCP (GitHub, Linear, Notion) | When you want to post immediately |
| `clipboard` | Copy to clipboard | For email, Slack, or manual posting |
| `file` | Save to file | For archiving or sharing |
| `display` | Show in terminal | For review before taking action |

### Configuration

Edit `task-helper/config.json` to customize:

```json
{
  "defaults": {
    "mode": "respond",
    "outputType": "display",
    "depth": "standard",
    "options": {
      "includeThread": true,
      "includeRelated": true,
      "includePeople": true,
      "includeCalendar": false,
      "maxThreadMessages": 20,
      "maxRelatedItems": 10
    }
  },
  "sourceDefaults": {
    "github": { "preferredMode": "review", "preferredOutput": "mcp" },
    "linear": { "preferredMode": "respond", "preferredOutput": "mcp" },
    "email": { "preferredMode": "respond", "preferredOutput": "clipboard" },
    "slack": { "preferredMode": "respond", "preferredOutput": "clipboard" }
  },
  "cache": {
    "enabled": true
  },
  "prompts": {
    "tone": "professional",
    "includeSignature": false
  }
}
```

### MCP Write Support

The task helper can post directly to supported platforms:

| Source | MCP Write Support | Actions |
|--------|-------------------|---------|
| GitHub | ✅ Yes | Post comments, create reviews |
| Linear | ✅ Yes | Post comments, update issues |
| Notion | ✅ Yes | Add comments to pages |
| Email | ❌ No (clipboard) | Copy for manual sending |
| Slack | ❌ No (clipboard) | Copy for manual posting |

### Examples

```bash
# Review a GitHub PR
npm run task:help -- --id=abc123 --mode=review --output=mcp

# Draft an email reply and copy to clipboard
npm run task:help -- --id=def456 --mode=respond --output=clipboard

# Summarize an incident with full context
npm run task:help -- --id=ghi789 --mode=summarize --depth=comprehensive

# Help complete a Linear task
npm run task:help -- --id=jkl012 --mode=complete

# Get help with all GitHub TODOs
npm run task:help -- --source=github
```

---

## Backfill

The backfill system populates historical data from collectors. This is useful for establishing baseline context before running summaries or when you need to catch up on missed collection periods.

### Quick Start

```bash
# Backfill from a specific date to today
npm run backfill -- --from=2024-10-01

# Check what would be collected (dry run)
npm run backfill -- --from=2024-10-01 --dry-run
```

### Commands Reference

| Command | Description |
|---------|-------------|
| `npm run backfill -- --from=DATE` | Backfill from DATE to today |
| `npm run backfill -- --from=DATE --to=DATE` | Backfill a specific date range |
| `npm run backfill -- --from=DATE --source=SOURCE` | Backfill only a specific source |
| `npm run backfill -- --status` | Show backfill status and progress |
| `npm run backfill -- --resume` | Resume a previously interrupted backfill |
| `npm run backfill -- --reset` | Reset backfill state and start fresh |

### Options

| Option | Description |
|--------|-------------|
| `--from` | Start date (YYYY-MM-DD format, required) |
| `--to` | End date (YYYY-MM-DD format, defaults to today) |
| `--source` | Specific source to backfill (e.g., `slack`, `github`, `linear`) |
| `--dry-run` | Show what would be collected without making changes |
| `--force` | Force re-collection even if cache exists |
| `--verbose` | Show detailed progress output |
| `--resume` | Continue from where a previous backfill stopped |
| `--status` | Display current backfill status |
| `--reset` | Clear backfill state and start fresh |

### Examples

```bash
# Backfill last quarter
npm run backfill -- --from=2024-10-01 --to=2024-12-31

# Backfill only Slack messages
npm run backfill -- --from=2024-10-01 --source=slack

# Verbose mode for debugging
npm run backfill -- --from=2024-10-01 --verbose

# Check status of ongoing backfill
npm run backfill -- --status

# Resume after interruption
npm run backfill -- --resume
```

### Recommended Workflow

Before generating summaries, ensure you have sufficient historical context:

1. **Run initial backfill** - Populate at least 30 days of historical data
   ```bash
   npm run backfill -- --from=$(date -v-30d +%Y-%m-%d)
   ```

2. **Verify collection** - Check that data was collected
   ```bash
   npm run backfill -- --status
   ```

3. **Generate summaries** - Now you can generate meaningful summaries
   ```bash
   npm run summary:daily
   ```

---

## Configuration

### User Preferences

Edit `context/preferences.json` to customize:
- Working hours
- Notification settings
- Integration-specific options
- Briefing preferences

### MCP Server Configuration

Edit `.claude/settings.local.json` to modify MCP server settings.

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
