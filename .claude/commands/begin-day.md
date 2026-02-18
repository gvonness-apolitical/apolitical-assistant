# Begin Day

Start the workday with a complete morning workflow: handoff, orient, email triage, gemini notes, slack read, todos, and briefing.

## Usage

- `/begin-day` - Full morning workflow
- `/begin-day --quick` - Skip triage, gemini, and slack (handoff + orient + todos + briefing only)
- `/begin-day --focus` - Deep work mode: calendar + assigned work + incidents only (skip notifications/mentions)
- `/begin-day --catch-up [days]` - Process backlog after time away (e.g., `--catch-up 5` for vacation return)
- `/begin-day --resume` - Resume from last completed step if previous run failed

## IMPORTANT: Checkpoint Discipline

**You MUST complete each step before moving to the next.** Do not skip ahead to the briefing.

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

If a step is skipped (due to mode flag), note it explicitly:

```
⊘ CHECKPOINT: Step N skipped - [step name] (--quick mode)

Proceeding to Step N+1: [next step name]
```

**Do not generate the final briefing until all prior steps are complete or explicitly skipped.**

## Pre-Flight Checks

Before starting the workflow, perform these checks:

### 1. People Cache Freshness

Check `.claude/people.json` last modified date:
- **If >7 days old**: Prompt "People cache is X days old. Run /sync-people? [y/N]"
- Cache refresh is optional but recommended for accurate lookups

### 1b. Asana Cache Freshness

Check `.claude/asana-sources.json`:
- **If `lastUpdated` is null**: Suggest "Asana cache not initialized. Run /sync-asana? [y/N]"
- **If >1 day old**: Suggest "Asana cache is X days old. Run /sync-asana? [y/N]"

### 2. Late Start Detection

Check current time:
- **Before 10am**: Normal "Good morning" messaging
- **10am-12pm**: "Late start" messaging, full workflow
- **After 12pm**: "Catching up" mode:
  - Note: "Starting after noon - adjusting workflow"
  - Suggest `--quick` if not already specified
  - Focus on remaining day rather than full morning routine

### 3. Weekend/Holiday Detection

Check if today is a weekend or known holiday:
- **Weekend (Sat/Sun)**: Offer lighter workflow:
  - "It's [Saturday]. Run lighter weekend workflow? [y/N]"
  - Weekend mode: Orient + briefing only (skip triage, slack read, todos)
- **Holiday**: Check against known holidays or calendar events marked as OOO
  - Similar lighter workflow offered

### 4. Progress State Check (for --resume)

Check `context/YYYY-MM-DD/index.md` for existing "Begin Day" section:
- **If found with incomplete steps**: Offer to resume from last completed step
- **If found complete**: Note "Begin day already run at HH:MM. Run again? [y/N]"

## Workflow Steps

Execute these steps **in order**. Do not skip ahead.

### Step 1: Previous Session Context

Link up to the previous session using Causantic memory, then read the EOD file for structured carry-forward items.

#### 1a. Causantic Session Recall

Use Causantic to reconstruct context from the most recent session in this project. This provides richer, narrative context than EOD files alone — including decisions made, problems encountered, and work in progress.

1. **Recall previous session**: Use `causantic-recall` with query "last session summary" (or `causantic-resume` if available)
2. **Extract key context**:
   - What was being worked on
   - Decisions made or deferred
   - Problems encountered and their resolution status
   - Anything explicitly flagged for follow-up
3. **If Causantic unavailable**: Note "Memory unavailable — falling back to EOD files only" and continue to 1b

#### 1b. Previous EOD Catchup

Read the most recent end-of-day summary to supplement the Causantic context with structured carry-forward items.

1. **Find the most recent EOD**: Search backwards from yesterday for `context/eod-YYYY-MM-DD.md`
   - Check yesterday first, then go back up to 10 days
2. **If found**, read and extract:
   - **Date**: When the EOD was generated
   - **Completed**: What was accomplished that day
   - **In Progress**: Items still in flight
   - **Carry Forward**: Items explicitly flagged for follow-up
   - **Notes for Tomorrow**: Context and reminders left for today
3. **Detect gaps**: Calculate working days between EOD date and today
   - **Normal** (1 weekday or weekend gap of 2-3 calendar days): Continue normally
   - **Extended gap** (>3 calendar days or >1 missed working day):
     ```
     ⚠ GAP DETECTED: Last EOD is from [date] ([N] working days ago)

     Missing context for: [list of missed working dates]

     Recommend running /catchup [start-date] to rebuild context.
     Run catchup now? [y/N]
     ```
     - If yes: Run `/catchup` for the gap period, then continue begin-day from Step 2
     - If no: Continue with warning noted (carry-forward items may be stale)
