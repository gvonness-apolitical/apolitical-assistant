# Local Context First Pattern

Check cached and local context files before making API calls to reduce latency and API usage.

## When to Use

- Gathering context about a person, project, or topic
- Building meeting preparation materials
- Checking team status or blockers
- Any operation that might have recent cached data

## Files Involved

- `context/YYYY-MM-DD/index.md` - Daily context accumulator
- `context/YYYY-MM-DD/orient-HHMM.md` - Session snapshots
- `context/YYYY-MM-DD/slack-HHMM.md` - Slack summaries
- `context/YYYY-MM-DD/email-HHMM.md` - Email triage outputs
- `context/eod-YYYY-MM-DD.md` - End-of-day summaries
- `.claude/people.json` - Person cache
- `.claude/linear-cache.json` - Linear structure cache
- `.claude/slack-channels.json` - Channel cache
- `.claude/figma-sources.json` - Figma files cache
- `.claude/asana-sources.json` - Asana workspace cache

## Algorithm

### Step 1: Check Today's Context

```
1. Read context/YYYY-MM-DD/index.md (today's date)
2. Scan for mentions of the query subject
3. Check Session Log for recent activities
4. Check Active Items for outstanding work
5. Check Key Context for accumulated info
```

### Step 2: Check Recent Context Files

```
1. List files in context/YYYY-MM-DD/
2. Read recent orient-HHMM.md files
3. Read recent slack-HHMM.md for Slack context
4. Read recent email-HHMM.md for email context
```

### Step 3: Check Yesterday's EOD

```
1. Read context/eod-YYYY-MM-DD.md (yesterday)
2. Look for carry-forward items
3. Check for relevant mentions
```

### Step 4: Check Caches

```
1. Load relevant JSON caches
2. Use cached identifiers and metadata
3. Note cache freshness (lastUpdated field)
```

### Step 5: Determine API Need

Based on local findings:

```
IF sufficient context found locally:
  → Use local data, note source
  → Optionally supplement with fresh API data

ELSE IF partial context found:
  → Use local data as baseline
  → Make targeted API calls for missing info

ELSE:
  → Make full API calls
  → Consider caching results for future
```

## Cache Freshness Guidelines

| Cache | Acceptable Age | Action if Stale |
|-------|---------------|-----------------|
| people.json | 7 days | Suggest /sync-people |
| linear-cache.json | 1 day | Refresh teams/cycles |
| slack-channels.json | 30 days | Refresh channel list |
| figma-sources.json | 90 days | Run /sync-figma |
| asana-sources.json | 1 day (projects), 7 days (goals/teams) | Run /sync-asana |
| Daily context | Same day | Always current |

## Example

```
Query: /find-context Byron

Step 1: Check context/2026-01-30/index.md
  → Found: "Byron mentioned in Slack about PR review"

Step 2: Check recent slack files
  → Found: slack-0930.md mentions Byron's PR discussion

Step 3: Check yesterday's EOD
  → Found: "Byron's auth PR awaiting review"

Step 4: Check people.json
  → Found: Full profile with identifiers

Step 5: Decision
  → Have recent Slack context
  → Have person identifiers
  → Only need fresh Linear data for current tickets
  → Make single Linear API call instead of full search
```

## Output Annotation

When using cached data, note the source:

```markdown
## Byron Sorgdrager

**Source:** Local context (today's slack-0930.md) + people.json cache

### Recent Activity
- PR review discussion at 09:30 (from Slack summary)
- Auth changes PR pending (from yesterday's EOD)

### Profile
- Role: Software Engineer (from people.json)
- Squad: Platform
```

## Benefits

1. **Faster responses** - No API latency for cached data
2. **Reduced API calls** - Lower rate limit pressure
3. **Offline capability** - Can work with local data when APIs unavailable
4. **Consistency** - Same context used across skills in a session

## Skills Using This Pattern

- `/find-context` - Person/project/topic lookups
- `/prep-meeting` - Gathering attendee context
- `/team-status` - Team information
- `/whats-blocking` - Blocker context
- `/morning-briefing` - Daily summary
