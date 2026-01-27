# Weekly Review

Generate a comprehensive end-of-week summary and retrospective.

## Usage
- `/weekly-review` - review the current week (Mon-Fri)
- `/weekly-review [date]` - review week containing that date

## Read Daily Context Files First

Before making API calls, read accumulated context from the week:

1. **Daily context files**: `context/daily/YYYY-MM-DD.md` for Mon-Fri
   - Morning briefing summaries
   - Slack read summaries
   - Email triage results
   - Action items found
2. **EOD files**: `context/eod-YYYY-MM-DD.md` for Mon-Fri
   - Completed items each day
   - Decisions made
   - Carry-forward items
3. **Morning briefings**: `morning-briefing/YYYY-MM-DD.md` for Mon-Fri
   - Meetings attended
   - P1 items flagged
4. **Session context files**: `context/YYYY-MM-DD-session.md` for Mon-Fri
   - Detailed notes and decisions

This provides a comprehensive view with minimal API calls.

## Gather Additional Data

1. **Calendar**: All meetings attended this week
2. **GitHub**: PRs reviewed, merged, or commented on
3. **Linear**: Tickets completed, moved, or created
4. **Slack**: Key threads participated in (search my messages)
5. **Email**: Important threads sent/received
6. **Incidents**: Any incidents this week and their status
7. **Humaans**: Team changes, who was out

## Output Structure

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

## Save Location

Save to `context/weekly-review-YYYY-MM-DD.md`

## Notes
- Include links to relevant tickets, PRs, docs where helpful
- Flag if time in meetings exceeded 50% of the week
- Note any patterns (e.g., repeated blockers, meeting types consuming time)
