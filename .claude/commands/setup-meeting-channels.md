# Setup Meeting Channels

Configure mappings between recurring meetings and their associated Slack channels/canvases.

## Usage

- `/setup-meeting-channels` - Interactive setup for all recurring meetings
- `/setup-meeting-channels [meeting name]` - Setup a specific meeting's mapping
- `/setup-meeting-channels --refresh` - Detect and add new recurring meetings
- `/setup-meeting-channels --template` - Customize the default canvas template

## Workflow

### 1. Gather Calendar Data

Fetch the last 30 days of calendar events (or `settings.autoRefreshDays`):
- Use `calendar_list_events` with `timeMin` set to configured days ago
- Filter to **recurring meetings only** (skip one-off events)
- Group by unique meeting title
- Note attendee patterns for each meeting

### 2. Process Named Meetings

For each unique recurring meeting (excluding 1:1s):

1. **Fuzzy match against Slack channels**:
   - Use `slack_list_channels` to get all accessible channels
   - Match meeting title against channel names
   - Score matches by similarity (exact > contains > partial word match)

2. **Present suggestions**:
   ```
   Meeting: "Platform Retro"
   Suggested channels:
     1. #platform-retro (exact match)
     2. #platform-team (partial match)
     3. [Skip this meeting]
     4. [Enter channel manually]
   ```

3. **Configure filters** (optional):
   ```
   Configure message filters for #platform-retro? (y/N)
   - Include only messages from specific users? (comma-separated emails or skip)
   - Exclude messages from specific users? (comma-separated emails or skip)
   - Highlight keywords? [decision, blocker, urgent, TODO]
   - Exclude thread replies? (y/N)
   ```

4. **On confirmation**:
   - Save mapping to `.claude/meeting-config.json`
   - Record channel ID, name, filters, and current timestamp

### 3. Process 1:1 Meetings

For meetings with exactly 2 attendees (one being the user):

1. **Match attendee to Slack user**:
   - Use `slack_list_users` to find user by email
   - Use `slack_list_dms` to find DM channel

2. **Check for existing canvas**:
   - Use `slack_list_canvases` with the DM channel ID
   - If canvas exists, record its ID

3. **If no canvas exists**, offer to create from template:
   ```
   No canvas found for 1:1 with Joel Patrick.
   Create a shared canvas with standard 1:1 template? (Y/n)
   Use custom template? (y/N)
   ```

4. **If creating canvas**:
   - Use `slack_create_canvas` with the template
   - Use `settings.canvasTemplate` or `customTemplate` if specified
   - Template sections: Agenda, Action Items (Open/Completed), Notes, Decisions

5. **Link to Linear project** (optional):
   ```
   Link to a Linear project for auto-ticket creation? (y/N)
   Enter project name or ID:
   ```

6. **Save mapping** to `oneOnOnes` in config

### 4. Refresh Mode (`--refresh`)

When running with `--refresh`:

1. **Load existing config**
2. **Fetch recent calendar events** (last `autoRefreshDays`)
3. **Identify new recurring meetings**:
   - Meetings not already in `channels` or `oneOnOnes`
   - Must have occurred at least twice in the time window
4. **Present new meetings**:
   ```
   Found 3 new recurring meetings:
   - Engineering Planning (weekly, 8 attendees)
   - Design Review (bi-weekly, 5 attendees)
   - 1:1 with Sarah Chen (weekly)

   Configure these meetings? (Y/n)
   ```
5. **Process each new meeting** using standard workflow
6. **Preserve existing mappings** - never overwrite unless explicit

### 5. Template Customization (`--template`)

When running with `--template`:

1. **Show current template**:
   ```
   Current 1:1 canvas template:
   ─────────────────────────────
   # Agenda
   _Items to discuss this meeting_

   # Action Items
   ...
   ─────────────────────────────
   ```

2. **Offer options**:
   ```
   1. Edit template (opens in editor)
   2. Reset to default
   3. Import from existing canvas
   4. Keep current
   ```

