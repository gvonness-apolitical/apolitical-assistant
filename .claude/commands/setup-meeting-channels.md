# Setup Meeting Channels

Configure mappings between recurring meetings and their associated Slack channels/canvases.

## Usage

- `/setup-meeting-channels` - Interactive setup for all recurring meetings
- `/setup-meeting-channels [meeting name]` - Setup a specific meeting's mapping

## Workflow

### 1. Gather Calendar Data

Fetch the last 30 days of calendar events:
- Use `calendar_list_events` with `timeMin` set to 30 days ago
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

3. **On confirmation**:
   - Save mapping to `.claude/meeting-config.json`
   - Record channel ID, name, and current timestamp

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
   ```

4. **If creating canvas**:
   - Use `slack_create_canvas` with the 1:1 template
   - Template sections: Agenda, Action Items (Open/Completed), Notes, Decisions

5. **Save mapping** to `oneOnOnes` in config

### 4. Config File Structure

Location: `.claude/meeting-config.json`

```json
{
  "channels": {
    "Platform Retro": {
      "channelId": "C0123456789",
      "channelName": "#platform-retro",
      "lastPrepDate": null
    },
    "Squad Sync": {
      "channelId": "C9876543210",
      "channelName": "#platform-squad",
      "lastPrepDate": null
    }
  },
  "oneOnOnes": {
    "joel.patrick@apolitical.co": {
      "displayName": "Joel Patrick",
      "dmChannelId": "D0123456789",
      "canvasId": "F0123456789",
      "lastPrepDate": null
    }
  }
}
```

## 1:1 Canvas Template

Use this template when creating new canvases:

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
- Platform Retro → #platform-retro
- Squad Sync → #platform-squad
- Engineering Planning → #engineering

1:1 Mappings Configured:
- Joel Patrick → DM with canvas (F0123456789)
- Sarah Chen → DM with canvas (F9876543210)
- Mike Thompson → DM (no canvas, declined)

Configuration saved to .claude/meeting-config.json
```

## Notes

- Only configure mappings for meetings that have associated channels
- Skip all-hands, company-wide, or external meetings
- For 1:1s, both parties should have write access to shared canvases
- Re-run this skill periodically to catch new recurring meetings
- Existing mappings are preserved unless explicitly updated
