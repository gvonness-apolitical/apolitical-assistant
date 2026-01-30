# Morning Briefing

Generate a daily briefing to start the day.

## Usage

- `/morning-briefing` - generate briefing for today
- `/morning-briefing --quick` - briefing from cached data only, no API calls

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve attendee names
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for briefing file
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Quick Mode

When `--quick` flag is provided:

1. Skip all MCP/API calls (calendar, email, Slack, Linear, Humaans)
2. Use only cached data:
   - `context/eod-*.md` - Yesterday's EOD for carry-forward items
   - `context/YYYY-MM-DD/` - Today's accumulated context
   - `people.json` - Team information
   - `linear-cache.json` - Sprint structure
   - `figma-sources.json` - Recent Figma shares
3. Note in output: "Quick briefing - using cached data. Some information may be missing."

Use quick mode when:
- MCP servers are down
- You need a rapid start
- You've already run /orient and have fresh context

## Check Existing Context

Before gathering fresh data, check for existing context:

1. **Previous day's EOD**: Read `context/eod-YYYY-MM-DD.md` for yesterday
   - Carry forward items
   - Context to remember
   - Follow-ups needed
2. **Today's daily context**: Check `context/YYYY-MM-DD/index.md` if exists
   - May have been started by `/orient` or earlier session
3. **Session context**: Check `context/YYYY-MM-DD/session.md` if exists

## Gather Context

1. **Calendar**: Today's meetings with attendees and descriptions
2. **Email**: Unread emails, flagging urgent items
   - Load `.claude/email-rules.json` to filter out auto-delete patterns (Snyk alerts, GCP resolved, recruiter spam)
   - Focus on emails from `senderTiers.priority` and `alwaysKeep` patterns
   - Reference `lastTriageDate` to note if triage is needed
3. **Slack**: Recent DMs and mentions (last 12 hours)
   - Load `.claude/channels-config.json` for priority private channels
4. **Linear**: Tickets assigned to me, blocked items, upcoming due dates
5. **Incidents**: Any active incidents from incident.io
6. **Team**: Who's out today (check Humaans time off)
7. **Figma**: Recent design activity (last 24-48 hours)
   - Check `.claude/figma-sources.json` for recently shared files
   - Note files shared in engineering/product channels

## Output Structure

### Today's Meetings
Table with time, meeting name, attendees, and prep needed flag

### P1 - Action Today
Items requiring response or action today:
- Urgent emails needing replies
- Blocked team members
- Deadlines
- Meeting prep needed

### P2 - This Week
Important but not urgent:
- Upcoming deadlines
- Items to delegate
- Prep for later meetings

### FYI - Monitor
- Active incidents
- Ongoing threads to watch
- Team availability notes
- Recent design shares (Figma files shared in last 24h)

Save to `briefings/YYYY-MM-DD.md`

Add YAML frontmatter:
```yaml
---
type: briefing
date: YYYY-MM-DD
tags: []
---
```

## Update Daily Context Index

After generating the briefing, update `context/YYYY-MM-DD/index.md`:

```markdown
## Morning Briefing Summary
- **Generated**: TIMESTAMP
- **Meetings today**: X (list key ones)
- **Team out**: [names]
- **Active incidents**: X
- **P1 items**: X items requiring action today
- **P2 items**: X items this week
```

Create the index file from template (`.claude/templates/context-index.md`) if it doesn't exist. Append/update the "Morning Briefing Summary" section if it does.

## Notes
- Flag any meetings without prep notes in `meetings/output/`
- Highlight if key people are out
- Reference context from previous day's EOD in output
