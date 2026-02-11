# Update Todos

Gather action items and requests from all systems where you've been tagged, mentioned, or assigned work.

## Usage

- `/update-todos` - Full scan of all sources
- `/update-todos --quick` - Quick scan (canvases and Slack only)
- `/update-todos --source [source]` - Scan specific source (canvases, slack, email, notion, google)
- `/update-todos --resume` - Resume from last completed source if previous run was interrupted

## Checkpoint Discipline

**Complete each source before moving to the next.**

After each source completes, output a checkpoint marker:

```
✓ CHECKPOINT: Source complete - [source name]
  Items found: [N]

Proceeding to Source: [next source name]
```

If a source is skipped (due to mode flag or error), note it explicitly:

```
⊘ CHECKPOINT: Source skipped - [source name] ([reason])

Proceeding to Source: [next source name]
```

**Progress tracking with per-source status:**
```markdown
## Scanning Sources

Sources:
- [x] Canvases - 4 items found
- [x] Slack - 3 items found
- [ ] Email - (in progress...)
- [ ] Notion
- [ ] Google Docs

If interrupted: Resume retries incomplete sources, skips completed ones.
```

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/update-todos --resume`

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Per-source tracking and resume
- [Person Resolution](../patterns/person-resolution.md) - Detect mentions using your Slack ID
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Rate Limiting](../patterns/rate-limiting.md) - Batch API calls efficiently
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Sources

### Source 1: Slack Canvases (from meeting-config.json)

Scan all configured canvases for action items assigned to you.

1. **Load config**: Read `.claude/meeting-config.json`
2. **Gather canvas IDs**:
   - All `canvasId` values from `channels` section
   - All `canvasId` values from `oneOnOnes` section
   - Skip entries where `canvasId` is null
3. **Read each canvas**: Use `slack_get_canvas` for each ID
4. **Extract action items** assigned to you:
   - Tagged with `@U08EWPC9AP9` or `@greg`
   - Prefixed with `GvN -` or `Greg -`
   - In "Open" or unchecked sections
   - Pattern: `- [ ]` followed by your tag/name
5. **Categorize**:
   - Open (unchecked, no blocker)
   - Blocked (marked as blocked or waiting)
   - Overdue (has date that's passed)
6. **Track source**: Note which canvas/meeting each item came from

```
✓ CHECKPOINT: Source complete - Canvases
  Items found: [N] | Open: [N] | Blocked: [N] | Overdue: [N]

Proceeding to Source: Slack Messages
```

### Source 2: Slack Messages

Search for messages where you've been mentioned or tagged with requests.

1. **Search mentions**: Use `slack_search` for `<@U08EWPC9AP9>`
2. **Check priority private channels**: Load `.claude/channels-config.json` and explicitly read recent messages from high-priority channels (especially `priv-management-team`, `priv-managers`) for action items
3. **Time window**: Last 7 days (or since last `/update-todos` run)
3. **Filter for actionable**:
   - Contains question directed at you
   - Contains request patterns: "can you", "could you", "please", "need you to"
   - Contains TODO/action patterns
   - Excludes: FYI mentions, thank you messages, completed threads
4. **Check thread status**:
   - If in thread, check if you've already replied
   - Skip if thread is resolved/closed
5. **Extract context**:
   - Channel/DM name
   - Sender
   - Message preview
   - Link to message

```
✓ CHECKPOINT: Source complete - Slack Messages
  Items found: [N] | Questions: [N] | Requests: [N]

Proceeding to Source: Gmail Inbox
```

### Source 3: Gmail Inbox

Scan inbox for emails requiring action.

1. **Load email rules**: Read `.claude/email-rules.json` for auto-delete/archive patterns
2. **Search queries**:
   - `is:unread in:inbox` - Unread inbox items
   - `is:starred` - Starred for follow-up
   - `label:action-required` - If label exists
3. **Time window**: Last 7 days for unread, last 30 days for starred
4. **Skip auto-delete patterns**: Exclude emails matching `autoDelete` rules (e.g., Snyk alerts, GCP resolved alerts, recruiter spam)
5. **Categorize emails**:
   - **Respond**: Needs reply (question asked, response requested)
   - **Review**: Needs attention (shared doc, FYI with action)
   - **Approve**: Waiting for approval/sign-off
   - **Delegate**: Should forward to someone else
4. **Extract**:
   - Subject
   - Sender
   - Preview snippet
   - Priority (based on sender, keywords)

```
✓ CHECKPOINT: Source complete - Gmail Inbox
  Items found: [N] | Respond: [N] | Review: [N] | Approve: [N]

