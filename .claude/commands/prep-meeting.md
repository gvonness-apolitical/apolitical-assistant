# Meeting Prep

Prepare for an upcoming meeting by gathering relevant context from all systems including mapped Slack channels and canvases.

## Usage

- `/prep-meeting` - prep for next meeting on calendar
- `/prep-meeting [name]` - prep for meeting with specific person
- `/prep-meeting [meeting title]` - prep for specific meeting

## Check Daily Context First

Before making API calls, check local context files:

1. **Today's daily context**: `context/daily/YYYY-MM-DD.md`
   - Slack summaries with attendee mentions
   - Email threads with attendees
   - Action items involving attendees
2. **Session context**: `context/YYYY-MM-DD-session.md`
   - Notes about this person/meeting from earlier today
   - Salary/HR information (for 1:1s)
3. **Yesterday's EOD**: `context/eod-YYYY-MM-DD.md`
   - Follow-ups related to attendees
4. **Previous meeting prep**: `meetings/output/*/YYYY-MM-DD-*-prep.md`

Use local context to reduce API calls and provide richer context.

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
4. **Read canvas content** (if `canvasId` is configured):
   - Use `slack_get_canvas` with the configured `canvasId`
   - Parse sections: Agenda, Action Items, Notes, Decisions
   - Extract action items assigned to you (@U08EWPC9AP9 or your name)
   - Include current agenda and open action items in prep output
5. **Apply filters** (if configured):
   - Filter by `includeUsers` (if non-empty, only show these users)
   - Exclude messages from `excludeUsers` (e.g., bots)
   - If `excludeThreads` is true, skip thread replies
   - Highlight messages containing `highlightKeywords`
6. **Extract action items** using patterns:
   - `- [ ]` / `- [x]` - Markdown checkboxes
   - `☐` / `☑` - Unicode checkboxes
   - `TODO:` / `ACTION:` keywords
   - `@person will...` patterns
7. **Summarize if needed**:
   - If >50 messages, group by theme and summarize key points
   - Highlight decisions, questions, and blockers
   - **Bold messages containing highlight keywords**
8. **Include in output**:
   - Recent discussion summary (full if <20 messages)
   - Outstanding action items (unchecked)
   - Recently completed items (for reference)
   - Bookmarked resources
   - **Highlighted messages** (containing keywords)
   - **Canvas agenda and action items** (if canvas configured)
9. **Update config**: Set `lastPrepDate` to current time

### Canvas Context (1:1 Meetings with Canvas)

If this is a 1:1 with a configured canvas in `oneOnOnes`:

1. **Load mapping**: Check `oneOnOnes` in meeting config by attendee email
2. **Check attendance**:
   - Note calendar response status (accepted/declined/tentative)
   - Flag any recent reschedules
3. **Read canvas content** (if `canvasId` is configured):
   - Use `slack_get_canvas` with the configured `canvasId`
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
   - Offer to create one using the template
   - Use `settings.canvasTemplate` or `customTemplate` if set
   - If accepted, use `slack_create_canvas` and update config
8. **Update config**: Set `lastPrepDate` to current time

## Message Filtering

When a channel has filters configured:

### Include Users Filter
```json
"includeUsers": ["alice@company.com", "bob@company.com"]
```
- Only messages from these users are shown
- Empty array = show all users

### Exclude Users Filter
```json
"excludeUsers": ["slackbot@company.com", "github-bot@company.com"]
```
- Messages from these users are hidden
- Useful for filtering out noisy bots

### Highlight Keywords
```json
"highlightKeywords": ["decision", "blocker", "urgent", "TODO", "IMPORTANT"]
```
- Messages containing these keywords are highlighted in output
- Shown in a separate "Highlighted Messages" section
- Case-insensitive matching

### Exclude Threads
```json
"excludeThreads": true
```
- Only show top-level messages
- Skip all thread replies
- Useful for high-volume channels

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

2. **Determine project**:
   - Use `linearProject` from 1:1 config if set
   - Fall back to `settings.linearProject` if set
   - Otherwise, prompt for project selection

3. **Offer creation**:
   ```
   Found action item that might warrant a Linear ticket:
   "Build out the new onboarding flow for contractors"
   Create Linear ticket? (y/N)
   Project: [eng-team]
   ```

4. **If creating**:
   - Create ticket with title, description, and assignee
   - Link source (Slack message or canvas)
   - **Automatically update canvas** with ticket link:
     ```
     - [ ] Build out onboarding flow → [ENG-123](https://linear.app/...)
     ```

5. **Track created tickets**:
   - Include in meeting prep output
   - Show in "Linear Tickets Created" section

### Automatic Canvas Linking

When a Linear ticket is created from a canvas action item:

1. **Find the action item** in the canvas content
2. **Append the ticket link** to the action item line:
   ```markdown
   Before: - [ ] Build onboarding flow for contractors
   After:  - [ ] Build onboarding flow for contractors → [ENG-123](https://linear.app/team/issue/ENG-123)
   ```
3. **Use `slack_update_canvas`** to apply the change
4. **Confirm update** in output:
   ```
   ✓ Created ENG-123: Build onboarding flow for contractors
   ✓ Updated canvas with ticket link
   ```

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
- **Highlighted messages** (if keywords configured)

### Canvas Status (if canvas configured)
- Current agenda items from canvas
- Open action items (mine highlighted with @U08EWPC9AP9 or name)
- Recently completed items
- Blocked items to discuss
- **Linked Linear tickets**
- Works for both 1:1s (`oneOnOnes.canvasId`) and channel meetings (`channels.canvasId`)

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
- **Linear tickets created this session** (with links)

Save to `meetings/output/[meeting-type]/YYYY-MM-DD-[attendee-or-title]-prep.md`

Meeting types: `one-on-ones/`, `squad/`, `planning/`, `external/`, `general/`

## Notes

- For 1:1s, also check Humaans for any time off or role changes
- For engineering meetings, weight GitHub/Linear context higher
- Flag any incidents involving attendees' teams
- If meeting has no channel mapping, suggest running `/setup-meeting-channels`
- Always update `lastPrepDate` after successful prep
- Canvas updates require confirmation before writing
- Linear ticket links are automatically added to canvas action items

## Configuration File

Expects `.claude/meeting-config.json`:

```json
{
  "settings": {
    "canvasTemplate": "# Agenda\\n...",
    "autoRefreshDays": 30,
    "linearProject": "default-project"
  },
  "channels": {
    "Platform Retro": {
      "channelId": "C0123456789",
      "channelName": "#platform-retro",
      "canvasId": "F0123456789",
      "canvasName": "Agenda",
      "lastPrepDate": "2026-01-15T10:00:00Z",
      "filters": {
        "includeUsers": [],
        "excludeUsers": ["bot@company.com"],
        "highlightKeywords": ["decision", "blocker"],
        "excludeThreads": false
      }
    }
  },
  "oneOnOnes": {
    "joel.patrick@apolitical.co": {
      "displayName": "Joel Patrick",
      "dmChannelId": "D0123456789",
      "canvasId": "F0123456789",
      "canvasName": "121 Agenda Items",
      "lastPrepDate": "2026-01-22T15:30:00Z",
      "linearProject": "eng-team",
      "customTemplate": null
    }
  }
}
```

Run `/setup-meeting-channels` to configure mappings.
Run `/setup-meeting-channels --refresh` to detect new recurring meetings.
Run `/setup-meeting-channels --template` to customize the canvas template.
