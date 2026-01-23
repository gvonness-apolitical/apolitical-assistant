# Meeting Prep

Prepare for an upcoming meeting by gathering relevant context from all systems including mapped Slack channels and canvases.

## Usage

- `/prep-meeting` - prep for next meeting on calendar
- `/prep-meeting [name]` - prep for meeting with specific person
- `/prep-meeting [meeting title]` - prep for specific meeting

## Gather Context

### Standard Context (All Meetings)

1. **Calendar**: Get meeting details (time, attendees, description, linked docs)
2. **Recent Slack**: Search for conversations with attendees (last 2 weeks)
3. **Linear**: Check for shared tickets or projects with attendees
4. **GitHub**: Recent PRs authored or reviewed by attendees (if engineering)
5. **Previous meetings**: Search for prior meeting notes in `meetings/output/`
6. **Notion**: Search for relevant docs or RFCs involving attendees

### Channel Context (Named Meetings with Mapping)

If the meeting has a configured channel in `.claude/meeting-config.json`:

1. **Load mapping**: Read `.claude/meeting-config.json` and find channel config
2. **Determine time window**:
   - If `lastPrepDate` exists, use messages since that date
   - Otherwise, find last occurrence of this meeting in calendar
   - Fallback: last 30 days
3. **Gather channel content**:
   - Use `slack_read_channel` for recent messages (up to 100)
   - Use `slack_get_bookmarks` for pinned resources
4. **Extract action items** using patterns:
   - `- [ ]` / `- [x]` - Markdown checkboxes
   - `☐` / `☑` - Unicode checkboxes
   - `TODO:` / `ACTION:` keywords
   - `@person will...` patterns
5. **Summarize if needed**:
   - If >50 messages, group by theme and summarize key points
   - Highlight decisions, questions, and blockers
6. **Include in output**:
   - Recent discussion summary (full if <20 messages)
   - Outstanding action items (unchecked)
   - Recently completed items (for reference)
   - Bookmarked resources
7. **Update config**: Set `lastPrepDate` to current time

### Canvas Context (1:1 Meetings with Canvas)

If this is a 1:1 with a configured canvas in `oneOnOnes`:

1. **Load mapping**: Check `oneOnOnes` in meeting config by attendee email
2. **Check attendance**:
   - Note calendar response status (accepted/declined/tentative)
   - Flag any recent reschedules
3. **Read canvas content**:
   - Use `slack_get_canvas` with the canvas ID
   - Parse sections: Agenda, Action Items (Open/Completed), Notes, Decisions
4. **Extract my items**:
   - Find action items assigned to me or tagged with my name
   - Categorize as: open, completed, blocked
5. **Interactive prompts**:
   - Show current agenda items from canvas
   - Ask: "Any new agenda items to add?"
   - Show my open tasks from previous meetings
   - Ask: "Any of these tasks completed?"
   - For significant action items, offer to create Linear tickets
6. **Update canvas**:
   - Add new agenda items to Agenda section
   - Mark completed tasks (move to Completed section or strikethrough)
7. **If no canvas configured**:
   - Offer to create one using the 1:1 template
   - If accepted, use `slack_create_canvas` and update config
8. **Update config**: Set `lastPrepDate` to current time

## Action Item Patterns

When extracting action items from messages or canvas content:

```
Unchecked patterns:
- [ ] Task description
☐ Task description
TODO: Task description
ACTION: Task description
@person will do something

Checked patterns:
- [x] Task description
☑ Task description
DONE: Task description
```

## Linear Integration

For significant action items discovered:

1. **Detect ticket-worthy items**:
   - Multi-step work mentioned
   - Assigned to specific person
   - Has deadline or urgency
   - Relates to existing project

2. **Offer creation**:
   ```
   Found action item that might warrant a Linear ticket:
   "Build out the new onboarding flow for contractors"
   Create Linear ticket? (y/N)
   ```

3. **If creating**:
   - Create with title, description, and assignee
   - Link source (Slack message or canvas)
   - Add ticket link back to canvas if applicable

## Output

Create a meeting prep note with:

### Context
- What's this meeting about
- Who's attending and their roles
- Any relevant background

### Channel Activity (if mapped)
- Summary of discussions since last meeting
- Key decisions made
- Questions raised
- Bookmarked resources

### Canvas Status (if 1:1 with canvas)
- Current agenda items
- Open action items (mine highlighted)
- Recently completed items
- Blocked items to discuss

### Recent Activity
- What we've been discussing/working on together
- Any decisions or changes since last meeting

### Talking Points
- Suggested topics based on open items
- Questions to ask or clarify
- Blocked items needing discussion

### Action Items
- Outstanding items to follow up on
- Decisions needed
- New Linear tickets created (if any)

Save to `meetings/output/[meeting-type]/YYYY-MM-DD-[attendee-or-title]-prep.md`

Meeting types: `one-on-ones/`, `squad/`, `planning/`, `external/`, `general/`

## Notes

- For 1:1s, also check Humaans for any time off or role changes
- For engineering meetings, weight GitHub/Linear context higher
- Flag any incidents involving attendees' teams
- If meeting has no channel mapping, suggest running `/setup-meeting-channels`
- Always update `lastPrepDate` after successful prep
- Canvas updates require confirmation before writing

## Configuration File

Expects `.claude/meeting-config.json`:

```json
{
  "channels": {
    "Platform Retro": {
      "channelId": "C0123456789",
      "channelName": "#platform-retro",
      "lastPrepDate": "2026-01-15T10:00:00Z"
    }
  },
  "oneOnOnes": {
    "joel.patrick@apolitical.co": {
      "displayName": "Joel Patrick",
      "dmChannelId": "D0123456789",
      "canvasId": "F0123456789",
      "lastPrepDate": "2026-01-22T15:30:00Z"
    }
  }
}
```

Run `/setup-meeting-channels` to configure mappings.
