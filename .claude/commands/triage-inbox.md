# Email Triage

Review inbox and categorise emails for action.

## Usage

- `/triage-inbox` - Triage all unread emails (fetches in batches of 50)
- `/triage-inbox [count]` - Triage up to a specific number of emails
- `/triage-inbox --quick` - Fast triage without cross-system context
- `/triage-inbox --since-last` - Only emails since last triage
- `/triage-inbox --backlog` - Handle large inbox (paginated, no context)
- `/triage-inbox --resume` - Resume from last completed step if previous run was interrupted

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

**IMPORTANT:** Step 8 (Execute Actions) is **destructive** - includes delete and archive operations. Always checkpoint before this step.

**Progress tracking:** Stored in `.claude/email-rules.json` (triage state section)
**Resume with:** `/triage-inbox --resume`

## MANDATORY: Execute Triage Actions

Email triage requires calling these tools — categorising in your head doesn't count:

1. `gmail_search` with maxResults: 50 — fetch ALL unread, not just 10
2. Read `.claude/email-rules.json` — load and apply every rule
3. `gmail_trash` — actually delete matched emails (not "would delete")
4. `gmail_archive` — actually archive matched emails
5. `TaskCreate` — create tasks for emails requiring response (with `P{n}.{m}:` prefix)

**Enforcement:** Your final checkpoint MUST include:
```
Tools: gmail_search ×1, gmail_trash ×1, gmail_archive ×1, TaskCreate ×N
Metrics: Processed: N | Trashed: N | Archived: N | Respond: N
```

If Trashed and Archived are both 0 and you processed >5 emails, something is wrong — rules should match.

**Final verification:** Call TaskList to verify all triage-created tasks have `P{n}.{m}:` prefixes.

**WRONG:** "10 emails, all noise — archived mentally"
**RIGHT:** gmail_trash([16 IDs]) → gmail_archive([6 IDs]) → TaskCreate ×2 → "Trashed: 16 | Archived: 6 | Tasks: #18, #19"

## Context Window Management

When processing >30 emails, batch in groups of 15. After each batch: apply rules, execute trash/archive, checkpoint with metrics, then proceed. Do not carry full email bodies across batch boundaries — extract subject, sender, category, and action needed, then discard the raw content.

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume capability
- [Person Resolution](../patterns/person-resolution.md) - Resolve senders to identifiers
- [Error Handling](../patterns/error-handling.md) - Handle Gmail API issues

## Configuration

Rules are stored in `.claude/email-rules.json`. Copy from `.claude/email-rules.example.json` to customize.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `slaHoursInternal` | 24 | Hours before internal emails show SLA warning |
| `slaHoursExternal` | 48 | Hours before external emails show SLA warning |
| `bulkActionThreshold` | 5 | Confirm before bulk actions exceeding this count |
| `defaultLimit` | 50 | Batch size per Gmail API call (skill iterates until all unread emails are fetched) |
| `lastTriageDate` | null | Auto-updated after each triage |

### Sender Tiers

Priority levels for senders (patterns match email addresses):
- **exec**: Always P1, never auto-delete
- **directReports**: P1 by default
- **team**: P2 by default (internal)
- **priority**: Custom high-priority senders
- *(unlisted)*: P3 by default (external)

### Labels

Map categories to Gmail labels. Skill will check if labels exist and offer to create missing ones.

## Process

### Step 1: Load Configuration

1. Read `.claude/email-rules.json` (create from example if missing)
2. Check for snoozed emails that are now due
3. If `--since-last`, use `lastTriageDate` as cutoff

```
✓ CHECKPOINT: Step 1 complete - Load Configuration
  Rules loaded: [N] auto-delete | [N] always-keep | Snoozed due: [N]

Proceeding to Step 2: Fetch & Group Emails
```

### Step 2: Fetch & Group Emails

**IMPORTANT: Iterate until ALL unread emails are fetched.** The Gmail API returns a limited batch per call. You MUST loop until no more unread emails remain.

1. **Initial fetch**: Search Gmail for `is:unread in:inbox` with `maxResults` set to `defaultLimit` (50)
2. **Pagination loop**: After each batch, check if there are more results:
   - If the batch returned `maxResults` emails, there are likely more — fetch the next batch
   - Continue fetching until a batch returns fewer than `maxResults` emails (indicating end of results)
   - Show progress after each batch: `Fetched [running total] emails so far...`
3. **Combine all results**: Merge all batches into a single list
4. **Group by thread** using Gmail's `threadId`
5. For each thread, fetch all messages to understand conversation state
6. **Verify completeness**: Log total fetched vs initial unread count from orient (if available)

