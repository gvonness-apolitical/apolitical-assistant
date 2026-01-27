# Morning Briefing

Generate a daily briefing to start the day.

## Usage
- `/morning-briefing` - generate briefing for today

## Check Existing Context

Before gathering fresh data, check for existing context:

1. **Previous day's EOD**: Read `context/eod-YYYY-MM-DD.md` for yesterday
   - Carry forward items
   - Context to remember
   - Follow-ups needed
2. **Today's daily context**: Check `context/daily/YYYY-MM-DD.md` if exists
   - May have been started by `/orient` or earlier session
3. **Session context**: Check `context/YYYY-MM-DD-session.md` if exists

## Gather Context

1. **Calendar**: Today's meetings with attendees and descriptions
2. **Email**: Unread emails, flagging urgent items
3. **Slack**: Recent DMs and mentions (last 12 hours)
4. **Linear**: Tickets assigned to me, blocked items, upcoming due dates
5. **Incidents**: Any active incidents from incident.io
6. **Team**: Who's out today (check Humaans time off)

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

Save to `morning-briefing/YYYY-MM-DD.md`

## Update Daily Context

After generating the briefing, update `context/daily/YYYY-MM-DD.md`:

```markdown
## Morning Briefing Summary
- **Generated**: TIMESTAMP
- **Meetings today**: X (list key ones)
- **Team out**: [names]
- **Active incidents**: X
- **P1 items**: X items requiring action today
- **P2 items**: X items this week
```

Create the file if it doesn't exist. Append/update the "Morning Briefing Summary" section if it does.

## Notes
- Flag any meetings without prep notes in `meetings/output/`
- Highlight if key people are out
- Reference context from previous day's EOD in output
