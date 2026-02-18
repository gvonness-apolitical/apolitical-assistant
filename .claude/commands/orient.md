# Orient

Gather context at the start of a session to be effective as an assistant.

## Usage

- `/orient` - Gather comprehensive context and be ready to assist
- `/orient --quick` - Use cached data only, no API calls (fast, works offline)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolving names in calendar/Slack
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## Quick Mode

When `--quick` flag is provided:

1. Skip all MCP/API calls
2. Load only from local caches:
   - `people.json` - Team information
   - `linear-cache.json` - Sprint/project structure
   - `slack-channels.json` - Channel priorities
   - `figma-sources.json` - Recent Figma activity
   - `asana-sources.json` - Asana workspace structure
   - `context/YYYY-MM-DD/` - Today's accumulated context
3. Note in output: "Quick mode - using cached data only"
4. Complete in <2 seconds

Use quick mode when:
- MCP servers are unavailable
- You need a fast status check
- Working offline

## What This Does

Silently gathers context from all systems to understand:
- What's on the schedule today
- What needs attention
- What's currently in progress
- Any active issues or blockers

After gathering, outputs a brief confirmation: "Ready to go."

## People Cache Check

Before gathering context, check `.claude/people.json`:

1. **Check cache freshness**: Compare `lastUpdated` timestamp to today
2. **If > 7 days old**: Suggest running `/sync-people --refresh`
3. **Load "me" section**: Use `me.slackUserId` for @mention detection in Slack

```
People cache is 12 days old. Consider running `/sync-people --refresh` to update.
```

### Asana Cache Freshness

Also check `.claude/asana-sources.json`:

1. **Check `lastUpdated`**: Compare to today
2. **If null** (never synced): Suggest running `/sync-asana`
3. **If > 1 day old**: Suggest refreshing: `Asana cache is X days old. Run /sync-asana to refresh?`

## Context Gathering

### Calendar
- Today's meetings and events
- Upcoming meetings in next 24 hours
- Who you're meeting with (resolve names using people.json)

### Communications
- Unread/flagged emails requiring response
  - Load `.claude/email-rules.json` to filter out noise (auto-delete patterns)
  - Focus on priority senders and `alwaysKeep` patterns
- Active Slack threads with recent activity (use `me.slackUserId` for @mention detection)
- DMs needing attention
- **Priority private channels** from `.claude/channels-config.json` (especially leadership channels like `priv-management-team`, `priv-managers`)
  - Note: Use `slack_list_channels` with `types='private_channel'` to ensure private channels are listed

### Work in Progress
- Linear tickets assigned or in progress
- Open PRs awaiting review
- PRs you've authored awaiting merge
- Asana tasks assigned to you (cross-functional work)
  - Load from `.claude/asana-sources.json` if cache is fresh
  - Otherwise query `asana_search_tasks` with your GID, incomplete only

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

### Design Context
- Recent Figma activity from `.claude/figma-sources.json`
  - Files shared in last 7 days
  - Files shared in engineering/product channels
- Note any design work relevant to current priorities

## Output

### Session Context File
Writes gathered context to: `context/YYYY-MM-DD/orient-HHMM.md`

Create the day directory if it doesn't exist. Add YAML frontmatter:
```yaml
---
type: context
subtype: orient
date: YYYY-MM-DD
time: HH:MM
---
```

This file can be referenced by other skills and persists for the session.

### Daily Context Index
Also updates `context/YYYY-MM-DD/index.md` with:

```markdown
## Orient Summary (HH:MM)
- **Session started**: TIMESTAMP
- **Calendar**: X meetings today
- **Unread emails**: X
- **Slack mentions**: X
- **Linear tickets**: X assigned
- **Active incidents**: X
- **Team out**: [names]
```

Create the index file from template (`.claude/templates/context-index.md`) if it doesn't exist.

### User Output
Brief confirmation only:
```
Ready to go.
```

If critical items found, may add a one-liner:
```
Ready to go. (1 active incident, 3 emails flagged)
```

## Check Existing Context

Before gathering fresh data:
1. **Previous day's EOD**: Read `context/eod-YYYY-MM-DD.md` for yesterday's carry-forward items
2. **Today's daily context**: Check if `context/YYYY-MM-DD/index.md` already exists from earlier session
3. **Recent session context**: Check `context/YYYY-MM-DD/session.md`

## Notes
- Run at the start of any new session for best results
- Context file is gitignored - contains potentially sensitive info
- Subsequent `/orient` calls in same session will refresh context
- Other skills can read the context file if needed
- Daily context index accumulates throughout the day in `context/YYYY-MM-DD/index.md`
