# Slack Read

Process all unread Slack messages, summarize activity, create tasks for requests, and mark as read.

## Usage

- `/slack-read` - Process all unread messages (last 30 days)
- `/slack-read --quick` - Summary only, no task creation
- `/slack-read --dry-run` - Preview what would be processed without marking read
- `/slack-read --resume` - Resume from last completed step if previous run was interrupted

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

If a step is skipped (due to mode flag), note it explicitly:

```
⊘ CHECKPOINT: Step N skipped - [step name] ([reason])

Proceeding to Step N+1: [next step name]
```

**IMPORTANT:** Step 6 (Mark as Read) is **destructive**. Always checkpoint before this step.

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/slack-read --resume`

## MANDATORY: Read Channels, Don't Paraphrase

Slack read means calling `slack_read_channel` and `slack_read_dm` for each source — not summarising what you remember from orient.

**Each DM/channel checkpoint must cite:** `Tools: slack_read_dm ×N` or `Tools: slack_read_channel ×N`
**Each checkpoint must include:** message count, action items found, tasks created (with IDs)

If `/orient` was run earlier in this session, you still read the channels. Orient provides counts; slack-read processes the content.

**WRONG:** "7 DMs checked — 2 action items from Jess and Dom" (paraphrased from orient)
**RIGHT:** slack_read_dm ×7 → extract action items → TaskCreate ×2 → checkpoint: "DMs: 7 | Action items: 2 | Tasks: #8, #12 | Tools: slack_read_dm ×7, TaskCreate ×2"

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume capability
- [Person Resolution](../patterns/person-resolution.md) - Resolve message authors
- [Figma Extraction](../patterns/figma-extraction.md) - Extract and cache Figma links
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Rate Limiting](../patterns/rate-limiting.md) - Batch channel reads efficiently
- [Error Handling](../patterns/error-handling.md) - Handle Slack API issues

## Context Window Management

Process channels sequentially. After each batch of 5 channels, compact results into checkpoint format before proceeding. For channels with >50 messages, summarize into structured items before moving to next channel. Do not carry raw message payloads across channel boundaries — extract action items and discard the rest.

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

### Step 1: Gather Unread Messages

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

```
✓ CHECKPOINT: Step 1 complete - Gather Unread Messages
  DMs: [N] conversations | Channels: [N] | Threads: [N] tagged

Proceeding to Step 2: Categorize & Filter
```

### Step 2: Categorize & Filter

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

```
✓ CHECKPOINT: Step 2 complete - Categorize & Filter
  P0 (DMs): [N] | P1 (@mentions): [N] | P2 (high-priority): [N] | P3 (other): [N] | Bot: [N]

Proceeding to Step 3: Extract Action Items
```

### Step 3: Extract Action Items

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

```
✓ CHECKPOINT: Step 3 complete - Extract Action Items
  Questions: [N] | Requests: [N] | FYI only: [N] | Needs response: [N]

Proceeding to Step 4: Generate Summary
```

### Step 4: Generate Summary

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

```
✓ CHECKPOINT: Step 4 complete - Generate Summary
  Saved to: context/YYYY-MM-DD/slack-HHMM.md

Proceeding to Step 5: Create Tasks
```

### Step 5: Create Tasks

For each identified action item, use `TaskCreate`:

```
Subject: Respond to Joel about Q1 capacity
Description: Joel asked in DM about Q1 roadmap capacity for SSO work. Needs response.
ActiveForm: Responding to Joel's Slack message
```

Include source link in description for context.

Skip task creation if `--quick` mode is active.

```
✓ CHECKPOINT: Step 5 complete - Create Tasks
  Tasks created: [N]

Proceeding to Step 6: Confirm & Mark Read
```

### Step 6: Confirm & Mark Read (⚠️ DESTRUCTIVE)

**⚠️ This step is destructive - marking messages as read cannot be undone.**

Skip if `--dry-run` mode is active.

```
⚠️  DESTRUCTIVE STEP: About to mark [N] messages as read.
    Progress saved. Resume with: /slack-read --resume
```

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

```
✓ CHECKPOINT: Step 6 complete - Mark as Read
  Marked read: [N] | Skipped: [N]

Proceeding to Step 7: Final Confirmation
```

### Step 7: Final Confirmation

```
✓ CHECKPOINT: Step 7 complete - Final Confirmation
```

## Final Summary

After ALL 7 steps complete (or explicitly skipped), display:

```
# Slack Read Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Gather Messages  ✓ 2. Categorize   ✓ 3. Extract Actions
✓ 4. Generate Summary ✓ 5. Create Tasks ✓ 6. Mark Read
✓ 7. Final Confirmation

## Key Results
- **Processed**: 234 messages
- **Marked read**: 212 messages
- **Skipped**: 22 messages (#incidents)
- **Tasks created**: 3

## Summary
Saved to: context/YYYY-MM-DD/slack-HHMM.md

---
Slack Read complete.
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

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context (for resume)
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /slack-read --resume"

### Resume Behavior

When `/slack-read --resume` is run:
1. Check daily context for incomplete Slack Read
2. Skip completed steps (gathering, categorizing, etc.)
3. Resume from last incomplete step
4. For Step 6 (mark-as-read), re-display summary and re-prompt for confirmation

## Mode Reference

| Flag | Steps Run | Destructive Step | Use Case |
|------|-----------|------------------|----------|
| (none) | All 7 | Step 6 executes | Normal processing |
| `--quick` | 1, 2, 3, 4, 7 | Skip 5, 6 | Fast summary only |
| `--dry-run` | 1, 2, 3, 4, 5, 7 | Skip 6 | Preview without changes |
| `--resume` | Remaining | If not done | Recovery |

### Step Summary by Mode

| Step | Default | --quick | --dry-run |
|------|:-------:|:-------:|:---------:|
| 1. Gather Messages | ✓ | ✓ | ✓ |
| 2. Categorize & Filter | ✓ | ✓ | ✓ |
| 3. Extract Action Items | ✓ | ✓ | ✓ |
| 4. Generate Summary | ✓ | ✓ | ✓ |
| 5. Create Tasks | ✓ | - | ✓ |
| 6. Mark as Read ⚠️ | ✓ | - | - |
| 7. Final Confirmation | ✓ | ✓ | ✓ |

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

## Dossier Update Prompts

After processing DM exchanges, offer dossier updates for notable interactions:

1. **Check for significant exchanges**: After reading each DM conversation, assess whether it contained:
   - Notable communication patterns (how they handled disagreement, delivered news, made requests)
   - Relationship dynamics worth capturing
   - Behavioural observations relevant to future interactions
   - Coaching-relevant interactions (for direct reports)

2. **If significant**: Check whether the person has a dossier in `.claude/dossiers.json`
   - **If dossier exists**: Offer update prompt:
     ```
     Notable exchange with [person] about [topic]. Update dossier? [Add note / Skip]
     ```
   - If user provides a note, save as a new `notes` entry with `context: "slack exchange"` and today's date
   - Update `lastUpdated` on the entry

3. **Light touch**: Don't auto-update. Only prompt when the exchange is genuinely notable. Routine messages don't warrant prompts.

4. **Include in summary**: Note any dossier updates in the final summary:
   ```
   ## Dossier Updates
   - [Person]: Added note about [topic]
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
- **Dossier update prompts are offered after notable DM exchanges**
