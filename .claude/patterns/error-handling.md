# Error Handling Pattern

Graceful degradation when MCP servers or external APIs are unavailable.

## When to Use

- Any skill that makes API calls through MCP servers
- When integrations may be temporarily unavailable
- When partial results are better than complete failure

## Files Involved

- All cache files (people.json, linear-cache.json, etc.) for fallback data
- `context/YYYY-MM-DD/` for recent local context

## Algorithm

### Step 1: Attempt Primary Source

```
1. Make API call through MCP server
2. Set reasonable timeout (30 seconds default)
3. Handle response or catch error
```

### Step 2: Classify Error

| Error Type | Handling |
|------------|----------|
| Connection timeout | Server likely down, use fallback |
| Authentication error | Credentials issue, cannot fallback |
| Rate limit | Pause and retry, or use cached |
| Not found (404) | Data doesn't exist, not an error |
| Server error (5xx) | Temporary issue, use fallback |
| Permission denied | Access issue, cannot fallback |

### Step 3: Apply Fallback Chain

For each integration:

**Slack:**
```
1. Try MCP slack tools
2. On failure: Check recent slack-*.md files in context/
3. Note: "Slack unavailable - using cached summaries from HH:MM"
```

**Linear:**
```
1. Try MCP linear tools
2. On failure: Use linear-cache.json for structure
3. Note: "Linear unavailable - using cached data (may be stale)"
```

**GitHub:**
```
1. Try MCP github tools or gh CLI
2. On failure: Check for cached PR/issue data in context
3. Note: "GitHub unavailable - limited data available"
```

**Google Calendar:**
```
1. Try MCP google calendar tools
2. On failure: Note "Calendar unavailable" in output
3. Cannot meaningfully cache calendar data
```

**Humaans:**
```
1. Try MCP humaans tools
2. On failure: Use people.json with stale warning
3. Note: "HR data from cache (last updated: DATE)"
```

**Notion:**
```
1. Try MCP notion tools
2. On failure: Use notion-cache.json for known pages
3. Note: "Notion unavailable - using cached page list"
```

**Figma:**
```
1. Try MCP figma tools
2. On failure: Use figma-sources.json cache
3. Note: "Figma unavailable - using cached file list"
```

### Step 4: Continue with Partial Results

```
1. Collect successful results
2. Note which integrations failed
3. Continue processing with available data
4. Include clear indication of gaps in output
```

### Step 5: Offer Retry

At end of output:

```markdown
## Integration Status

| Service | Status | Data Source |
|---------|--------|-------------|
| Slack | ✓ Available | Live API |
| Linear | ✗ Unavailable | Cache (2h old) |
| GitHub | ✓ Available | Live API |
| Calendar | ✗ Unavailable | N/A |

Some data may be incomplete. Retry specific integrations?
- [1] Retry Linear
- [2] Retry Calendar
- [3] Retry all failed
- [4] Continue without retry
```

## Output Format

When using fallback data, clearly indicate:

```markdown
### Linear Status ⚠️
*Using cached data - Linear API unavailable*
*Cache last updated: 2026-01-30 08:00*

- Sprint 12 progress: 60% (cached)
- Active tickets: 15 (cached)
- Note: Current status may differ
```

## Error Messages

Use consistent, helpful error messages:

```
✗ Slack: Connection timeout - using local summaries
✗ Linear: Rate limited - waiting 60s before retry
✗ GitHub: Authentication failed - check credentials
✗ Calendar: Service unavailable - skipping calendar data
✓ Humaans: OK
✓ Notion: OK
```

## Quick Mode Integration

The `--quick` flag (see [rate-limiting pattern](rate-limiting.md)) naturally handles unavailability:

```
/orient --quick

→ Uses only local caches and files
→ No API calls made
→ Fast, works offline
→ Output notes: "Quick mode - using cached data only"
```

## Skills Using This Pattern

All skills that use external integrations:
- `/orient` - Multiple integrations
- `/team-status` - Linear, GitHub, Humaans, Slack
- `/find-context` - All systems
- `/morning-briefing` - Calendar, email, Slack
- `/slack-read` - Slack (primary)
- `/triage-inbox` - Gmail (primary)
- `/create-ticket` - Linear (primary)
- `/whats-blocking` - Linear, GitHub