**Why this matters**: Gmail's `gmail_search` returns at most `maxResults` emails per call. Without iteration, emails beyond the first batch are silently missed. This was observed in practice — a 40-email inbox was only half-processed when fetching 20 at a time.

```
✓ CHECKPOINT: Step 2 complete - Fetch & Group Emails
  Emails: [N] (fetched in [B] batches) | Threads: [N] | Unique senders: [N]

Proceeding to Step 3: Gather Sender Context
```

### Step 3: Gather Sender Context (skip with --quick)

For each unique sender (excluding auto-delete matches):

1. **Slack**: Recent DMs (last 7 days)
2. **Linear**: Open tickets where they're reporter/assignee
3. **Calendar**: Meetings with them in next 7 days
4. **Tier**: Match against senderTiers config

Cache context within session to avoid duplicate lookups.

```
✓ CHECKPOINT: Step 3 complete - Gather Sender Context
  Senders with context: [N] | Exec: [N] | Team: [N] | External: [N]

Proceeding to Step 4: Analyze Each Thread
```

### Step 4: Analyze Each Thread

**Conversation State**:
- **Awaiting you**: Their last message, no reply from you -> needs action
- **Awaiting them**: Your last message, waiting for reply -> no action needed
- **Stale**: No activity >7 days -> may need follow-up

**Deadline Detection** (scan subject + body):
- Explicit dates: "January 30", "1/30", "30th"
- Relative: "by EOD", "by Friday", "end of week", "tomorrow"
- Urgency markers: "ASAP", "urgent", "time-sensitive"
- Cross-reference mentioned dates with calendar

**SLA Status**:
- Calculate hours since last message from sender
- Flag if exceeds `slaHoursInternal` (team) or `slaHoursExternal`

```
✓ CHECKPOINT: Step 4 complete - Analyze Each Thread
  Awaiting you: [N] | Awaiting them: [N] | Stale: [N] | SLA breaches: [N]

Proceeding to Step 5: Apply Rules
```

### Step 5: Apply Rules

**Auto-Delete** (from config):
- Match `from` and/or `subject` patterns
- Respect `unless` conditions
- If matches exceed `bulkActionThreshold`: confirm before deleting
- Skip any matching `alwaysKeep` rules

**Always Keep**:
- Never auto-delete these patterns
- Still categorize normally

```
✓ CHECKPOINT: Step 5 complete - Apply Rules
  Auto-delete candidates: [N] | Always-keep matched: [N]

Proceeding to Step 6: Categorize Remaining
```

### Step 6: Categorize Remaining

Categorize each remaining email. Only **Respond** and **Snooze** items stay in the inbox — everything else is archived after being noted in the triage summary.

| Category | Description | Inbox Action |
|----------|-------------|-------------|
| **Respond** | Awaiting you, needs reply | **Stays unread in inbox** |
| **Review** | Needs attention but no reply (PR reviews, doc comments, FYI) | Noted in summary, then **archived** |
| **Delegate** | Should be handled by someone else (suggest who) | Noted in summary with delegate target, then **archived** |
| **Archive** | No action needed, keep for reference | **Archived** |
| **Snooze** | Needs action later (prompt for date) | **Stays in inbox** (tracked in config) |
| **Delete** | No value (confirm before acting) | **Trashed** |

**The goal of triage is an empty inbox except for items requiring your direct response.** Everything else has been captured in the triage summary and daily context — it does not need to occupy inbox space.

```
✓ CHECKPOINT: Step 6 complete - Categorize Remaining
  Respond: [N] | Review: [N] | Delegate: [N] | Archive: [N] | Snooze: [N] | Delete: [N]

Proceeding to Step 7: Generate Drafts
```

### Step 7: Generate Drafts

For each "Respond" item:
1. Analyze thread context and tone
2. Generate appropriate draft response
3. Offer to save as Gmail draft or display inline

Draft options:
- **Save to Gmail**: Creates draft in Gmail (editable there)
- **Display only**: Show in output (copy/paste)
- **Both**: Save and display

```
✓ CHECKPOINT: Step 7 complete - Generate Drafts
  Drafts generated: [N]

Proceeding to Step 8: Present Summary & Act
```

### Step 8: Present Summary & Act (⚠️ DESTRUCTIVE)

**⚠️ This step includes destructive operations - delete and archive cannot be easily undone.**

```
⚠️  DESTRUCTIVE STEP: Bulk actions will delete [N] and archive [N] emails.
    Deleted emails recoverable from Trash for 30 days.
    Progress saved. Resume with: /triage-inbox --resume
```

Present summary and confirm bulk actions before executing.

**Execute in this order:**

