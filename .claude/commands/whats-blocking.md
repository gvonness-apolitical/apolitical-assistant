# What's Blocking

Quick check on what's blocking a person or project.

## Usage

- `/whats-blocking [person]` - what's blocking this person
- `/whats-blocking [project/squad]` - what's blocking this team/project

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve person to identifiers
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Progressive Discovery](../patterns/progressive-discovery.md) - Cache discovered GitHub/Linear IDs
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Person Resolution

When checking blockers for a person, use `.claude/people.json`:

1. **Resolve person**: Check `indices.byAlias` (lowercase query)
2. **Use cached identifiers**:
   - `linearUserId` → search Linear for their blocked tickets
   - `githubUsername` → search GitHub for their PRs awaiting review
   - `slackUserId` → search Slack for blocker mentions
3. **Progressive discovery**: If you discover a GitHub/Linear ID during lookup, update people.json

## Check Daily Context First

Before making API calls, check local context files:

1. **Today's daily context**: `context/daily/YYYY-MM-DD.md`
   - Action items mentioning blockers
   - Slack summaries with blocker keywords
2. **Recent session context**: `context/YYYY-MM-DD-session.md`
   - Notes about blockers discussed today
3. **Recent EODs**: `context/eod-*.md` (last 3 days)
   - Blocked items from previous days
   - Carry-forward blockers
4. **Recent Slack reads**: `context/*-slack-read.md`
   - Messages flagging blockers

Use local context first, then supplement with fresh Linear/GitHub/Slack API calls.

## For a Person

1. **Linear**: Tickets assigned to them in blocked/waiting states
2. **GitHub**: PRs awaiting review or with requested changes
3. **Slack**: Recent messages asking for help or flagging blockers
4. **Calendar**: Check if they're out or in back-to-back meetings

## For a Project/Squad

1. **Linear**: All blocked tickets in the project
2. **GitHub**: Open PRs with stale reviews or failing CI
3. **Notion Priority Sources** (load from `.claude/notion-sources.json`):
   - **RFCs**: Draft or In Review status (decisions pending that may block progress)
   - **PRDs**: Requirements awaiting approval
4. **Figma** (load from `.claude/figma-sources.json`):
   - Check if design work is pending for blocked tickets
   - Look for recent design files in project channels that might indicate work in progress
   - Note if design decisions are needed
5. **Asana** (load from `.claude/asana-sources.json`):
   - Cross-functional tasks that are overdue or blocked for the person/project
   - Use `asana_search_tasks` with assignee and `completed=false`
   - Check for tasks past due date or in "Blocked"/"Waiting" sections
   - Frame as "cross-functional blockers" — distinct from Linear engineering blockers
6. **Dependencies**: External blockers (vendor, other team, decision needed, design)

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
