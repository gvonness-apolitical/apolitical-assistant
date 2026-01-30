# Catchup

Rebuild context for days you were away, getting the assistant up to speed with everything that happened.

## Usage

- `/catchup` - Catch up on the last 3 working days (default)
- `/catchup 5` - Catch up on the last 5 days
- `/catchup 2026-01-27` - Catch up from a specific date to today
- `/catchup 2026-01-20 2026-01-24` - Catch up for a specific date range
- `/catchup --quick` - Summary only, skip detailed context file creation

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve names in historical data
- [Local Context First](../patterns/local-context-first.md) - Check what context already exists
- [Daily Index Update](../patterns/daily-index-update.md) - Create context files for each day
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for generated files
- [Rate Limiting](../patterns/rate-limiting.md) - Batch historical queries efficiently
- [Error Handling](../patterns/error-handling.md) - Handle API limits and unavailability

## What This Does

Retroactively builds context for days you were away by:
1. Gathering historical data from all systems for each day
2. Creating context files as if you had run `/orient` each day
3. Summarizing key events, decisions, and action items
4. Flagging items that still need attention

## Process

### 1. Determine Date Range

```
IF no arguments:
  → Last 3 working days (skip weekends)

IF single number (e.g., "5"):
  → Last N calendar days

IF single date:
  → From that date to today

IF two dates:
  → Specific range (inclusive)
```

### 2. Check Existing Context

For each day in range:
1. Check if `context/YYYY-MM-DD/` directory exists
2. Check if `context/YYYY-MM-DD/index.md` has content
3. Note which days have partial vs no context
4. Skip days that already have complete context (unless `--force`)

### 3. Gather Historical Data Per Day

For each day needing context:

**Calendar** (Google Calendar):
```
calendar_list_events(
  timeMin: "YYYY-MM-DDT00:00:00Z",
  timeMax: "YYYY-MM-DDT23:59:59Z"
)
```
- Meetings attended
- Attendees and outcomes
- Any meeting notes created

**Email** (Gmail):
```
gmail_search("after:YYYY/MM/DD before:YYYY/MM/DD+1")
```
- Important threads received
- Emails sent (decisions, responses)
- Apply email-rules.json to filter noise

**Slack**:
```
slack_search("from:@me after:YYYY-MM-DD before:YYYY-MM-DD+1")
slack_search("to:@me after:YYYY-MM-DD before:YYYY-MM-DD+1")
```
- Channels with activity
- DMs received
- @mentions and requests
- Threads you participated in

**Linear**:
```
list_issues(filter: {updatedAt: {gte: "YYYY-MM-DD", lte: "YYYY-MM-DD"}})
```
- Tickets updated/completed
- New tickets created
- Status changes
- Comments and decisions

**GitHub**:
```
gh api search/issues?q=involves:USERNAME+updated:YYYY-MM-DD
```
- PRs merged or reviewed
- Issues updated
- CI/CD activity

**Incidents** (incident.io):
```
incidentio_list_incidents(created_after: "YYYY-MM-DD")
```
- Any incidents that day
- Follow-ups assigned
- Postmortems created

**Humaans**:
- Who was out that day
- Any team changes

### 4. Create Context Files

For each day, create:

**`context/YYYY-MM-DD/index.md`**:
```markdown
---
type: context
date: YYYY-MM-DD
generated: catchup
catchup_date: 2026-01-30
---

# Daily Context - YYYY-MM-DD (Reconstructed)

## Session Log

| Time | Activity | Summary |
|------|----------|---------|
| -- | Catchup | Reconstructed from historical data |

## Calendar

| Time | Meeting | Attendees | Notes |
|------|---------|-----------|-------|
| 09:00 | Platform Standup | Team | Sprint planning |
| 14:00 | 1:1 with Joel | Joel | Budget discussion |

## Communications

### Email Highlights
- Received 23 emails, 5 requiring attention
- Sent 8 emails including [topic] to [person]

### Slack Activity
- Active in 12 channels
- 3 DMs received
- 2 @mentions needing response

## Work Activity

### Linear
- Completed: PLT-123, PLT-124
- In Progress: PLT-125 (blocked)
- Created: PLT-126

### GitHub
- Merged: PR #45 (auth changes)
- Reviewed: PR #46, PR #47

## Incidents
- None

## Team
- Out: [names]

## Key Events
- [Significant things that happened]

## Still Needs Attention
- [ ] Unresponded @mention from Byron
- [ ] Review request pending on PR #48
```

**`context/YYYY-MM-DD/catchup-summary.md`**:
Detailed breakdown if `--quick` not used.

### 5. Build Cumulative Summary

After processing all days, create a catchup summary:

