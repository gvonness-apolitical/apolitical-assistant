# End of Day Summary

Wrap up the day with a summary and handoff notes.

## Usage

- `/end-of-day` - generate EOD summary

## Core Patterns Used

- [Local Context First](../patterns/local-context-first.md) - Read accumulated daily context
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for EOD file
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Read Daily Context

Before gathering fresh data, read accumulated context from today:

1. **Daily context index**: Read `context/YYYY-MM-DD/index.md` for:
   - Morning briefing summary
   - Slack read summaries
   - Email triage results
   - Action items found
   - Session notes
2. **Session context**: Check `context/YYYY-MM-DD/session.md` for notes
3. **Morning briefing**: Check `briefings/YYYY-MM-DD.md` for planned items

This reduces API calls and captures context already gathered during the day.

## Gather Additional Context

Only fetch what's not already in daily context:

1. **Calendar**: What meetings happened today
2. **Email**: What was sent/received today (if not already triaged)
3. **Slack**: Key conversations and decisions (if not already read)
4. **Linear**: Tickets completed, started, or updated
5. **GitHub**: PRs merged, reviewed, or commented on

## Output Structure

### Completed Today
- Meetings attended and outcomes
- Decisions made
- Items closed/resolved

### In Progress
- Items started but not finished
- Waiting on others
- Blocked items

### Carry Forward
- Items for tomorrow
- Follow-ups needed
- Deadlines approaching

### Notes for Tomorrow
- Context that would be useful to remember
- Threads to monitor
- People to follow up with

Save to `context/eod-YYYY-MM-DD.md`

## Update Daily Context

After generating EOD, update `context/YYYY-MM-DD/index.md`:

```markdown
## End of Day Summary
- **Generated**: TIMESTAMP
- **Completed**: X items
- **In progress**: X items
- **Carry forward**: X items for tomorrow
- **Key decisions**: [list]
```

## Commit Context Files

After all context files are written, commit them to preserve under git-crypt:

```bash
git add context/ briefings/ meetings/output/ reviews/ investigations/ work/ rubberduck/
git commit -m "EOD context: YYYY-MM-DD"
```

**Important**:
- These directories are encrypted with git-crypt - committing ensures they're safely stored
- Don't push automatically - user may want to review or batch with other changes
- If no changes to commit, skip silently

## Notes
- Daily context file should now have full day's accumulated context
- EOD file is the canonical summary for the day
- Carry-forward items will be picked up by tomorrow's morning briefing
- Flag anything urgent that should be in morning briefing tomorrow
- Context files are git-crypt encrypted - commit preserves them securely
