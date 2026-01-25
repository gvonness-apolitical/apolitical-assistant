# Orient

Gather context at the start of a session to be effective as an assistant.

## Usage
- `/orient` - Gather comprehensive context and be ready to assist

## What This Does

Silently gathers context from all systems to understand:
- What's on the schedule today
- What needs attention
- What's currently in progress
- Any active issues or blockers

After gathering, outputs a brief confirmation: "Ready to go."

## Context Gathering

### Calendar
- Today's meetings and events
- Upcoming meetings in next 24 hours
- Who you're meeting with

### Communications
- Unread/flagged emails requiring response
- Active Slack threads with recent activity
- DMs needing attention

### Work in Progress
- Linear tickets assigned or in progress
- Open PRs awaiting review
- PRs you've authored awaiting merge

### Issues & Blockers
- Active incidents from incident.io
- Blocked tickets in Linear
- Outstanding follow-ups from incidents

### Team Context
- Who's out of office today (from Humaans)
- Recent 1:1 action items from canvases

### Strategic Context
- Recent rubberduck sessions (last 7 days)
- Open decisions or threads from previous sessions

## Output

### Session Context File
Writes gathered context to: `context/orient-YYYY-MM-DD-HHMM.md`

This file can be referenced by other skills and persists for the session.

### User Output
Brief confirmation only:
```
Ready to go.
```

If critical items found, may add a one-liner:
```
Ready to go. (1 active incident, 3 emails flagged)
```

## Notes
- Run at the start of any new session for best results
- Context file is gitignored - contains potentially sensitive info
- Subsequent `/orient` calls in same session will refresh context
- Other skills can read the context file if needed
