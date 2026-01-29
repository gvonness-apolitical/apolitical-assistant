# Begin Day

Start the workday with a complete morning workflow: handoff, todos, email triage, and briefing.

## Usage

- `/begin-day` - Full morning workflow
- `/begin-day --quick` - Skip email triage (handoff + todos + briefing only)

## Workflow Steps

Execute these steps in order:

### Step 1: Session Handoff (if applicable)

Check for and process any session handoff from yesterday or earlier today:

1. **Check for handoff file**: Look for `context/YYYY-MM-DD/session-handoff.md` (today's date)
2. **If exists**:
   - Read the file
   - Display the immediate task and context summary
   - **Delete the file** after reading (it's ephemeral)
   - Note any carry-forward items for the briefing
3. **If not exists**: Continue to next step

### Step 2: Update Todos

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

### Step 3: Email Triage

Process inbox and categorize emails:

1. **Run email triage** (equivalent to `/triage-inbox`):
   - Load email rules from `.claude/email-rules.json`
   - Fetch unread emails (default 50)
   - Apply auto-delete rules
   - Categorize: Respond, Review, Delegate, Archive, Delete
   - Generate drafts for "Respond" items
2. **Execute bulk actions** with confirmation
3. **Output**: Triage summary with SLA breaches highlighted

Skip this step if `--quick` flag is used.

### Step 4: Morning Briefing

Generate the daily briefing:

1. **Check previous day's EOD**: Read `context/eod-YYYY-MM-DD.md` for yesterday
   - Carry-forward items
   - Context to remember
   - Follow-ups needed
2. **Gather context**:
   - Calendar: Today's meetings
   - Email: Key items from triage (or fresh if `--quick`)
   - Slack: Recent DMs and mentions
   - Linear: Assigned tickets, blocked items
   - Incidents: Active incidents
   - Team: Who's out today
3. **Generate briefing** with:
   - Today's meetings table
   - P1 - Action Today
   - P2 - This Week
   - FYI - Monitor
4. **Save to**: `briefings/YYYY-MM-DD.md`
5. **Update daily context index**

## Output Structure

### Combined Summary

```
# Begin Day - 2026-01-29

## Session Handoff
[If applicable: summary of handoff context and immediate tasks]

---

## Action Items Found (Step 2)
- **Total**: X new items
- From canvases: X
- From Slack: X
- From email: X
- From Notion: X
- From Google Docs: X

[Summary table of key items]

---

## Email Triage (Step 3)
- **Processed**: X emails across Y threads
- **Auto-processed**: X deleted, Y archived
- **SLA Breaches**: X threads waiting >24h
- **Respond**: X items pending
- **Review**: X items

[SLA breaches and key items highlighted]

---

## Morning Briefing (Step 4)

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

Ready for the day!
```

## Update Daily Context

After completing all steps, update `context/YYYY-MM-DD/index.md`:

```markdown
## Begin Day (HH:MM)
- **Handoff**: [Processed / None]
- **Todos found**: X new items
- **Email triage**: X processed, Y respond, Z SLA breaches
- **Briefing**: Generated
- **Meetings today**: X
- **P1 items**: X
```

Create the day directory and index file if they don't exist.

## Error Handling

If any step fails:
1. Log the error
2. Continue with remaining steps
3. Note the failure in the final summary
4. Suggest manual recovery (e.g., "Run `/triage-inbox` separately if email integration is down")

## Timing

This is a comprehensive workflow. For faster startup:
- Use `--quick` to skip email triage
- Run `/orient` instead for a lightweight context snapshot

## Notes

- This skill is designed for the start of a workday
- Each sub-step writes to daily context, so partial runs still capture progress
- Handoff file is deleted after processing to prevent reprocessing
- Email triage may generate drafts - review before sending
- Briefing incorporates context from all previous steps
