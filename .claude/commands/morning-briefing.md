# Morning Briefing

Generate a daily briefing to start the day.

## Usage
- `/morning-briefing` - generate briefing for today

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

## Notes
- Flag any meetings without prep notes in `meetings/output/`
- Highlight if key people are out
- Note any context from previous day's EOD if exists
