# Slack MCP Server

MCP server for Slack API including channels, messages, users, DMs, canvases, and bookmarks.

## Tools

### Channels (3 tools)

| Tool | Description |
|------|-------------|
| `slack_list_channels` | List all accessible channels |
| `slack_read_channel` | Read messages from a channel |
| `slack_get_channel_info` | Get channel metadata |

### Messages (3 tools)

| Tool | Description |
|------|-------------|
| `slack_read_thread` | Read thread replies |
| `slack_send_message` | Send a message to a channel |
| `slack_add_reaction` | Add emoji reaction to a message |

### Users (2 tools)

| Tool | Description |
|------|-------------|
| `slack_list_users` | List workspace users |
| `slack_get_user` | Get user profile details |

### Direct Messages (3 tools)

| Tool | Description |
|------|-------------|
| `slack_list_dms` | List DM conversations |
| `slack_read_dm` | Read DM messages with a user |
| `slack_send_dm` | Send a direct message to a user |

### Search (1 tool)

| Tool | Description |
|------|-------------|
| `slack_search` | Search messages across Slack |

### Canvases (5 tools)

| Tool | Description |
|------|-------------|
| `slack_get_canvas` | Read canvas content |
| `slack_update_canvas` | Update canvas content |
| `slack_create_canvas` | Create a new canvas |
| `slack_list_canvases` | List canvases in a channel/DM |
| `slack_delete_canvas` | Delete a canvas |

### Bookmarks (1 tool)

| Tool | Description |
|------|-------------|
| `slack_get_bookmarks` | Get channel bookmarks |

## Required Slack Scopes

### Read operations
- `channels:read`, `groups:read`, `im:read`, `mpim:read` - List channels
- `channels:history`, `groups:history`, `im:history`, `mpim:history` - Read messages
- `users:read`, `users:read.email` - User information
- `search:read` - Search messages

### Write operations
- `chat:write` - Send messages
- `reactions:write` - Add reactions
- `im:write` - Open DM conversations

### Canvas and bookmark operations
- `files:read` - Read canvas content (via files.info)
- `canvases:write` - Create, update, delete canvases
- `bookmarks:read` - Read channel bookmarks

## Canvas Reading Strategy

Despite the `canvases:read` scope existing, there is no public API to read canvas content directly. This server uses a workaround:

1. Call `files.info` with the canvas ID (canvases are stored as files)
2. Get `url_private_download` from the response
3. Fetch content with Authorization header

This requires only `files:read` scope, not `canvases:read`.

## Setup

1. Create a Slack App at api.slack.com
2. Add User Token Scopes (not Bot scopes)
3. Install to workspace
4. Copy User OAuth Token (xoxp-...)
5. Run `npm run credentials -- --update SLACK_TOKEN` from project root

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
│   ├── channels.ts    # Channel operations
│   ├── messages.ts    # Message operations
│   ├── users.ts       # User operations
│   ├── dms.ts         # Direct message operations
│   ├── search.ts      # Search operations
│   ├── canvases.ts    # Canvas operations
│   ├── bookmarks.ts   # Bookmark operations
│   ├── api.ts         # Slack API helpers
│   └── index.ts       # Handler registry
└── tools.ts           # Tool definitions
```