3. **If importing from canvas**:
   - List recent canvases from 1:1 DMs
   - Copy structure from selected canvas
   - Save as new default template

4. **Save to** `settings.canvasTemplate`

## Config File Structure

Location: `.claude/meeting-config.json`

```json
{
  "settings": {
    "canvasTemplate": "# Agenda\\n_Items to discuss_\\n\\n# Action Items\\n\\n## Open\\n- [ ]\\n\\n## Completed\\n- [x]\\n\\n# Notes\\n\\n# Decisions",
    "autoRefreshDays": 30,
    "linearProject": "default-project-id"
  },
  "channels": {
    "Platform Retro": {
      "channelId": "C0123456789",
      "channelName": "#platform-retro",
      "lastPrepDate": "2026-01-15T10:00:00Z",
      "filters": {
        "includeUsers": [],
        "excludeUsers": ["bot@company.com"],
        "highlightKeywords": ["decision", "blocker", "action"],
        "excludeThreads": false
      }
    }
  },
  "oneOnOnes": {
    "joel.patrick@apolitical.co": {
      "displayName": "Joel Patrick",
      "dmChannelId": "D0123456789",
      "canvasId": "F0123456789",
      "lastPrepDate": "2026-01-22T15:30:00Z",
      "linearProject": "eng-team",
      "customTemplate": null
    }
  }
}
```

## Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `canvasTemplate` | string | (see below) | Default markdown template for new 1:1 canvases |
| `autoRefreshDays` | number | 30 | Days of calendar history to scan for recurring meetings |
| `linearProject` | string | null | Default Linear project for ticket creation |

## Channel Filter Reference

| Filter | Type | Default | Description |
|--------|------|---------|-------------|
| `includeUsers` | string[] | [] | Only show messages from these users (empty = all) |
| `excludeUsers` | string[] | [] | Hide messages from these users (e.g., bots) |
| `highlightKeywords` | string[] | [...] | Keywords to highlight in summaries |
| `excludeThreads` | boolean | false | Exclude thread replies, show only top-level messages |

## 1:1 Config Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `linearProject` | string | null | Linear project for tickets from this 1:1 |
| `customTemplate` | string | null | Override default template for this person |

## Default Canvas Template

```markdown
# Agenda
_Items to discuss this meeting_

# Action Items

## Open
- [ ]

## Completed
- [x]

# Notes
_Meeting notes and context_

# Decisions
_Decisions made and rationale_
```

## Fuzzy Matching Algorithm

When matching meeting titles to channel names:

1. **Exact match** (score: 100)
   - "Platform Retro" → #platform-retro

2. **Contains match** (score: 80)
   - "Weekly Platform Sync" → #platform-team

3. **Word overlap** (score: 60)
   - "Engineering Planning" → #engineering

4. **Threshold**: Only suggest matches with score >= 50

### Normalization

Before matching:
- Convert to lowercase
- Remove common prefixes: "weekly", "bi-weekly", "monthly", "daily"
- Remove common suffixes: "meeting", "sync", "standup", "check-in"
- Replace spaces with hyphens
- Remove special characters

## Output

After setup completes:

```
Meeting Channel Mappings Configured:
- Platform Retro → #platform-retro (with filters)
- Squad Sync → #platform-squad
- Engineering Planning → #engineering

1:1 Mappings Configured:
- Joel Patrick → DM with canvas (F0123456789) [Linear: eng-team]
- Sarah Chen → DM with canvas (F9876543210)
- Mike Thompson → DM (no canvas, declined)

Configuration saved to .claude/meeting-config.json
```

## Notes

- Only configure mappings for meetings that have associated channels
- Skip all-hands, company-wide, or external meetings
- For 1:1s, both parties should have write access to shared canvases
- Use `--refresh` periodically to catch new recurring meetings
- Existing mappings are preserved unless explicitly updated
- Filters are optional - leave empty arrays for no filtering
