# Google MCP Server

MCP server for Google Workspace APIs including Gmail, Calendar, Drive, Docs, Sheets, and Slides.

## Tools

### Gmail (9 tools)

| Tool | Description |
|------|-------------|
| `gmail_search` | Search Gmail messages using Gmail query syntax |
| `gmail_get_message` | Get full content of a specific message |
| `gmail_list_labels` | List all Gmail labels/folders |
| `gmail_get_attachments` | Get attachment metadata for a message |
| `gmail_send_message` | Send an email message |
| `gmail_create_draft` | Create a draft email |
| `gmail_trash` | Move messages to trash |
| `gmail_delete` | Permanently delete messages |
| `gmail_archive` | Archive messages (remove from inbox) |

### Calendar (6 tools)

| Tool | Description |
|------|-------------|
| `calendar_list_events` | List events from a calendar |
| `calendar_get_event` | Get details of a specific event |
| `calendar_list_calendars` | List available calendars |
| `calendar_get_freebusy` | Check availability for attendees |
| `calendar_create_event` | Create a new calendar event |
| `calendar_update_event` | Update an existing event |

### Drive (2 tools)

| Tool | Description |
|------|-------------|
| `drive_search` | Search files in Google Drive |
| `drive_get_file` | Get file metadata and content |

### Docs (3 tools)

| Tool | Description |
|------|-------------|
| `docs_get_content` | Get document content as text |
| `docs_get_comments` | Get comments from a document |
| `docs_create` | Create a new Google Doc |

### Sheets (2 tools)

| Tool | Description |
|------|-------------|
| `sheets_get_values` | Get cell values from a spreadsheet |
| `sheets_get_metadata` | Get spreadsheet metadata |

### Slides (1 tool)

| Tool | Description |
|------|-------------|
| `slides_get_presentation` | Get presentation content |

## Required OAuth Scopes

### Read-only
- `gmail.readonly`
- `calendar.readonly`
- `drive.readonly`
- `documents.readonly`
- `spreadsheets.readonly`
- `presentations.readonly`

### Write operations
- `gmail.send` - Send emails
- `gmail.compose` - Create drafts
- `gmail.modify` - Trash/delete/archive
- `calendar.events` - Create/update events
- `calendar.freebusy` - Check availability

## Setup

1. Create a Google Cloud Project
2. Enable required APIs (Gmail, Calendar, Drive, Docs, Sheets, Slides)
3. Create OAuth 2.0 credentials (Desktop app)
4. Run `npm run credentials -- --setup` from the project root to configure

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

```
src/
├── auth.ts              # OAuth authentication
├── handlers/
│   ├── gmail.ts         # Re-exports from split modules
│   ├── gmail-read.ts    # Search, get, list, attachments
│   ├── gmail-write.ts   # Send, draft
│   ├── gmail-manage.ts  # Trash, delete, archive
│   ├── calendar.ts      # Calendar operations
│   ├── drive.ts         # Drive operations
│   ├── docs.ts          # Docs operations
│   ├── sheets.ts        # Sheets operations
│   ├── slides.ts        # Slides operations
│   └── index.ts         # Handler registry
├── utils/
│   ├── email-builder.ts # RFC2822 email construction
│   └── batch-operation.ts # Batch API operations
└── tools.ts             # Tool definitions
```