Proceeding to Source: Notion
```

### Source 4: Notion

Find pages where you've been mentioned or assigned.

1. **Check priority sources first** (load from `.claude/notion-sources.json`):
   - **RFCs**: Comments tagging you on proposals needing review/input
   - **PRDs**: Comments or action items assigned to you
2. **Search for mentions**: Use `notion-search` for your name/email
3. **Check comments**: Look for unresolved comments tagging you
4. **Check databases**:
   - Tasks/tickets assigned to you
   - Action items with your name
5. **Filter**:
   - Unresolved/open items only
   - Last 30 days
6. **Extract**:
   - Page title
   - Comment or task text
   - Link to page

```
✓ CHECKPOINT: Source complete - Notion
  Items found: [N] | RFC comments: [N] | PRD tasks: [N]

Proceeding to Source: Google Workspace
```

### Source 5: Google Workspace

Find docs where you've been tagged for comments or suggestions.

1. **Google Docs**:
   - Use `docs_get_comments` for recently accessed docs
   - Find unresolved comments mentioning you
   - Check for suggested edits awaiting your review

2. **Google Sheets**:
   - Check for comments in shared sheets
   - Look for cells with notes tagging you

3. **Google Slides**:
   - Check for comments in presentations
   - Speaker notes with action items

4. **Drive search**:
   - Use `drive_search` for recent shared items
   - Filter by `modifiedTime` in last 7 days
   - Check items shared with you that you haven't opened

```
✓ CHECKPOINT: Source complete - Google Workspace
  Items found: [N] | Doc comments: [N] | New shares: [N]

All sources complete. Proceeding to Deduplication.
```

## Deduplication

Before adding items to the todo list:

1. **Check existing tasks**: Use `TaskList` to get current todos
2. **Match by content**: Fuzzy match task subjects
3. **Match by source**: Same Slack message ID, email ID, or doc URL
4. **Skip duplicates**: Don't create duplicate tasks
5. **Update if changed**: If item exists but details changed, note the update

## Priority Assignment

Assign priority to each item based on these rules (in order):

| Priority | Criteria |
|----------|----------|
| **P0** | Active incidents, security issues, exec requests |
| **P1** | Direct questions awaiting response, blocking others, same-day deadlines |
| **P2** | Action items from canvases, reviews needed, delegate tasks |
| **P3** | FYI items, low-priority reviews, backlog items |

**Priority signals by source:**
- **Slack**: Direct question = P1, mention in thread = P2, FYI = P3
- **Email**: Exec sender = P1, team sender = P2, external = P3
- **Canvases**: Overdue = P1, Open = P2, Paused/Blocked = P3
- **Notion/Docs**: Unresolved comment = P2, shared doc = P3

## Automatic Task Creation

After deduplication, **automatically create tasks** ordered by priority.

**IMPORTANT: Every task MUST include its priority level and sequence number.**

1. **Sort all items** by priority (P0 → P1 → P2 → P3)
2. **Within each priority**, sort by:
   - Slack items first (quick responses)
   - Email items second (delegation, replies)
   - Canvas items third (tracked action items)
   - Notion/Docs last (reviews)
3. **Number items sequentially** across all priorities (P0 items first, then P1, etc.)
4. **Create tasks** using `TaskCreate` with these formatting rules:
   - **subject**: Must start with priority and sequence number: `P0.1: `, `P1.2: `, `P1.3: `, `P2.4: `, etc.
   - **description**: Must start with `Priority: P[N]` on the first line, followed by source and details
   - **activeForm**: Normal present continuous (no prefix needed)
5. **Display numbered list** showing creation order with priorities

### Task Subject Format

```
P{priority}.{sequence}: {brief action description}
```

Examples:
- `P0.1: Submit Samuel probation feedback`
- `P1.2: Sign Yang apprenticeship Docusign`
- `P1.3: Respond to Renzo on RFC comments`
- `P2.8: Follow up on Ilana's data segmentation`
- `P3.11: Data residency meeting setup`

The sequence number is global across all priorities (not per-priority), so you can see both the priority AND the recommended order at a glance.

## Output

### Summary View

```
Todo Update Summary - 2026-01-26
================================

Found 12 new action items (after deduplication):

P1 - HIGH (2 items):
  1. [Slack] @byron asked: Can you review the PR for auth changes?
  2. [Email] Contract review needed - Legal Team (exec sender)

P2 - MEDIUM (7 items):
  3. [Slack] Renzo tagged you in thread about deployment
  4. [Email] Delegate: Q1 Budget proposal - Finance
  5. [Canvas] Schedule follow-up on incident management (Dom 1:1)
  6. [Canvas] Decide and communicate AI budget (Think Tank)
  7. [Canvas] Review segmentation proposal (Data Huddle)
  8. [Notion] Comments requested on API redesign RFC
  9. [Docs] Comment on "Platform Roadmap 2026" needs response

P3 - LOW (3 items):
  10. [Canvas] Follow up on alerting discussion (Sync-up) - paused
  11. [Email] Review: Newsletter digest
  12. [Notion] Assigned: Update runbook documentation

================================
Creating 12 tasks...
```

