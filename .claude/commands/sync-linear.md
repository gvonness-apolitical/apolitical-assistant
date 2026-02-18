# Sync Linear

Initialize or refresh the Linear structure cache for faster ticket operations.

## Usage

- `/sync-linear` - Full sync of teams, projects, cycles, statuses, and labels
- `/sync-linear --teams` - Refresh teams only
- `/sync-linear --cycles` - Refresh current/upcoming cycles only

## MANDATORY: Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Load Existing Data | Read (linear-cache.json) | Never |
| 2. Gather Fresh Data | linear list_teams, list_projects, list_cycles, list_issue_statuses, list_issue_labels | Individual sources on failure |
| 3. Build Indices | (computation only) | Never |
| 4. Save | Write (linear-cache.json) | Never |

Each checkpoint must include `Tools:` line with actual tools called and counts.

## Core Patterns Used

- [Error Handling](../patterns/error-handling.md) - Graceful degradation if Linear unavailable
- [Rate Limiting](../patterns/rate-limiting.md) - Batch API calls efficiently

## What This Does

Populates `.claude/linear-cache.json` with Linear organizational structure, enabling instant lookups for team IDs, project IDs, status IDs, and current cycles without repeated API calls.

## Process

### 1. Load Existing Data

Read current `.claude/linear-cache.json` if it exists:
- Preserve any manually added metadata
- Note current version for comparison

### 2. Gather Fresh Data

**Teams** (`list_teams`):
```json
{
  "TEAM_ID": {
    "name": "Platform",
    "key": "PLT",
    "description": "Platform squad",
    "defaultProject": "PROJECT_ID"
  }
}
```

**Projects** (`list_projects`):
```json
{
  "PROJECT_ID": {
    "name": "Platform Q1 2026",
    "teamId": "TEAM_ID",
    "state": "started",
    "targetDate": "2026-03-31",
    "progress": 45
  }
}
```

**Cycles** (`list_cycles`):
```json
{
  "current": {
    "id": "CYCLE_ID",
    "teamId": "TEAM_ID",
    "teamName": "Platform",
    "number": 12,
    "name": "Sprint 12",
    "startsAt": "2026-01-27",
    "endsAt": "2026-02-07",
    "progress": 35
  },
  "upcoming": [
    {
      "id": "CYCLE_ID",
      "number": 13,
      "startsAt": "2026-02-10",
      "endsAt": "2026-02-21"
    }
  ]
}
```

**Statuses** (`list_issue_statuses`):
```json
{
  "TEAM_ID": [
    {"id": "STATUS_ID", "name": "Backlog", "type": "backlog", "position": 0},
    {"id": "STATUS_ID", "name": "Todo", "type": "unstarted", "position": 1},
    {"id": "STATUS_ID", "name": "In Progress", "type": "started", "position": 2},
    {"id": "STATUS_ID", "name": "In Review", "type": "started", "position": 3},
    {"id": "STATUS_ID", "name": "Done", "type": "completed", "position": 4},
    {"id": "STATUS_ID", "name": "Cancelled", "type": "canceled", "position": 5}
  ]
}
```

**Labels** (`list_issue_labels`):
```json
{
  "LABEL_ID": {
    "name": "type: spike 📌",
    "color": "#..."
  }
}
```

### 3. Build Indices

**teamByKey** - Team key → team ID:
```json
{
  "PLT": "TEAM_ID",
  "AI": "TEAM_ID",
  "ENT": "TEAM_ID"
}
```

**teamByName** - Lowercase team name → team ID:
```json
{
  "platform": "TEAM_ID",
  "ai learning": "TEAM_ID",
  "enterprise": "TEAM_ID"
}
```

**projectByName** - Lowercase project name → project ID:
```json
{
  "platform q1 2026": "PROJECT_ID"
}
```

**labelByName** - Lowercase label name → label ID:
```json
{
  "type: spike 📌": "LABEL_ID",
  "bug severity: 1": "LABEL_ID"
}
```

### 4. Discover User IDs

While syncing, also look up Linear user IDs for people in people.json:

```
1. Load people.json
2. For each person without linearUserId:
   - Search Linear users by email
   - If found, note the ID
3. Update people.json with discovered IDs
4. Rebuild people.json indices
```

This enables the [Progressive Discovery](../patterns/progressive-discovery.md) pattern.

### 5. Write Cache

Save to `.claude/linear-cache.json` with:
- Updated `lastUpdated` timestamp
- All gathered data
- Built indices

## Output

### Summary
```
Linear Sync Complete
====================

Data Gathered:
- Teams: 5 (Platform, AI Learning, AI Tools, Enterprise, Data)
- Projects: 12 active
- Cycles: 5 current, 5 upcoming
- Statuses: 30 across all teams
- Labels: 45

User IDs Discovered:
- 8 new Linear user IDs added to people.json

Indices Built:
- teamByKey: 5 entries
- teamByName: 5 entries
- projectByName: 12 entries
- labelByName: 45 entries

File saved: .claude/linear-cache.json
Last updated: 2026-01-30T10:00:00Z
```

## Using the Cache

Skills can use the cache for instant lookups:

**Get team ID by name:**
```
team = "Platform"
teamId = linear-cache.indices.teamByName[team.toLowerCase()]
```

**Get current cycle:**
```
cycle = linear-cache.cycles.current
// Returns: {number: 12, startsAt: "2026-01-27", endsAt: "2026-02-07", ...}
```

**Get status ID:**
```
statuses = linear-cache.statuses[teamId]
inProgressStatus = statuses.find(s => s.name === "In Progress")
```

**Get label ID:**
```
labelId = linear-cache.indices.labelByName["type: spike 📌"]
```

## Cache Freshness

| Data | Recommended Refresh | Reason |
|------|---------------------|--------|
| Teams | Weekly | Rarely change |
| Projects | Daily | Status/progress changes |
| Cycles | Daily | Active cycle changes |
| Statuses | Weekly | Rarely change |
| Labels | Weekly | Rarely change |

The `/orient` skill can prompt if cache is stale:
```
Linear cache is 3 days old. Run /sync-linear to refresh?
```

## Error Handling

### Linear Unavailable
```
✗ Linear API unavailable

Cannot refresh cache. Existing cache will be used:
- Last updated: 2026-01-29T08:00:00Z
- Data may be stale

Retry later with: /sync-linear
```

### Partial Failure
```
⚠️ Partial sync completed

Refreshed:
✓ Teams (5)
✓ Projects (12)
✗ Cycles - API error
✓ Statuses (30)
✓ Labels (45)

Cycle data preserved from previous sync.
```

## Notes

- Run after team structure changes (new team, renamed project)
- Run weekly as part of regular maintenance
- Cache is safe to delete - will be rebuilt on next sync
- Integrates with `/create-ticket`, `/team-status`, `/whats-blocking`