1. **Trash** all "Delete" category emails (auto-delete rule matches + manually categorized)
2. **Archive** all "Review", "Delegate", and "Archive" category emails — these have been noted in the triage summary and do not need to remain in the inbox
3. **Leave in inbox**: Only "Respond" and "Snooze" items remain unread
4. **Update `lastTriageDate`** in email-rules.json

**After execution, verify**: Search `is:unread in:inbox` and confirm only Respond/Snooze items remain. If unexpected emails remain, categorize and archive them.

```
✓ CHECKPOINT: Step 8 complete - Present Summary & Act
  Deleted: [N] | Archived: [N] | Labeled: [N] | Drafts saved: [N]
```

## Final Summary

After ALL 8 steps complete, display:

```
# Email Triage Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Load Config       ✓ 2. Fetch Emails    ✓ 3. Gather Context
✓ 4. Analyze Threads   ✓ 5. Apply Rules     ✓ 6. Categorize
✓ 7. Generate Drafts   ✓ 8. Execute Actions

## Key Results
- **Processed**: [N] emails across [N] threads
- **SLA breaches**: [N]
- **Deleted**: [N] | **Archived**: [N]
- **Respond pending**: [N] (drafts saved)

---
Email triage complete.
```

## Output Format

```
## Triage Summary

**Inbox**: 47 emails across 23 threads
**SLA Alerts**: 2 threads waiting >24h
**Auto-processed**: 12 deleted, 5 archived

---

### SLA Breaches (2)

#### Thread: Q1 Budget Review (3 messages) - 36h waiting
- **From**: Joel Patrick (exec)
- **Status**: Awaiting you
- **Last**: "Can you review the engineering allocation?"
- **Context**: No meetings scheduled, 1 open Linear ticket (ENG-456)
- **Draft**: "Hi Joel, I've reviewed the allocation..."
-> [Save draft] [Send now] [Snooze]

---

### Respond (4) - P1

#### Thread: API Migration Timeline (5 messages)
- **From**: Sarah Masters (team)
- **Status**: Awaiting you - 4h
- **Deadline**: "by Friday" detected
- **Context**: Meeting tomorrow 10am, 2 open tickets
- **Draft**: "Hi Sarah, I can confirm the timeline..."
-> [Save draft] [Send now] [Snooze]

...

---

### Awaiting Reply (3) - No action needed

These threads are waiting on others to respond:

| Thread | Sent | To | Days waiting |
|--------|------|----|--------------|
| Vendor contract | Jan 23 | legal@vendor.com | 3 |
| Conference CFP | Jan 20 | submissions@conf.io | 6 (stale) |

---

### Review (2) - P2

#### PR Review: feat/new-dashboard
- **From**: GitHub (leonardo.maglio)
- **Action**: Review requested
-> [Open PR] [Archive]

---

### Snooze (1)

#### Thread: Conference proposal
- **Snooze until**: Feb 1 (submission deadline Feb 15)
- **Reminder**: "Submit abstract"
-> [Change date] [Unsnooze]

---

### Archive (8)

| Subject | From | Reason |
|---------|------|--------|
| Weekly digest | notifications@... | FYI only |
| ... | ... | ... |

-> [Archive all 8]

---

### Delete (4)

| Subject | From | Rule matched |
|---------|------|--------------|
| Successfully published @apolitical/core | npm | npm publish |
| ... | ... | ... |

-> [Delete all 4] (recoverable from Trash for 30 days)

---

## Bulk Actions

- [ ] Archive all 8 "Archive" items
- [ ] Delete all 4 "Delete" items
- [ ] Apply labels to categorized items
- [ ] Save all drafts to Gmail
```

## Snooze Implementation

Since Gmail API lacks native snooze, track in config file:

1. When snoozing, add to `snoozed` array in config:
   ```json
   {
     "messageId": "abc123",
     "threadId": "thread456",
     "subject": "Conference proposal",
     "snoozeUntil": "2026-02-01T09:00:00Z",
     "reminder": "Submit abstract"
   }
   ```

2. At triage start, check snoozed items:
   - If `snoozeUntil` has passed -> include in triage as "Snoozed (due)"
   - Remove from snoozed array after processing

3. Snooze options:
   - Tomorrow morning (9am)
   - Next week (Monday 9am)
   - Custom date/time
   - Before specific event (cross-reference calendar)

## Label Management

On first run or when labels configured:

1. Fetch existing Gmail labels via `gmail_list_labels`
2. Compare against `labels` config
3. If missing labels found:
   ```
   The following labels don't exist in Gmail:
   - needs-response
   - awaiting-reply

   Create them? [y/N]
   ```

