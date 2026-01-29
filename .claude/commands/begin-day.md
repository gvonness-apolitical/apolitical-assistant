# Begin Day

Start the workday with a complete morning workflow: handoff, orient, todos, email triage, slack read, and briefing.

## Usage

- `/begin-day` - Full morning workflow
- `/begin-day --quick` - Skip email triage and slack read (handoff + orient + todos + briefing only)
- `/begin-day --focus` - Deep work mode: calendar + assigned work + incidents only (skip notifications/mentions)
- `/begin-day --catch-up [days]` - Process backlog after time away (e.g., `--catch-up 5` for vacation return)
- `/begin-day --resume` - Resume from last completed step if previous run failed

## Pre-Flight Checks

Before starting the workflow, perform these checks:

### 1. Yesterday's EOD Check

Check if `context/eod-YYYY-MM-DD.md` exists for yesterday:
- **If exists**: Note carry-forward items for later inclusion in briefing
- **If missing**: Display warning: "Yesterday's EOD not found - context may be incomplete. Generate retrospective? [y/N]"
  - If yes: Generate quick summary of yesterday from available data before proceeding
  - If no: Continue with warning noted

### 2. People Cache Freshness

Check `.claude/people.json` last modified date:
- **If >7 days old**: Prompt "People cache is X days old. Run /sync-people? [y/N]"
- Cache refresh is optional but recommended for accurate lookups

### 3. Late Start Detection

Check current time:
- **Before 10am**: Normal "Good morning" messaging
- **10am-12pm**: "Late start" messaging, full workflow
- **After 12pm**: "Catching up" mode:
  - Note: "Starting after noon - adjusting workflow"
  - Suggest `--quick` if not already specified
  - Focus on remaining day rather than full morning routine

### 4. Weekend/Holiday Detection

Check if today is a weekend or known holiday:
- **Weekend (Sat/Sun)**: Offer lighter workflow:
  - "It's [Saturday]. Run lighter weekend workflow? [y/N]"
  - Weekend mode: Orient + briefing only (skip triage, slack read, todos)
- **Holiday**: Check against known holidays or calendar events marked as OOO
  - Similar lighter workflow offered

### 5. Progress State Check (for --resume)

Check `context/YYYY-MM-DD/index.md` for existing "Begin Day" section:
- **If found with incomplete steps**: Offer to resume from last completed step
- **If found complete**: Note "Begin day already run at HH:MM. Run again? [y/N]"

## Workflow Steps

Execute these steps in order:

### Step 1: Session Handoff (if applicable)

Check for and process any session handoff:

1. **Check for handoff file**: Look for `context/YYYY-MM-DD/session-handoff.md` (today's date)
2. **If exists**:
   - Read the file
   - Display the immediate task and context summary
   - **Delete the file** after reading (it's ephemeral)
   - Note any carry-forward items for the briefing
3. **If not exists**: Continue to next step
4. **Update progress**: Mark Step 1 complete in daily context

### Step 2: Orient

Gather current context from all systems:

1. **Run orient** (equivalent to `/orient`):
   - Calendar: Today's meetings
   - Email: Unread count and urgent items
   - Slack: Recent DMs and mentions
   - Linear: Assigned tickets, blocked items
   - Incidents: Active incidents
   - Gemini notes: Recent meeting transcripts/notes
   - Google Docs: Recently shared or commented docs
   - Google Slides: Recently shared presentations
2. **Output**: Context snapshot saved to `context/YYYY-MM-DD/orient-HHMM.md`
3. **Update progress**: Mark Step 2 complete in daily context

#### P0 Early Exit Check

After orient, check for critical items:
- **Active incidents** (SEV1/SEV2)
- **Exec requests** flagged urgent
- **Blocked team members** waiting on you
- **Missed deadlines**

If P0 items found:
```
CRITICAL ITEMS DETECTED

1. [INC-123] Production API degraded - SEV1 active
2. [Email] Joel: "Need response ASAP on budget"

Address these now before continuing? [y/N]
- Yes: Pause workflow, focus on P0 items
- No: Continue workflow (items will appear in briefing)
```

### Step 3: Update Todos

Scan all systems for action items assigned to you:

1. **Run the full todo scan** (equivalent to `/update-todos`):
   - Slack canvases (from meeting-config.json)
   - Slack messages (mentions and requests)
   - Gmail inbox (actionable emails)
   - Notion (mentions and assignments)
   - Google Docs (comments and suggestions)
2. **Deduplicate** against existing tasks
3. **Create tasks** for new items found
4. **Output**: Summary of items found by source
5. **Update progress**: Mark Step 3 complete in daily context

Skip in `--focus` mode (only shows assigned Linear tickets from orient).

### Step 4: Email Triage

Process inbox and categorize emails:

1. **Run email triage** (equivalent to `/triage-inbox`):
   - Load email rules from `.claude/email-rules.json`
   - Fetch unread emails (default 50, or more with `--catch-up`)
   - Apply auto-delete rules
   - Categorize: Respond, Review, Delegate, Archive, Delete
   - Generate drafts for "Respond" items
2. **Execute bulk actions** with confirmation
3. **Output**: Triage summary with SLA breaches highlighted
4. **Update progress**: Mark Step 4 complete in daily context

Skip if `--quick` or `--focus` flag is used.

With `--catch-up [days]`: Increase limit to handle backlog, use `--backlog` mode for efficiency.

### Step 5: Slack Read

Process Slack messages and activity:

1. **Run slack read** (equivalent to `/slack-read`):
   - Scan all DMs for unread messages
   - Check priority channels from `.claude/channels-config.json`
   - Identify action items and requests directed at you
   - Summarize key conversations and decisions
2. **Output**: Slack activity summary saved to `context/YYYY-MM-DD/slack-HHMM.md`
3. **Update progress**: Mark Step 5 complete in daily context

Skip if `--quick` or `--focus` flag is used.

With `--catch-up [days]`: Extend lookback period to cover absence.

### Step 6: Morning Briefing

Generate the daily briefing:

1. **Check previous day's EOD**: Read `context/eod-YYYY-MM-DD.md` for yesterday
   - Carry-forward items
   - Context to remember
   - Follow-ups needed
2. **Gather context** from previous steps (or fresh if steps were skipped)
3. **Generate briefing** with:
   - Today's meetings table
   - P1 - Action Today
   - P2 - This Week
   - FYI - Monitor
4. **Save to**: `briefings/YYYY-MM-DD.md`
5. **Update daily context index**
6. **Update progress**: Mark Step 6 complete in daily context

### Step 7: Standup Prep (if applicable)

Check if a standup meeting is scheduled today:

1. **Detect standup**: Look for meetings with "standup", "stand-up", "daily sync" in title
2. **If standup found**, generate talking points:
   ```
   ## Standup Prep - [Meeting Name] at [Time]

   ### Yesterday
   - [Items from yesterday's EOD or activity]

   ### Today
   - [Top items from P1 list]
   - [Key meetings]

   ### Blockers
   - [Any blocked items from Linear/todos]
   ```
3. **Include in briefing** or display separately if standup is soon

## Final Summary

After all steps complete, display:

```
# Begin Day Complete - 2026-01-29

## First Meeting
Data standup in 47 minutes (09:30)

## Focus Today (Top 3)
1. [Highest priority item from P1]
2. [Second priority]
3. [Third priority]

## Quick Stats
- Meetings: 5 today
- P1 items: 3 requiring action
- Emails: 12 need response (2 SLA breach)
- Team out: Sarah, Mike

## Standup Ready
Talking points prepared for Data standup (09:30)

---
Ready for the day!
```

## Output Structure

### Combined Summary

```
# Begin Day - 2026-01-29

## Pre-Flight
- **Yesterday's EOD**: Found (3 carry-forward items)
- **People cache**: Current (2 days old)
- **Mode**: Normal morning start

---

## Session Handoff
[If applicable: summary of handoff context and immediate tasks]

---

## Orient (Step 2)
- **Calendar**: X meetings today
- **Email**: X unread (Y urgent)
- **Slack**: X unread DMs, Y mentions
- **Linear**: X assigned, Y blocked
- **Incidents**: X active
- **Gemini notes**: X recent transcripts
- **Google Docs**: X recently shared/commented
- **Google Slides**: X recently shared

[P0 items highlighted if any]

---

## Action Items Found (Step 3)
- **Total**: X new items
- From canvases: X
- From Slack: X
- From email: X
- From Notion: X
- From Google Docs: X

[Summary table of key items]

---

## Email Triage (Step 4)
- **Processed**: X emails across Y threads
- **Auto-processed**: X deleted, Y archived
- **SLA Breaches**: X threads waiting >24h
- **Respond**: X items pending
- **Review**: X items

[SLA breaches and key items highlighted]

---

## Slack Read (Step 5)
- **DMs scanned**: X conversations
- **Channels checked**: X
- **Action items found**: X
- **Key threads**: [list]

---

## Morning Briefing (Step 6)

### Today's Meetings
| Time | Meeting | Attendees | Prep |
|------|---------|-----------|------|

### P1 - Action Today
- [ ] Item 1
- [ ] Item 2

### P2 - This Week
- [ ] Item 1

### FYI - Monitor
- Active incidents
- Team availability

---

## Standup Prep (Step 7)
[If applicable: talking points for standup]

---

## Focus Today (Top 3)
1. **[Top priority]** - [brief context]
2. **[Second priority]** - [brief context]
3. **[Third priority]** - [brief context]

## First Meeting
[Meeting name] in X minutes at HH:MM

---
Ready for the day!
```

## Update Daily Context

After completing all steps, update `context/YYYY-MM-DD/index.md`:

```markdown
## Begin Day (HH:MM)
- **Mode**: [Normal / Late start / Weekend / Catch-up]
- **Handoff**: [Processed / None]
- **Orient**: Calendar X, Email X, Slack X, Linear X, Incidents X, Gemini X, Docs X
- **P0 items**: [X critical items / None]
- **Todos found**: X new items
- **Email triage**: X processed, Y respond, Z SLA breaches
- **Slack read**: X DMs, Y channels, Z action items
- **Briefing**: Generated
- **Standup prep**: [Generated for Meeting / N/A]
- **Focus today**: [Top 3 items listed]
- **First meeting**: [Meeting] at HH:MM (in X minutes)
- **Steps completed**: 1, 2, 3, 4, 5, 6, 7
```

Create the day directory and index file if they don't exist.

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context (for `--resume`)
3. Continue with remaining steps
4. Note the failure in the final summary
5. Suggest manual recovery (e.g., "Run `/triage-inbox` separately if email integration is down")

### Resume Capability

Progress is tracked in daily context. If begin-day fails:
```
Begin Day interrupted at Step 4 (Email Triage)

Completed: Handoff, Orient, Todos
Remaining: Email Triage, Slack Read, Briefing, Standup Prep

Resume with: /begin-day --resume
```

When `--resume` is used:
1. Read progress from daily context
2. Skip completed steps
3. Continue from first incomplete step

## Mode Reference

| Flag | Steps Run | Use Case |
|------|-----------|----------|
| (none) | All 7 steps | Normal workday start |
| `--quick` | 1, 2, 3, 6, 7 | Fast startup, skip triage |
| `--focus` | 1, 2, 6 | Deep work day, minimal notifications |
| `--catch-up N` | All + extended lookback | Return from vacation/absence |
| `--resume` | Remaining steps | Recovery from failed run |
| Weekend mode | 2, 6 | Weekend check-in |

## Notes

- This skill is designed for the start of a workday
- Each sub-step writes to daily context, so partial runs still capture progress
- Handoff file is deleted after processing to prevent reprocessing
- Email triage may generate drafts - review before sending
- Briefing incorporates context from all previous steps
- P0 items get early visibility to allow immediate action
- Standup prep is auto-generated when a standup meeting is detected
- "Focus Today" top 3 helps cut through information overload
- First meeting countdown helps with time awareness