**`context/catchup-YYYY-MM-DD.md`**:
```markdown
---
type: context
subtype: catchup
date: 2026-01-30
period: 2026-01-27 to 2026-01-29
days_covered: 3
---

# Catchup Summary - 3 Days

## Overview

| Day | Meetings | Emails | Slack | Linear | Incidents |
|-----|----------|--------|-------|--------|-----------|
| Mon 27 | 5 | 34 | 45 msgs | 8 updates | 0 |
| Tue 28 | 3 | 28 | 32 msgs | 12 updates | 1 |
| Wed 29 | 6 | 41 | 67 msgs | 5 updates | 0 |

## Key Events

### Monday 2026-01-27
- Platform sprint planning completed
- Budget proposal sent to Joel
- Auth RFC approved

### Tuesday 2026-01-28
- INC-45: Brief API outage (resolved)
- Onboarding flow design review
- Q1 OKRs finalized

### Wednesday 2026-01-29
- New starter: Fatimat joined Platform squad
- Deployed v2.3.1 to production
- Monthly business review prep

## Decisions Made
- Auth RFC: Approved with minor changes
- Q1 OKRs: Finalized and shared
- Budget: Awaiting Joel's response

## Still Needs Attention

### High Priority
- [ ] Respond to Joel's budget questions (email, Tue)
- [ ] Review Byron's PR #48 (waiting 2 days)
- [ ] Follow up on INC-45 action items

### Medium Priority
- [ ] Slack thread about search performance (Wed)
- [ ] Renzo asking about Enterprise roadmap (Tue)

### Low Priority
- [ ] FYI: New design system docs shared (Mon)
- [ ] Newsletter signup for AI conference (Wed)

## People to Follow Up With
- Joel: Budget proposal response
- Byron: PR review pending
- Renzo: Enterprise roadmap question

## Context Files Created
- context/2026-01-27/index.md
- context/2026-01-28/index.md
- context/2026-01-29/index.md
```

## Output

### Progress Display

```
Catchup: 2026-01-27 to 2026-01-29 (3 days)
==========================================

Processing 2026-01-27...
  ✓ Calendar: 5 meetings
  ✓ Email: 34 messages (12 important)
  ✓ Slack: 45 messages, 2 @mentions
  ✓ Linear: 8 ticket updates
  ✓ GitHub: 3 PRs
  ✓ Incidents: None
  → Created: context/2026-01-27/index.md

Processing 2026-01-28...
  ✓ Calendar: 3 meetings
  ✓ Email: 28 messages (8 important)
  ✓ Slack: 32 messages, 1 @mention
  ✓ Linear: 12 ticket updates
  ✓ GitHub: 5 PRs
  ⚠ Incidents: 1 (INC-45 - resolved)
  → Created: context/2026-01-28/index.md

Processing 2026-01-29...
  ✓ Calendar: 6 meetings
  ✓ Email: 41 messages (15 important)
  ✓ Slack: 67 messages, 4 @mentions
  ✓ Linear: 5 ticket updates
  ✓ GitHub: 2 PRs
  ✓ Incidents: None
  → Created: context/2026-01-29/index.md

==========================================
Catchup Complete

Summary saved: context/catchup-2026-01-30.md

Key things to know:
1. INC-45 on Tuesday (API outage) - resolved, has follow-ups
2. Auth RFC approved Monday
3. 3 items need your attention (see summary)

Ready to proceed with today's work.
```

### Quick Mode Output

With `--quick`, skip detailed context file creation:

```
Catchup Summary (Quick Mode)
============================

3 days: 2026-01-27 to 2026-01-29

Highlights:
- 14 meetings attended
- 103 emails (35 important)
- 1 incident (INC-45, resolved)
- 25 Linear updates, 10 PRs

Needs Attention (7 items):
1. [P1] Joel's budget email (Tue) - unresponded
2. [P1] Byron's PR #48 (Mon) - review pending
3. [P2] INC-45 follow-ups (Tue)
4. [P2] Renzo's roadmap question (Tue)
...

Run `/catchup` without --quick for full context files.
```

## Configuration

Optional settings in `.claude/catchup-config.json`:

```json
{
  "defaultDays": 3,
  "skipWeekends": true,
  "skipExistingContext": true,
  "priorityThresholds": {
    "emailAgeDays": 2,
    "prReviewAgeDays": 1,
    "slackMentionAgeDays": 1
  }
}
```

## Rate Limiting Considerations

Historical queries can be API-intensive:

1. **Batch by day**: Process one day at a time
2. **Parallelize within day**: Calendar, Email, Slack can run in parallel
3. **Add delays**: Small delay between days to avoid rate limits
4. **Cache results**: If interrupted, resume from last completed day

## Error Handling

### Partial Data Available
```
⚠ Slack API returned partial results for 2026-01-27
  Some older messages may be missing.
  Continuing with available data...
```

### API Unavailable
```
✗ Linear API unavailable
  Skipping Linear data for all days.
  Other sources will still be processed.
```

## Integration with Other Skills

After catchup completes:
- `/orient` will find the new context files
- `/morning-briefing` can reference catchup summary
- `/find-context` searches historical context
- Action items can be picked up by `/update-todos`

## Notes

- Run after returning from vacation or extended absence
- Also useful after MCP server issues caused missed context
- Quick mode is good for a fast overview before diving deep
- Context files are marked as "generated: catchup" to distinguish from live capture
- Existing context files are preserved unless `--force` is used
