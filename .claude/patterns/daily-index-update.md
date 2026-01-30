# Daily Index Update Pattern

Maintain a daily context index that accumulates information throughout the day.

## When to Use

- After generating any context-related output (orient, slack-read, triage-inbox, etc.)
- When creating timestamped context files
- When accumulating action items or key information

## Files Involved

- `context/YYYY-MM-DD/index.md` - Main accumulator file
- `.claude/templates/context-index.md` - Template for new index files

## Algorithm

### Step 1: Ensure Day Directory Exists

```
1. Construct path: context/YYYY-MM-DD/
2. Create directory if it doesn't exist
```

### Step 2: Check for Index File

```
1. Check if context/YYYY-MM-DD/index.md exists

IF exists:
  → Read existing content
  → Prepare to append

ELSE:
  → Read template from .claude/templates/context-index.md
  → Replace {{DATE}} placeholder with YYYY-MM-DD
  → Create new index file
```

### Step 3: Add Session Log Entry

Append to the Session Log table:

```markdown
| HH:MM | [Activity Name] | [Brief summary] |
```

Activity names:
- Orient
- Slack Read
- Email Triage
- Todo Update
- Morning Briefing
- Meeting Prep
- End of Day

### Step 4: Update Active Items

Merge new items with existing:

```markdown
### Action Items
- [ ] New action item from this activity
- [ ] Existing item (preserved)

### Awaiting Response
- New item waiting on response
- Existing item (preserved)

### Blocked
- New blocker identified
- Existing blocker (preserved)
```

Deduplication:
- Check for similar items before adding
- Update existing items if more context available

### Step 5: Append Key Context

Add any important information discovered:

```markdown
## Key Context

### [Activity] (HH:MM)
- Key insight or information
- Important context for later reference
```

### Step 6: Update Links

If creating a linked artifact, add to Links section:

```markdown
## Links

- [Morning Briefing](../briefings/YYYY-MM-DD.md)
- [Orient 09:30](orient-0930.md)
- [Slack Summary 10:15](slack-1015.md)
```

## Template Structure

The index template (`.claude/templates/context-index.md`):

```markdown
---
type: context
date: {{DATE}}
---

# Daily Context - {{DATE}}

## Session Log

| Time | Activity | Summary |
|------|----------|---------|

## Active Items

### Action Items
- [ ]

### Awaiting Response
-

### Blocked
-

## Stale Items

Items not updated in 7+ days (moved here during /update-todos):
-

## Key Context

Information accumulated throughout the day.

## Links

- [Morning Briefing](../briefings/{{DATE}}.md)
```

## Example Update

Before (index.md):
```markdown
## Session Log

| Time | Activity | Summary |
|------|----------|---------|
| 09:00 | Orient | Ready. 2 meetings, 5 emails |

## Active Items

### Action Items
- [ ] Review Byron's PR
```

After `/slack-read`:
```markdown
## Session Log

| Time | Activity | Summary |
|------|----------|---------|
| 09:00 | Orient | Ready. 2 meetings, 5 emails |
| 10:30 | Slack Read | 47 msgs processed, 3 action items |

## Active Items

### Action Items
- [ ] Review Byron's PR
- [ ] Respond to Joel about Q1 capacity
- [ ] Check incident follow-up status
```

## Skills Using This Pattern

Skills that write to daily index:
- `/orient` - Appends orient summary
- `/slack-read` - Appends Slack summary
- `/triage-inbox` - Appends email summary
- `/update-todos` - Updates action items, moves stale items
- `/morning-briefing` - Appends briefing link
- `/end-of-day` - Final summary of day
- `/begin-day` - Orchestrates multiple updates

Skills that read from daily index:
- `/find-context` - Checks for recent mentions
- `/prep-meeting` - Uses accumulated context
- `/team-status` - Uses cached info
