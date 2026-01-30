# Sync Slack

Initialize or refresh the Slack channels cache for faster lookups.

## Usage

- `/sync-slack` - Full sync of all accessible channels
- `/sync-slack --private` - Refresh private channels only
- `/sync-slack --public` - Refresh public channels only

## Core Patterns Used

- [Error Handling](../patterns/error-handling.md) - Graceful degradation if Slack unavailable
- [Rate Limiting](../patterns/rate-limiting.md) - Batch channel listing

## What This Does

Populates `.claude/slack-channels.json` with channel IDs, names, and categories, enabling instant channel lookups without repeated API calls.

## Process

### 1. Load Existing Data

Read current `.claude/slack-channels.json` if it exists:
- Preserve manually added channel metadata
- Load category patterns for classification

### 2. Gather Channel Data

**Important:** List private and public channels separately to avoid missing private channels due to API limits.

**Public Channels** (`slack_list_channels` with `types='public_channel'`):
```json
{
  "C7T2WN5NX": {
    "name": "team-engineering",
    "purpose": "Main engineering channel",
    "isPrivate": false,
    "memberCount": 45,
    "category": "engineering"
  }
}
```

**Private Channels** (`slack_list_channels` with `types='private_channel'`):
```json
{
  "C0AAWSFT206": {
    "name": "priv-management-team",
    "purpose": "Management Team - execution & unblocks",
    "isPrivate": true,
    "memberCount": 8,
    "category": "leadership"
  }
}
```

### 3. Classify Channels

Apply category patterns from config:

```
FOR each channel:
  FOR each category in categoryPatterns:
    FOR each pattern in category:
      IF channel.name contains pattern:
        channel.category = category
        BREAK
  IF no category matched:
    channel.category = "general"
```

Category patterns (configurable in slack-channels.json):
- `engineering`: engineering, platform, data, devops, infrastructure, eng-
- `product`: product, roadmap, feature, design, ux
- `leadership`: management, leadership, exec, managers, priv-management
- `operations`: incident, oncall, alerts, support, bug
- `partnerships`: partnerships, sales, customer, commercial
- `marketing`: marketing, comms, brand, social

### 4. Build Indices

**byName** - Lowercase channel name → channel ID:
```json
{
  "team-engineering": "C7T2WN5NX",
  "priv-management-team": "C0AAWSFT206"
}
```

**byCategory** - Category → array of channel IDs:
```json
{
  "engineering": ["C7T2WN5NX", "C09ETL01M0T"],
  "leadership": ["C0AAWSFT206", "G01BDLZL8LE"],
  "product": ["C123ABC"],
  "operations": ["C456DEF"],
  "general": ["C789GHI"]
}
```

### 5. Merge with Channels Config

Cross-reference with `.claude/channels-config.json`:
- Preserve priority settings from channels-config
- Add any manually configured channels not found in API

```
FOR each channel in channels-config:
  IF channel.id in slack-channels:
    Update priority from channels-config
  ELSE:
    Add channel with config metadata
    Mark as "manually configured"
```

### 6. Write Cache

Save to `.claude/slack-channels.json` with:
- Updated `lastUpdated` timestamp
- All channel data
- Built indices

## Output

### Summary
```
Slack Channels Sync Complete
============================

Data Gathered:
- Public channels: 87
- Private channels: 23 (accessible to you)
- Total: 110

Categories:
- engineering: 15 channels
- product: 12 channels
- leadership: 5 channels
- operations: 8 channels
- partnerships: 10 channels
- marketing: 6 channels
- general: 54 channels

Merged with channels-config.json:
- Priority channels configured: 12
- All priority channels found: ✓

File saved: .claude/slack-channels.json
Last updated: 2026-01-30T10:00:00Z
```

## Using the Cache

Skills can use the cache for instant lookups:

**Get channel ID by name:**
```
channelId = slack-channels.indices.byName["team-engineering"]
// Returns: "C7T2WN5NX"
```

**Get all engineering channels:**
```
engineeringChannels = slack-channels.indices.byCategory["engineering"]
// Returns: ["C7T2WN5NX", "C09ETL01M0T", ...]
```

**Check if channel is private:**
```
channel = slack-channels.channels["C0AAWSFT206"]
isPrivate = channel.isPrivate
// Returns: true
```

## Cache Freshness

| Data | Recommended Refresh | Reason |
|------|---------------------|--------|
| Channel list | Monthly | New channels added rarely |
| Channel names | Monthly | Rarely renamed |
| Member counts | Weekly | People join/leave |

The `/orient` skill can prompt if cache is stale:
```
Slack channels cache is 45 days old. Run /sync-slack to refresh?
```

## Error Handling

### Slack Unavailable
```
✗ Slack API unavailable

Cannot refresh cache. Existing cache will be used:
- Last updated: 2026-01-15T08:00:00Z
- Data may be stale (new channels missing)

Retry later with: /sync-slack
```

### Partial Access
```
⚠️ Partial sync completed

Channels found:
✓ Public channels: 87
⚠️ Private channels: 12 (some may require invitation)

Note: You can only see private channels you're a member of.
```

## Integration with Other Skills

- `/slack-read` - Uses cache to identify channel priorities
- `/prep-meeting` - Uses cache to find meeting-related channels
- `/orient` - Uses cache to check priority channels
- `/find-context` - Uses cache for channel searches

## Notes

- Run monthly or when new channels are created
- Private channel access depends on your Slack permissions
- Cache is safe to delete - will be rebuilt on next sync
- Complements channels-config.json (which has manual priority settings)
