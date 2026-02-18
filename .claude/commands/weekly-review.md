# Weekly Review

Generate a comprehensive end-of-week summary and retrospective.

## Usage

- `/weekly-review` - review the current week (Mon-Fri)
- `/weekly-review [date]` - review week containing that date
- `/weekly-review --resume` - Resume from last completed step if previous run was interrupted

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

For Step 3 (Gather Additional Data), track each source:

```markdown
## Step 3: Gather Additional Data

Sources:
- [x] Calendar - 12 meetings found
- [x] GitHub - 8 PRs reviewed
- [x] Linear - 15 tickets completed
- [ ] Slack - (in progress...)
- [ ] Email
- [ ] Incidents
- [ ] Humaans
- [ ] Figma

If interrupted: Resume retries incomplete sources, skips completed ones.
```

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/weekly-review --resume`

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume
- [Local Context First](../patterns/local-context-first.md) - Read daily context files first
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for review file
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Process

### Step 1: Determine Week Range

Parse the date argument (if provided) or use current week:
- Identify Monday-Friday of the target week
- Confirm the date range with user if ambiguous

```
✓ CHECKPOINT: Step 1 complete - Determine Week Range
  Week: Mon YYYY-MM-DD to Fri YYYY-MM-DD

Proceeding to Step 2: Read Daily Context Files
```

### Step 2: Read Daily Context Files

Before making API calls, read accumulated context from the week:

1. **Daily context directories**: `context/YYYY-MM-DD/index.md` for Mon-Fri
   - Morning briefing summaries
   - Slack read summaries
   - Email triage results
   - Action items found
2. **EOD files**: `context/eod-YYYY-MM-DD.md` for Mon-Fri
   - Completed items each day
   - Decisions made
   - Carry-forward items
3. **Morning briefings**: `briefings/YYYY-MM-DD.md` for Mon-Fri
   - Meetings attended
   - P1 items flagged
4. **Session context files**: `context/YYYY-MM-DD/session.md` for Mon-Fri
   - Detailed notes and decisions

This provides a comprehensive view with minimal API calls.

```
✓ CHECKPOINT: Step 2 complete - Read Daily Context Files
  Days with context: [N]/5 | EODs found: [N] | Briefings found: [N]

Proceeding to Step 3: Gather Additional Data
```

### Step 3: Gather Additional Data

Track each source as it completes:

1. **Calendar**: All meetings attended this week
2. **GitHub**: PRs reviewed, merged, or commented on
3. **Linear**: Tickets completed, moved, or created
4. **Slack**: Key threads participated in (search my messages)
5. **Email**: Important threads sent/received
6. **Incidents**: Any incidents this week and their status
7. **Humaans**: Team changes, who was out
8. **Figma**: Design files shared this week
   - Load `.claude/figma-sources.json`
   - Filter files with `lastShared` within the week
   - Group by category and owner
9. **Asana**: Cross-functional work during the week
   - Load `.claude/asana-sources.json`
   - Tasks completed or modified during the week (use `asana_search_tasks`)
   - Goal progress updates
   - Frame as "cross-functional completions" — distinct from Linear engineering work

```
✓ CHECKPOINT: Step 3 complete - Gather Additional Data
  Calendar: [N] | GitHub: [N] | Linear: [N] | Slack: [N] | Email: [N] | Incidents: [N] | Figma: [N] | Asana: [N]

Proceeding to Step 4: Generate Review
```

### Step 4: Generate Review

### Week of [DATE RANGE]

### Accomplishments
- Key things shipped or completed
- Decisions made
- Problems solved

### Meetings Summary
Table of meetings attended:
| Day | Meeting | Attendees | Outcome/Notes |
By category: 1:1s, planning, reviews, external, other

### Work Reviewed
- PRs reviewed with brief notes
- Documents reviewed
- Designs or proposals reviewed

### Design Activity
Figma files shared this week:
| File | Owner | Category | Channel |
- Note any major design work or updates

### Cross-Functional Work (Asana)
Asana tasks completed or progressed this week:
| Task | Project | Status | Completed |
- Goal progress updates
- Note any cross-functional milestones

### Team Activity
- Who was out and when
- Notable team accomplishments
- Any escalations or support provided

### Incidents
- Any incidents that occurred
- Current status and follow-ups owned

### Blockers & Risks
- Issues that arose
- Things still unresolved
- Risks to flag

### Next Week
- Known priorities
- Upcoming important meetings
- Items to follow up on

### Reflection
- What went well
- What could be improved
- Time allocation analysis (meetings vs deep work)

```
✓ CHECKPOINT: Step 4 complete - Generate Review
  Sections populated: [N]

Proceeding to Step 5: Save Review
```

### Step 5: Save Review

Save to `reviews/weekly/YYYY-MM-DD.md`

Add YAML frontmatter:
```yaml
---
type: review
date: YYYY-MM-DD
period: week
tags: []
---
```

```
✓ CHECKPOINT: Step 5 complete - Save Review
  Saved to: reviews/weekly/YYYY-MM-DD.md
```

## Final Summary

After ALL 5 steps complete, display:

```
# Weekly Review Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Determine Week    ✓ 2. Read Context    ✓ 3. Gather Data
✓ 4. Generate Review   ✓ 5. Save Review

## Key Results
- **Week**: Mon YYYY-MM-DD to Fri YYYY-MM-DD
- **Accomplishments**: [N] items
- **Meetings**: [N] attended
- **PRs reviewed**: [N]
- **Tickets completed**: [N]
- **Incidents**: [N]

## Saved to
reviews/weekly/YYYY-MM-DD.md

---
Weekly review complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /weekly-review --resume"

### Resume Behavior

When `/weekly-review --resume` is run:
1. Check daily context for incomplete weekly review
2. Skip completed steps
3. For Step 3 (Gather Data), resume from first incomplete source
4. Continue from first incomplete step

## Notes
- Include links to relevant tickets, PRs, docs where helpful
- Flag if time in meetings exceeded 50% of the week
- Note any patterns (e.g., repeated blockers, meeting types consuming time)