## Performance Modes

| Mode | Context | Threading | Drafts | Use case |
|------|---------|-----------|--------|----------|
| Default | Yes | Full | Yes | Daily triage |
| `--quick` | No | Full | No | Fast categorization |
| `--backlog` | No | Grouped | No | Clearing large inbox |
| `--since-last` | Yes | Full | Yes | Incremental triage |

## Integration with Other Skills

### Morning Briefing

`/morning-briefing` should reference triage state:
- "Last triaged: yesterday 3pm (14 emails processed)"
- "12 emails since last triage"
- "2 SLA breaches requiring attention"

### State Persistence

After each triage, update config:
```json
{
  "lastTriageDate": "2026-01-26T15:30:00Z",
  "lastTriageStats": {
    "processed": 47,
    "responded": 4,
    "archived": 12,
    "deleted": 8
  }
}
```

## Safety & Recovery

### Bulk Action Confirmation

If action count exceeds `bulkActionThreshold`:
```
About to delete 12 emails. This exceeds threshold (5).
Confirm? [y/N]
```

### Recovery

- **Deleted items**: Recoverable from Gmail Trash for 30 days
- **Archived items**: Searchable in Gmail, can be moved back to inbox
- **Snooze data**: Stored in config file, can be manually edited

### Never Auto-Delete

Even if matching auto-delete rules:
- Emails matching `alwaysKeep` patterns
- Emails from exec tier senders
- Emails with detected deadlines
- Emails you've replied to (you're in the conversation)

## Automated Deletes (Default Rules)

Rules are defined in `.claude/email-rules.json`. Current auto-delete rules:

- **Snyk vulnerability alerts** - CC'd only, platform team handles directly
- **GCP alerts showing RESOLVED** - Transient issues that auto-recovered
- **Recruiter cold outreach** (roc-search.com, etc.)
- **Vendor cold outreach** (artiework.com, hekahappy.com, etc.)

Additional common patterns (add to config as needed):
- npm publish notifications (`Successfully published @apolitical/*`)
- GitHub Actions success notifications
- Linear notification emails (if using Slack for Linear)
- Calendar RSVP confirmations (accepted/declined/tentative)

## Always Keep (Default Rules)

Never auto-delete, always surface:
- Emails from exec team
- Gemini meeting notes
- Google Doc comments/mentions
- Anything with your name or @mentions in body

## Update Daily Context

After triage, update `context/YYYY-MM-DD/index.md`:

```markdown
## Email Triage (HH:MM)
- **Processed**: X emails across Y threads
- **Trashed**: X
- **Archived**: X
- **Respond**: X items pending
- **SLA breaches**: X
- **Key senders**: [list any exec/priority senders with pending items]
```

Create the daily context file if it doesn't exist. Append a new Email Triage section (timestamped) if running multiple times per day.

## Notes

- Threading groups related emails; reply to thread not individual messages
- "Awaiting them" threads shown separately - no action needed from you
- Drafts can be saved to Gmail for later editing/sending
- Snooze state persists in config file across sessions
- Run with `--quick` if context gathering is slow
- Large backlogs: use `--backlog` mode with pagination
- Daily context file accumulates email triage summaries throughout the day

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to email-rules.json (triage state)
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /triage-inbox --resume"

### Resume Behavior

When `/triage-inbox --resume` is run:
1. Check email-rules.json for incomplete triage state
2. Restore categorization and drafts from previous run
3. Skip to Step 8 (Present Summary & Act) to complete actions
4. Clear triage state after completion

## Mode Reference

| Flag | Steps Run | Destructive Step | Use Case |
|------|-----------|------------------|----------|
| (none) | All 8 | Step 8 executes | Normal triage |
| `--quick` | 1, 2, 4, 5, 6, 8 | Step 8 executes | Fast, no context |
| `--backlog` | 1, 2, 5, 6, 8 | Step 8 executes | Large inbox |
| `--since-last` | All 8 | Step 8 executes | Incremental |
| `--resume` | Remaining | If not done | Recovery |

### Step Summary by Mode

| Step | Default | --quick | --backlog |
|------|:-------:|:-------:|:---------:|
| 1. Load Config | ✓ | ✓ | ✓ |
| 2. Fetch Emails | ✓ | ✓ | ✓ |
| 3. Gather Context | ✓ | - | - |
| 4. Analyze Threads | ✓ | ✓ | - |
| 5. Apply Rules | ✓ | ✓ | ✓ |
| 6. Categorize | ✓ | ✓ | ✓ |
| 7. Generate Drafts | ✓ | - | - |
| 8. Execute Actions ⚠️ | ✓ | ✓ | ✓ |
