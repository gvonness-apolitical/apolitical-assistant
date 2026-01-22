# Apolitical Engineering Leadership Assistant

A Claude Code-powered assistant for the Director of Engineering that integrates with Gmail, Slack, Google Drive/Docs, Google Calendar, GitHub, Linear, Humaans, Incident.io, and Notion.

## Overview

This assistant uses Claude Code with MCP (Model Context Protocol) servers to provide a conversational interface for engineering leadership tasks. Instead of rigid automation, it offers flexible, context-aware assistance through natural conversation.

## Features

- **Morning Briefings**: Daily summary of calendar, emails, incidents, and priorities
- **Email Triage**: Intelligent email categorisation with user confirmation
- **Meeting Prep**: Context gathering for upcoming meetings
- **Meeting Notes**: Process Gemini auto-transcripts into structured notes
- **EOD Summaries**: End-of-day review and handoff notes
- **Blocker Analysis**: Check what's blocking a person or project
- **Ad-hoc Assistance**: Document drafting, research, summarisation

## Available Skills

Use `/[skill-name]` in Claude Code to invoke workflows:

| Skill | Purpose |
|-------|---------|
| `/morning-briefing` | Generate daily briefing |
| `/triage-inbox` | Review and categorise emails |
| `/prep-meeting [meeting]` | Prepare for an upcoming meeting |
| `/meeting-notes [doc-id]` | Process Gemini notes into structured format |
| `/end-of-day` | Generate EOD summary |
| `/draft-email [message-id]` | Draft an email response |
| `/summarise [url]` | Summarise a thread, document, or conversation |
| `/whats-blocking [person/project]` | Check blockers |

## Project Structure

```
apolitical-assistant/
├── .claude/
│   ├── CLAUDE.md              # Assistant instructions
│   ├── commands/              # Skill definitions
│   └── settings.local.json    # Local MCP permissions
├── mcp-servers/
│   ├── google/                # Gmail, Calendar, Drive, Docs
│   ├── slack/                 # Slack integration
│   ├── humaans/               # HR integration
│   └── incident-io/           # Incident.io integration
├── morning-briefing/          # Daily briefing output
├── meetings/output/           # Meeting prep and notes
├── tech-notes/                # Technical documentation
├── context/                   # Session context files
└── 121/                       # 1:1 meeting archives
```

## Integrations

### Custom MCP Servers (included)
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
| Linear | Project management |
| Notion | Documentation |

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

- `morning-briefing/YYYY-MM-DD.md` - Daily briefings
- `meetings/output/[type]/YYYY-MM-DD-[name].md` - Meeting prep and notes
- `tech-notes/[topic].md` - Technical deep dives
- `context/YYYY-MM-DD-session.md` - Session context

## License

Private - Apolitical internal use only
