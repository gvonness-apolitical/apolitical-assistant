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

## Project Structure

```
apolitical-assistant/
├── .claude/
│   ├── CLAUDE.md              # Assistant instructions and guidelines
│   ├── commands/              # Skill definitions (13 skills)
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

### Configuration

1. **MCP Configuration**: The `.mcp.json` file configures which MCP servers are available
2. **Credentials**: Each MCP server needs its own credentials (API keys, OAuth tokens)
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
