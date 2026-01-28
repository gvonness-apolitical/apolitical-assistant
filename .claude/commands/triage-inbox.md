# Email Triage

Review inbox and categorise emails for action.

## Usage

- `/triage-inbox` - Triage unread emails (default: 50)
- `/triage-inbox [count]` - Triage specific number of emails
- `/triage-inbox --quick` - Fast triage without cross-system context
- `/triage-inbox --since-last` - Only emails since last triage
- `/triage-inbox --backlog` - Handle large inbox (paginated, no context)

## Configuration

Rules are stored in `.claude/email-rules.json`. Copy from `.claude/email-rules.example.json` to customize.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `slaHoursInternal` | 24 | Hours before internal emails show SLA warning |
| `slaHoursExternal` | 48 | Hours before external emails show SLA warning |
| `bulkActionThreshold` | 5 | Confirm before bulk actions exceeding this count |
| `defaultLimit` | 50 | Default number of emails to fetch |
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

### 1. Load Configuration

1. Read `.claude/email-rules.json` (create from example if missing)
2. Check for snoozed emails that are now due
3. If `--since-last`, use `lastTriageDate` as cutoff

### 2. Fetch & Group Emails

1. Search Gmail for unread/recent emails
2. Group by thread using Gmail's `threadId`
3. For each thread, fetch all messages to understand conversation state
4. Apply pagination if count exceeds limit (show progress)

### 3. Gather Sender Context (skip with --quick)

For each unique sender (excluding auto-delete matches):

1. **Slack**: Recent DMs (last 7 days)
2. **Linear**: Open tickets where they're reporter/assignee
3. **Calendar**: Meetings with them in next 7 days
4. **Tier**: Match against senderTiers config

Cache context within session to avoid duplicate lookups.

### 4. Analyze Each Thread

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

### 5. Apply Rules

**Auto-Delete** (from config):
- Match `from` and/or `subject` patterns
- Respect `unless` conditions
- If matches exceed `bulkActionThreshold`: confirm before deleting
- Skip any matching `alwaysKeep` rules

**Always Keep**:
- Never auto-delete these patterns
- Still categorize normally

### 6. Categorize Remaining

- **Respond** - Awaiting you, needs reply
- **Review** - Needs attention but no reply (PR reviews, doc comments, FYI)
- **Delegate** - Should be handled by someone else (suggest who)
- **Archive** - No action needed, keep for reference
- **Snooze** - Needs action later (prompt for date)
- **Delete** - No value (confirm before acting)

### 7. Generate Drafts

For each "Respond" item:
1. Analyze thread context and tone
2. Generate appropriate draft response
3. Offer to save as Gmail draft or display inline

Draft options:
- **Save to Gmail**: Creates draft in Gmail (editable there)
- **Display only**: Show in output (copy/paste)
- **Both**: Save and display

### 8. Present Summary & Act

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
