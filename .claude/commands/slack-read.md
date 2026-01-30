# Slack Read

Process all unread Slack messages, summarize activity, create tasks for requests, and mark as read.

## Usage

- `/slack-read` - Process all unread messages (last 30 days)
- `/slack-read --quick` - Summary only, no task creation
- `/slack-read --dry-run` - Preview what would be processed without marking read

## Purpose

Kill the Slack notification count while ensuring nothing important is missed:
- Summarize what's happened
- Surface requests/questions directed at you
- Create tasks for action items
- Mark everything as read (with confirmation)

## Your Identity

Load your Slack user ID from `.claude/people.json`:

```
me.slackUserId → "U08EWPC9AP9"
```

Use this ID for:
- Detecting @mentions in messages (`<@U08EWPC9AP9>`)
- Identifying replies to your messages
- Checking thread participation

## Process

### 1. Gather Unread Messages

Collect unread messages from all sources (last 30 days max):

**DMs:**
- Use `slack_list_dms` to get DM channel list
- For each DM, use `slack_read_dm` to get recent messages
- Track which have unread messages

**Public & Private Channels:**
- **Important:** List private channels separately using `slack_list_channels` with `types='private_channel'` to ensure they're included (default 100-channel limit can exclude them when mixed with public)
- Load priority channels from `.claude/channels-config.json` for high-priority private channels
- For each channel, check for unread messages
- Collect messages since last read marker

**Threads:**
- Identify threads where user is tagged
- Fetch full thread context with `slack_read_thread`
- Flag as "replied" or "not replied" based on user's participation

### 2. Categorize & Filter

**Bot Messages (count only):**
Identify and count messages from:
- GitHub notifications
- Linear notifications
- Calendar/scheduling bots
- CI/CD notifications
- Any user with `is_bot: true`

Output: "47 bot notifications (GitHub: 23, Linear: 15, Calendar: 9) - will be marked read"

**Priority Tiers:**

| Priority | Source | Handling |
|----------|--------|----------|
| P0 - Critical | DMs | Always surface, full detail |
| P1 - High | @mentions in any channel | Surface with context |
| P2 - Medium | High-priority channels (no @mention) | Summarize activity |
| P3 - Low | Other channels | Brief summary only |

**High-Priority Channels (match by name pattern):**
- `*engineering*`, `*eng-*`
- `*incident*`, `*bug*`, `*alert*`
- `*platform*`, `*infrastructure*`
- `*prod-*`, `*production*`
- `*urgent*`, `*critical*`
- Channels from `meeting-config.json`
- **Private channels from `.claude/channels-config.json`** (leadership, engineering, data sections with `priority: high`)

### 3. Extract Action Items

For messages where you're @mentioned (use `me.slackUserId` from people.json), analyze for:

**Questions (create task):**
- Direct questions ending with `?`
- Patterns: "can you", "could you", "would you", "do you know"
- Patterns: "thoughts?", "opinion?", "feedback?"

**Requests (create task):**
- Patterns: "please", "need you to", "can you help"
- Patterns: "when you get a chance", "at some point"
- Assignment patterns: "Greg to...", "@greg action:"

