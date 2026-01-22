# What's Blocking

Quick check on what's blocking a person or project.

## Usage
- `/whats-blocking [person]` - what's blocking this person
- `/whats-blocking [project/squad]` - what's blocking this team/project

## For a Person

1. **Linear**: Tickets assigned to them in blocked/waiting states
2. **GitHub**: PRs awaiting review or with requested changes
3. **Slack**: Recent messages asking for help or flagging blockers
4. **Calendar**: Check if they're out or in back-to-back meetings

## For a Project/Squad

1. **Linear**: All blocked tickets in the project
2. **GitHub**: Open PRs with stale reviews or failing CI
3. **Dependencies**: External blockers (vendor, other team, decision needed)

## Output

### Currently Blocked
Table of blocked items with:
- Item (ticket/PR)
- Blocker description
- Who can unblock
- How long blocked

### Waiting On
Items waiting for external input:
- What's needed
- From whom
- When requested

### Recommendations
- Quick wins (things I can help unblock)
- Escalations needed
- Process issues to address

## Notes
- Check if person is on leave (Humaans)
- Note if same blocker appears multiple times (systemic issue)
- Flag if blocking critical path items
