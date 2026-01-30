# Rate Limiting Pattern

Batch and throttle API calls to avoid rate limits and improve performance.

## When to Use

- Skills making multiple API calls to the same service
- Bulk operations (listing many channels, fetching many tickets)
- Parallel operations that could overwhelm an API

## Files Involved

- `.claude/settings.json` - Rate limit configuration
- `.claude/usage-stats.json` - API call tracking (if implemented)

## Configuration

In `.claude/settings.json`:

```json
{
  "rateLimits": {
    "slackConcurrentChannels": 5,
    "linearBatchSize": 50,
    "githubRequestsPerMinute": 30,
    "defaultDelayMs": 100
  }
}
```

## Strategies

### 1. Batch Similar Requests

Instead of individual calls, use bulk APIs:

**Linear:**
```
BAD:  Call list_issues 50 times with different filters
GOOD: Call list_issues once with combined filter

Example:
- Use "assignee:X OR assignee:Y" instead of separate calls
- Use project filter to get all project tickets at once
```

**Slack:**
```
BAD:  Read 20 channels sequentially
GOOD: Read 5 channels in parallel, then next 5

Limit concurrent channel reads to avoid rate limits
```

**GitHub:**
```
BAD:  Fetch PR details individually
GOOD: Use GraphQL to get related data in single request
```

### 2. Use Cached Data First

Before making API calls:

```
1. Check if data exists in cache
2. Check cache freshness (within acceptable age)
3. Only call API if cache miss or stale
4. Update cache after API call
```

### 3. Parallel with Limits

For operations that can run in parallel:

```
const CONCURRENT_LIMIT = 5;
const channels = [...]; // 20 channels to read

// Process in batches of 5
for (let i = 0; i < channels.length; i += CONCURRENT_LIMIT) {
  const batch = channels.slice(i, i + CONCURRENT_LIMIT);
  await Promise.all(batch.map(readChannel));
  // Optional: small delay between batches
  await delay(100);
}
```

### 4. Progressive Loading

For large datasets, load incrementally:

```
1. Load first page of results
2. Display partial results to user
3. Continue loading remaining pages
4. Update display as more data arrives
```

### 5. Request Coalescing

When multiple parts of a skill need the same data:

```
BAD:
  Part A calls list_users
  Part B calls list_users
  Part C calls list_users

GOOD:
  Load list_users once at start
  Share result with all parts
```

## Slack-Specific Limits

```
- Conversations list: 1000 per page, rate limited
- Message history: 100 per page, 1 request/second tier
- User list: 200 per page

Strategy:
- List channels once, cache results
- Read priority channels first
- Batch message reads in groups of 5
```

## Linear-Specific Limits

```
- Standard rate limit: varies by endpoint
- Use pagination for large result sets
- Use filters to reduce result size

Strategy:
- Cache team/project structure (changes rarely)
- Filter by date range for tickets
- Use specific queries vs listing all
```

## GitHub-Specific Limits

```
- REST API: 5000 requests/hour (authenticated)
- GraphQL: 5000 points/hour

Strategy:
- Prefer GraphQL for related data
- Cache PR/issue data during session
- Use conditional requests (If-Modified-Since)
```

## Quick/Offline Mode

For fastest operation, skip API calls entirely:

```
/orient --quick

1. Load all data from caches only
2. No API calls made
3. Note staleness in output
4. Complete in <1 second
```

Implementation:
```
IF --quick flag:
  Skip all API calls
  Use cached data only
  Note: "Quick mode - cached data only"
```

## Tracking Usage

If tracking is enabled, record:

```json
{
  "apiCalls": {
    "slack": {"today": 45, "thisWeek": 234},
    "linear": {"today": 23, "thisWeek": 156},
    "github": {"today": 12, "thisWeek": 67}
  },
  "lastReset": "2026-01-30T00:00:00Z"
}
```

Use this to:
- Warn when approaching limits
- Suggest using quick mode during high usage
- Identify optimization opportunities

## Skills Using This Pattern

- `/orient` - Multiple parallel data sources
- `/slack-read` - Many channels to process
- `/team-status` - Multiple API calls per team
- `/find-context` - Searches across many systems
- `/sync-people` - Bulk user lookups
- `/sync-figma` - Multiple file validations