4. **If no EOD found** (within 10 days): Note — "No recent EOD found."

#### 1c. Merge and Present

Combine Causantic memory and EOD file into a unified previous-session summary:

1. **Deduplicate**: Items that appear in both sources should appear once, with the richer description
2. **Surface carry-forward items** as starting context for today's prioritisation
3. **Present briefly**: Show a concise summary — not the raw memory dump. Focus on what's actionable today.

If only one source was available (Causantic or EOD), use that alone without noting the gap.

```
✓ CHECKPOINT: Step 1 complete - Previous Session Context
  Memory: [available/unavailable] | Last EOD: YYYY-MM-DD | Gap: [N days / normal] | Carry-forward: X items

Proceeding to Step 2: Session Handoff
```

### Step 2: Session Handoff (if applicable)

Check for and process any session handoff:

1. **Check for handoff file**: Look for `context/YYYY-MM-DD/session-handoff.md` (today's date)
2. **If exists**:
   - Read the file
   - Display the immediate task and context summary
   - **Delete the file** after reading (it's ephemeral)
   - Note any carry-forward items for the briefing
3. **If not exists**: Continue to next step
4. **Update progress**: Mark Step 2 complete in daily context

```
✓ CHECKPOINT: Step 2 complete - Session Handoff
  [Handoff processed / No handoff found]

Proceeding to Step 3: Orient
```

### Step 3: Orient

Gather current context from all systems:

1. **Run orient** (equivalent to `/orient`):
   - Calendar: Today's meetings
   - Email: Unread count and urgent items
   - Slack: Recent DMs and mentions
   - Linear: Assigned tickets, blocked items
   - Incidents: Active incidents
   - Humaans: Who's out
   - Google Docs: Recently shared or commented docs
2. **Output**: Context snapshot saved to `context/YYYY-MM-DD/orient-HHMM.md`
3. **Update progress**: Mark Step 3 complete in daily context

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

```
✓ CHECKPOINT: Step 3 complete - Orient
  Calendar: X meetings | Email: X unread | Slack: X DMs | Linear: X assigned | Incidents: X

Proceeding to Step 4: Email Triage
```

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

```
✓ CHECKPOINT: Step 4 complete - Email Triage
  Processed: X | Trashed: X | Archived: X | Respond: X pending

Proceeding to Step 5: Process Gemini Notes
```

### Step 5: Process Gemini Notes

Process any unread Gemini meeting notes:

1. **Run gemini notes processing** (equivalent to `/process-gemini-notes`):
   - Search for unread emails from gemini-notes@google.com
   - For each: fetch doc content, extract action items, determine meeting type
   - Save structured summaries to `meetings/output/[type]/`
   - Note action items assigned to me
2. **Archive processed emails**
3. **Output**: List of meetings processed and action items found
4. **Update progress**: Mark Step 5 complete in daily context

Skip if `--quick` or `--focus` flag is used, or if no unread Gemini notes.

```
✓ CHECKPOINT: Step 5 complete - Process Gemini Notes
  Meetings: X processed | My action items: X found

Proceeding to Step 6: Slack Read
```

### Step 6: Slack Read

Process Slack messages and activity:

1. **Run slack read** (equivalent to `/slack-read`):
   - Scan all DMs for unread messages
   - Check priority channels from `.claude/channels-config.json`
   - Identify action items and requests directed at you
   - Summarize key conversations and decisions
2. **Output**: Slack activity summary saved to `context/YYYY-MM-DD/slack-HHMM.md`
3. **Update progress**: Mark Step 6 complete in daily context

Skip if `--quick` or `--focus` flag is used.

With `--catch-up [days]`: Extend lookback period to cover absence.

```
✓ CHECKPOINT: Step 6 complete - Slack Read
  DMs: X conversations | Channels: X checked | Action items: X found

Proceeding to Step 7: Update Todos
```

### Step 7: Update Todos

Scan all systems for action items assigned to you. **This step runs AFTER email, gemini, and slack** so it has full context.

1. **Run the full todo scan** (equivalent to `/update-todos`):
   - Slack canvases (from meeting-config.json)
   - Slack messages (mentions and requests) - already gathered in Step 6
   - Gmail inbox (actionable emails) - already gathered in Step 4
   - Gemini meeting notes - already gathered in Step 5
   - Notion (mentions and assignments)
   - Google Docs (comments and suggestions)
2. **Deduplicate** against existing tasks and items found in earlier steps
3. **Create tasks** for new items found
4. **Output**: Summary of items found by source
5. **Update progress**: Mark Step 7 complete in daily context

Skip in `--focus` mode (only shows assigned Linear tickets from orient).

```
✓ CHECKPOINT: Step 7 complete - Update Todos
  New items: X | From canvases: X | From Notion: X | From Docs: X

Proceeding to Step 8: Morning Briefing
```

### Step 8: Morning Briefing

Generate the daily briefing. **Only run after all prior steps are complete.**

1. **Reference previous EOD context** from Step 1:
   - Carry-forward items
   - Context to remember
   - Follow-ups needed
2. **Gather context** from previous steps (already collected)
3. **Generate briefing** with:
   - Today's meetings table
   - P1 - Action Today
   - P2 - This Week
   - FYI - Monitor
4. **Save to**: `briefings/YYYY-MM-DD.md`
5. **Update daily context index**
6. **Update progress**: Mark Step 8 complete in daily context

```
✓ CHECKPOINT: Step 8 complete - Morning Briefing
  Saved to: briefings/YYYY-MM-DD.md

Proceeding to Step 9: Standup Prep
```

### Step 9: Standup Prep (if applicable)

Check if a standup meeting is scheduled today:

1. **Detect standup**: Look for meetings with "standup", "stand-up", "daily sync" in title
2. **If standup found**, generate talking points:
   ```
   ## Standup Prep - [Meeting Name] at [Time]

   ### Yesterday
   - [Items from previous EOD or activity]

   ### Today
   - [Top items from P1 list]
   - [Key meetings]

   ### Blockers
   - [Any blocked items from Linear/todos]
   ```
3. **Include in briefing** or display separately if standup is soon

```
✓ CHECKPOINT: Step 9 complete - Standup Prep
  [Talking points generated for X / No standup today]
```

## Final Summary

After ALL 9 steps complete (or explicitly skipped), display:

```
# Begin Day Complete - 2026-01-29

## Steps Completed
✓ 1. Session Context  ✓ 2. Handoff      ✓ 3. Orient
✓ 4. Email Triage     ✓ 5. Gemini Notes ✓ 6. Slack Read
✓ 7. Update Todos     ✓ 8. Briefing     ✓ 9. Standup Prep

## First Meeting
Data standup in 47 minutes (09:30)

## Focus Today (Top 3)
1. [Highest priority item from P1]
2. [Second priority]
3. [Third priority]

## Quick Stats
- Meetings: 5 today
- P1 items: 3 requiring action
- Emails: 12 processed (2 need response)
- Gemini notes: 3 processed (2 action items)
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
- **People cache**: Current (2 days old)
- **Mode**: Normal morning start

---

## Step 1: Previous Session Context
- **Memory**: [available/unavailable]
- **Last session**: [summary from Causantic]
- **Last EOD**: YYYY-MM-DD
- **Gap**: Normal (weekend) / X working days missed
- **Carry-forward**: X items
- **Key items**:
  - [carry-forward item 1]
  - [carry-forward item 2]

[If gap detected: catchup recommendation shown]

✓ CHECKPOINT: Step 1 complete

---

## Step 2: Session Handoff
[If applicable: summary of handoff context and immediate tasks]

✓ CHECKPOINT: Step 2 complete

---

## Step 3: Orient
- **Calendar**: X meetings today
- **Email**: X unread (Y urgent)
- **Slack**: X unread DMs, Y mentions
- **Linear**: X assigned, Y blocked
- **Incidents**: X active
- **Humaans**: X people out

[P0 items highlighted if any]

✓ CHECKPOINT: Step 3 complete

---

## Step 4: Email Triage
- **Processed**: X emails across Y threads
- **Auto-processed**: X trashed, Y archived
- **SLA Breaches**: X threads waiting >24h
- **Respond**: X items pending

[SLA breaches and key items highlighted]

✓ CHECKPOINT: Step 4 complete

---

## Step 5: Process Gemini Notes
- **Meetings processed**: X
- **Summaries saved**: [list of files]
- **My action items**: X found

✓ CHECKPOINT: Step 5 complete

---

## Step 6: Slack Read
- **DMs scanned**: X conversations
- **Channels checked**: X
- **Action items found**: X
- **Key threads**: [list]

✓ CHECKPOINT: Step 6 complete

---

## Step 7: Update Todos
- **Total new items**: X
- From canvases: X
- From Notion: X
- From Google Docs: X
- Deduplicated: X (already found in earlier steps)

✓ CHECKPOINT: Step 7 complete

---

## Step 8: Morning Briefing

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

✓ CHECKPOINT: Step 8 complete

---

## Step 9: Standup Prep
[If applicable: talking points for standup]

✓ CHECKPOINT: Step 9 complete

---

## Focus Today (Top 3)
1. **[Top priority]** - [brief context]
2. **[Second priority]** - [brief context]
3. **[Third priority]** - [brief context]

## First Meeting
[Meeting name] in X minutes at HH:MM

---
All 9 steps complete. Ready for the day!
```

## Update Daily Context

After completing all steps, update `context/YYYY-MM-DD/index.md`:

```markdown
## Begin Day (HH:MM)
- **Mode**: [Normal / Late start / Weekend / Catch-up]
- **Steps completed**: 1, 2, 3, 4, 5, 6, 7, 8, 9
- **Memory recall**: [available — summary / unavailable]
- **Previous EOD**: [date] ([N] carry-forward items / not found)
- **Gap detected**: [None / N working days — catchup run/skipped]
- **Handoff**: [Processed / None]
- **Orient**: Calendar X, Email X, Slack X, Linear X, Incidents X
- **P0 items**: [X critical items / None]
- **Email triage**: X processed, Y trashed, Z archived
- **Gemini notes**: X meetings processed, Y action items
- **Slack read**: X DMs, Y channels, Z action items
- **Todos found**: X new items (after dedup)
- **Briefing**: Generated
- **Standup prep**: [Generated for Meeting / N/A]
- **Focus today**: [Top 3 items listed]
- **First meeting**: [Meeting] at HH:MM (in X minutes)
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
Begin Day interrupted at Step 5 (Process Gemini Notes)

Completed: EOD Catchup, Handoff, Orient, Email Triage
Remaining: Gemini Notes, Slack Read, Update Todos, Briefing, Standup Prep

Resume with: /begin-day --resume
```

When `--resume` is used:
1. Read progress from daily context
2. Skip completed steps
3. Continue from first incomplete step

## Mode Reference

| Flag | Steps Run | Use Case |
|------|-----------|----------|
| (none) | All 9 steps | Normal workday start |
| `--quick` | 1, 2, 3, 7, 8, 9 | Fast startup, skip triage/gemini/slack |
| `--focus` | 1, 2, 3, 8 | Deep work day, minimal notifications |
| `--catch-up N` | All 9 + extended lookback | Return from vacation/absence |
| `--resume` | Remaining steps | Recovery from failed run |
| Weekend mode | 1, 3, 8 | Weekend check-in |

### Step Summary by Mode

| Step | Default | --quick | --focus | Weekend |
|------|:-------:|:-------:|:-------:|:-------:|
| 1. Session Context | ✓ | ✓ | ✓ | ✓ |
| 2. Handoff | ✓ | ✓ | ✓ | - |
| 3. Orient | ✓ | ✓ | ✓ | ✓ |
| 4. Email Triage | ✓ | - | - | - |
| 5. Gemini Notes | ✓ | - | - | - |
| 6. Slack Read | ✓ | - | - | - |
| 7. Update Todos | ✓ | ✓ | - | - |
| 8. Briefing | ✓ | ✓ | ✓ | ✓ |
| 9. Standup Prep | ✓ | ✓ | - | - |

## Notes

- This skill is designed for the start of a workday
- **CHECKPOINT DISCIPLINE**: Each step must complete before proceeding to the next
- Each sub-step writes to daily context, so partial runs still capture progress
- Previous EOD catchup runs first to establish context and detect gaps
- If a gap is detected, `/catchup` is offered before continuing the rest of the workflow
- Handoff file is deleted after processing to prevent reprocessing
- Email triage runs BEFORE gemini/slack/todos so noise is cleared first
- Gemini notes processing captures meeting action items before todo scan
- Update Todos runs LAST to have full context from email, meetings, and Slack
- Briefing incorporates context from all previous steps including carry-forward items from Step 1
- P0 items get early visibility to allow immediate action
- Standup prep is auto-generated when a standup meeting is detected
- "Focus Today" top 3 helps cut through information overload
- First meeting countdown helps with time awareness

### Step Order Rationale

1. **Session Context** - Causantic recall + EOD files to establish context from where you left off, detect missed days
2. **Handoff** - Resume interrupted work
3. **Orient** - Get the lay of the land (counts, not details)
4. **Email Triage** - Clear inbox noise, surface urgent items
5. **Gemini Notes** - Process meeting transcripts, extract action items
6. **Slack Read** - Catch DM requests and channel activity
7. **Update Todos** - Now has full context to deduplicate and prioritize
8. **Briefing** - Synthesize everything into actionable priorities
9. **Standup Prep** - Ready for first meeting if it's a standup