**FYI only (don't create task):**
- Patterns: "FYI", "heads up", "just letting you know"
- Thank you messages
- Acknowledgments ("sounds good", "got it")

**Thread Status:**
- If you've already replied → likely resolved, lower priority
- If you haven't replied → needs attention, higher priority

### 4. Generate Summary

Write to: `context/YYYY-MM-DD/slack-HHMM.md`

Create the day directory if it doesn't exist. Add YAML frontmatter:
```yaml
---
type: context
subtype: slack
date: YYYY-MM-DD
time: HH:MM
---
```

```markdown
# Slack Read Summary - YYYY-MM-DD HH:MM

## Overview

- **Total unread messages:** 234
- **Bot notifications:** 47 (marked read automatically)
- **Messages processed:** 187
- **Action items found:** 5

---

## P0 - Direct Messages (3 conversations)

### Joel Patrick (2 messages, last: 2h ago)
> Hey, quick question about the Q1 roadmap - do we have capacity for the SSO work?
> Also, can you review the budget proposal when you get a chance?

**Status:** Not replied
**Action items:**
- [ ] Respond to Q1 capacity question
- [ ] Review budget proposal

[Open conversation](slack://channel?team=T123&id=D456)

---

### Renzo Rozza (1 message, last: yesterday)
> Thanks for the review - all good now!

**Status:** Thread complete (you replied earlier)
**Action items:** None

---

## P1 - @Mentions (4 mentions)

### #team-engineering (2 mentions)

**@Byron (3h ago):**
> @greg can you approve the PR for the auth changes? Been waiting since yesterday

**Status:** Not replied
**Action:** PR review requested
[View thread](slack://...)

**@Leonardo (yesterday):**
> @greg FYI - deployed the fix for the caching issue

**Status:** FYI only
**Action:** None needed

---

### #incidents (1 mention)

**@Romilly (4h ago):**
> @greg we've got elevated error rates on the API - not critical but wanted visibility

**Status:** Not replied (but thread has 5 more messages)
**Full thread context:**
> Romilly: elevated error rates...
> Peter: I'm looking into it
> Romilly: found the cause - it's the new deployment
> Peter: rolling back now
> Romilly: all clear, back to normal

**Action:** None - resolved in thread

---

## P2 - High-Priority Channels (Activity Summary)

### #team-engineering (23 messages)
- Sprint planning discussion (8 msgs)
- Deployment coordination (6 msgs)
- General questions (9 msgs)

### #incidents (5 messages)
- 1 incident discussed and resolved (see P1)

### #bug-hunt (12 messages)
- 3 new bugs reported
- 2 bugs closed

---

## P3 - Other Channels (Brief Summary)

| Channel | Messages | Topics |
|---------|----------|--------|
| #general | 15 | Office updates, social |
| #random | 8 | Misc chat |
| #announcements | 2 | Company news |

---

## Bot Notifications (47 total)

| Source | Count | Notes |
|--------|-------|-------|
| GitHub | 23 | PR reviews, CI results |
| Linear | 15 | Ticket updates |
| Google Calendar | 9 | Meeting reminders |

---

## Action Items Created

1. **Respond to Joel about Q1 capacity** (from DM)
2. **Review budget proposal** (from DM with Joel)
3. **Approve Byron's auth PR** (from #team-engineering)

---

## Ready to Mark as Read

### Option 1: All at once
Mark all 234 messages as read? This will clear your unread count.

### Option 2: By category
- [ ] DMs (3 conversations)
- [ ] @Mentions in channels (4 threads)
- [ ] #team-engineering (23 messages)
- [ ] #incidents (5 messages)
- [ ] #bug-hunt (12 messages)
- [ ] Other channels (25 messages)
- [ ] Bot notifications (47 messages)
```

### 5. Create Tasks

For each identified action item, use `TaskCreate`:

```
Subject: Respond to Joel about Q1 capacity
Description: Joel asked in DM about Q1 roadmap capacity for SSO work. Needs response.
ActiveForm: Responding to Joel's Slack message
```

Include source link in description for context.

### 6. Confirm & Mark Read

Present options:

```
Ready to mark messages as read.

[1] Mark ALL as read (234 messages across 15 channels)
[2] Mark by category (confirm each)
[3] Skip - don't mark anything as read
[4] Mark only bot notifications (47 messages)

Choice:
```

**If "Mark by category" selected:**
```
Mark DMs as read? (3 conversations) [y/n]: y
  ✓ Marked 3 DM conversations as read

Mark @mentions as read? (4 threads) [y/n]: y
  ✓ Marked 4 mention threads as read

Mark #team-engineering as read? (23 messages) [y/n]: y
  ✓ Marked #team-engineering as read

Mark #incidents as read? (5 messages) [y/n]: n
  ⏭ Skipped #incidents

...
```

**Mark as read implementation:**
- Use `conversations.mark` API to set read cursor
- Set to timestamp of most recent message in channel
- For threads, mark the thread as read

### 7. Final Confirmation

```
Slack Read Complete
===================

Processed: 234 messages
Marked read: 212 messages
Skipped: 22 messages (#incidents)
Tasks created: 3

Summary saved to: context/2026-01-26-1630-slack-read.md
```

## Configuration

Optional config in `.claude/slack-read-config.json`:

```json
{
  "highPriorityPatterns": [
    "*engineering*",
    "*incident*",
    "*bug*",
    "*platform*",
    "*prod-*"
  ],
  "excludeChannels": [
    "#random",
    "#social",
    "#watercooler"
  ],
  "botPatterns": [
    "github",
    "linear",
    "calendar",
    "circleci",
    "dependabot"
  ],
  "maxAgeDays": 30,
  "autoMarkBotsRead": true
}
```

## Edge Cases

### Very High Volume (>500 messages)
- Show progress indicator
- Process in batches
- Offer to show "highlights only" mode

### Old Unreads (>30 days)
- Warn user: "Found messages older than 30 days - these will be skipped"
- Offer option to include older messages

### Channels You've Muted
- Still process (they contribute to unread count)
- Mark as lower priority in output

### Archived Channels
- Skip (can't mark as read anyway)

### Shared Channels (external orgs)
- Process normally but flag as "external"

## Update Daily Context Index

After generating the summary, update `context/YYYY-MM-DD/index.md`:

```markdown
## Slack Summary (HH:MM)
- **DMs scanned**: X conversations
- **Channels scanned**: X
- **Bot notifications**: X (auto-processed)
- **Action items found**: X
- **Key requests**: [brief list]
```

Create the index file from template (`.claude/templates/context-index.md`) if it doesn't exist. Append a new Slack summary section (timestamped) if running multiple times per day.

## Figma Link Extraction

While processing messages, extract and persist any Figma links to `.claude/figma-sources.json`.

### Detection Pattern

Match URLs containing:
- `figma.com/design/[fileKey]/...`
- `figma.com/board/[fileKey]/...`
- `figma.com/file/[fileKey]/...`
- `figma.com/make/[fileKey]/...`

### Extraction

For each Figma URL found:

1. **Parse URL components**:
   - `fileKey`: The unique file identifier (e.g., `rj0xT7eM2bqWK5JT1kX6Ii`)
   - `type`: `design`, `board`, `file`, or `make`
   - `name`: URL-decoded file name from path
   - `nodeId`: From `?node-id=X-Y` parameter if present

2. **Capture context**:
   - `owner`: Message author (displayName, email if in people.json, slackUserId)
   - `sharedIn`: Channel name or DM identifier
   - `lastShared`: Message timestamp (YYYY-MM-DD)
   - `description`: Surrounding message text (first 200 chars)

3. **Cross-reference people.json**:
   - Look up message author's slackUserId in `indices.bySlackUserId`
   - If found, use their email as the owner email
   - If not found, add to `discoveredPeople` section

### Update figma-sources.json

1. **Load existing file**: Read `.claude/figma-sources.json`
2. **Check if exists**: Look for fileKey in `files` object
3. **If new entry**:
   - Add to `files` with full metadata
   - Add to `indices.byCategory` (infer from channel: engineering channels → "engineering", etc.)
   - Add to `indices.byOwnerSlackId`
4. **If existing entry**:
   - Update `lastShared` if more recent
   - Add channel to `sharedIn` if not already present
   - Update description if new context is more informative
5. **Update metadata**:
   - Set `lastUpdated` to current timestamp
6. **Write file**: Save updated JSON

### Category Inference

Infer category from channel name patterns:
- `*engineering*`, `*platform*`, `*data*`, `*infrastructure*` → `engineering`
- `*product*`, `*roadmap*`, `*feature*` → `product`
- `*design*`, `*ux*`, `*ui*` → `design`
- `*marketing*`, `*comms*`, `*brand*` → `marketing`
- `*partnerships*`, `*sales*`, `*customer*` → `partnerships`
- `*incident*`, `*bug*`, `*support*` → `operations`
- Default → `general`

### Output

Include in summary:

```markdown
## Figma Links Found (3 new, 2 updated)

| File | Type | Shared By | Channel |
|------|------|-----------|---------|
| [Futura user flow](url) | board | Lowell | #product |
| [ARC Assessment](url) | design | Tri | #partnerships-google |
| [Homepage Feed](url) | design | Tanya | #partnerships |

Updated in `.claude/figma-sources.json`
```

## Notes

- DMs are always highest priority - don't miss personal messages
- Bot notifications are auto-marked read (with confirmation)
- Thread context helps determine if action still needed
- Tasks include Slack links for easy navigation
- Summary file persists for reference at `context/YYYY-MM-DD/slack-HHMM.md`
- Run regularly to stay on top of Slack (e.g., start of day, after meetings)
- Daily context index accumulates Slack summaries throughout the day
- **Figma links are automatically extracted and persisted to figma-sources.json**