### Task Creation Output

Tasks are created automatically in priority order:

```
Created 12 tasks (ordered by priority):

P1 - HIGH:
  #1. Review PR for auth changes (from Slack @byron)
  #2. Contract review needed (from Legal Team email)

P2 - MEDIUM:
  #3. Respond to Renzo about deployment (from Slack)
  #4. Delegate Q1 Budget proposal (from Finance email)
  #5. Schedule follow-up on incident management (from Dom 1:1)
  #6. Decide and communicate AI budget (from Think Tank)
  #7. Review segmentation proposal (from Data Huddle)
  #8. Review API redesign RFC comments (from Notion)
  #9. Respond to Platform Roadmap comment (from Google Docs)

P3 - LOW:
  #10. Follow up on alerting discussion (from Sync-up)
  #11. Review Newsletter digest (from Email)
  #12. Update runbook documentation (from Notion)

Recommended: Start with #1 and work down the list.
```

### Detailed View

Use `--detailed` flag for full context on each item:

```
P1 - HIGH:

#1. [Slack] Review PR for auth changes
    Source: #team-engineering (@byron)
    Context: Byron asked for review on auth changes PR
    Link: https://slack.com/...
    Priority: P1 (direct question, blocking)

P2 - MEDIUM:

#5. [Canvas] Schedule follow-up on incident management
    Source: F09FCV0HXFX (Dom 1:1)
    Context: Discussed need for better alerting, Greg to schedule follow-up
    Added: 2026-01-20
    Priority: P2 (canvas action item)
```

## Configuration

Optionally track last run time in `.claude/todo-config.json`:

```json
{
  "lastRun": "2026-01-26T10:30:00Z",
  "sources": {
    "canvases": true,
    "slack": true,
    "email": true,
    "notion": true,
    "google": true
  },
  "slackSearchDays": 7,
  "emailSearchDays": 7,
  "excludeChannels": ["#random", "#social"],
  "excludeSenders": ["notifications@github.com"]
}
```

## Update Daily Context

After scanning, update `context/daily/YYYY-MM-DD.md`:

```markdown
## Action Items (HH:MM)
- **Found**: X new items
- **From canvases**: X
- **From Slack**: X
- **From email**: X
- **From Notion**: X
- **From Google Docs**: X
- **Key items**: [list top 3 priority items]
```

Create the daily context file if it doesn't exist.

## Final Summary

After all sources scanned, deduplicated, and tasks created, display:

```
# Update Todos Complete - YYYY-MM-DD

## Sources Scanned
✓ Canvases   ✓ Slack   ✓ Email   ✓ Notion   ✓ Google

## Key Results
- **Total items found**: [N]
- **Deduplicated**: [N] (already existed)
- **Tasks created**: [N]

## By Priority
- P1 (High): [N] tasks
- P2 (Medium): [N] tasks
- P3 (Low): [N] tasks

## By Source
- Canvases: [N]
- Slack: [N]
- Email: [N]
- Notion: [N]
- Google Docs: [N]

## Recommended Order
Start with task #1 and work down. P1 items should be addressed today.

---
Update todos complete. [N] tasks ready to work.
```

## Error Handling

If any source fails:
1. Log the error and source name
2. Mark source as failed (will retry on resume)
3. Continue with remaining sources
4. Note the failure in the final summary
5. Suggest: "Resume with: /update-todos --resume"

### Resume Behavior

When `/update-todos --resume` is run:
1. Check daily context for incomplete todo scan
2. Skip sources already completed
3. Resume from first incomplete source
4. Merge results with previously found items

## Mode Reference

| Flag | Sources Scanned | Use Case |
|------|-----------------|----------|
| (none) | All 5 | Full scan |
| `--quick` | Canvases, Slack | Fast scan |
| `--source canvases` | Canvases only | Targeted |
| `--source slack` | Slack only | Targeted |
| `--resume` | Remaining | Recovery |

### Source Summary by Mode

| Source | Default | --quick |
|--------|:-------:|:-------:|
| 1. Canvases | ✓ | ✓ |
| 2. Slack | ✓ | ✓ |
| 3. Email | ✓ | - |
| 4. Notion | ✓ | - |
| 5. Google Workspace | ✓ | - |

## Notes

- Run daily as part of morning routine, or before `/morning-briefing`
- **Tasks are created automatically** - no confirmation prompt
- **Tasks are numbered by priority** - P1 first, then P2, then P3
- Items from canvases take priority (explicit action items)
- Slack mentions are filtered for actionable requests only
- Email is categorized by type (respond, review, approve, delegate)
- Deduplication prevents duplicate tasks
- Use `--quick` for fast canvas-only scan
- Tasks created include source reference for context
- Daily context file accumulates action item summaries
- Work through tasks in order (#1 first) for optimal prioritization
