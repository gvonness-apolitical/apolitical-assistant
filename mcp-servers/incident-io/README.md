# Incident.io MCP Server

MCP server for Incident.io API including incidents, follow-ups, severities, and postmortems.

## Tools

### Incidents (4 tools)

| Tool | Description |
|------|-------------|
| `incidentio_list_incidents` | List incidents with optional filters |
| `incidentio_get_incident` | Get detailed incident information |
| `incidentio_create_incident` | Create a new incident |
| `incidentio_update_incident` | Update an existing incident |

### Follow-ups (2 tools)

| Tool | Description |
|------|-------------|
| `incidentio_list_followups` | List follow-up actions |
| `incidentio_create_followup` | Create a new follow-up action |

### Severities (1 tool)

| Tool | Description |
|------|-------------|
| `incidentio_list_severities` | List available severity levels |

### Postmortems (1 tool)

| Tool | Description |
|------|-------------|
| `incidentio_get_postmortem` | Get postmortem for an incident |

## Features

### Incident Management
- List active, resolved, or all incidents
- Filter by status, severity
- Create incidents with visibility, severity, summary
- Update incident status, summary, severity

### Follow-up Actions
- List follow-ups for specific incidents
- Create follow-ups with title, description, assignee
- Set priority and due dates

## Required Permissions

API key needs:
- Incidents: Read + Write
- Follow-ups: Read + Write
- Severities: Read

## Setup

1. Go to incident.io > Settings > API Keys
2. Create API Key with required permissions
3. Run `npm run credentials -- --update INCIDENTIO_API_KEY` from project root

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

```
src/
├── handlers/
│   ├── incidents.ts    # Incident CRUD operations
│   ├── followups.ts    # Follow-up operations
│   ├── severities.ts   # Severity listing
│   ├── postmortems.ts  # Postmortem retrieval
│   └── index.ts        # Handler registry
├── tools.ts            # Tool definitions
└── index.ts            # MCP server entry point
```
