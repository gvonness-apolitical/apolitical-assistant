# Sync Asana

Initialize or refresh the Asana workspace structure cache for cross-functional task lookups.

## Usage

- `/sync-asana` - Full sync of workspace, teams, projects, goals, portfolios
- `/sync-asana --teams` - Refresh teams only
- `/sync-asana --projects` - Refresh projects only
- `/sync-asana --priority` - Interactive selection of priority items

## MANDATORY: Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Discover Workspace | asana_list_workspaces | Never |
| 2. Discover Teams | asana_get_teams_for_workspace | Never |
| 3. Discover Projects | asana_get_projects_for_workspace | Never |
| 4. Discover Goals | asana_get_goals | If unavailable |
| 5. Discover Portfolios | asana_get_portfolios | If unavailable |
| 6. Match People | asana_get_workspace_users, Read (people.json) | Never |
| 7. Priority Selection | (interactive, computation) | If using defaults |
| 8. Save | Write (asana-sources.json) | Never |

Each checkpoint must include `Tools:` line with actual tools called and counts.

## Core Patterns Used

- [Error Handling](../patterns/error-handling.md) - Graceful degradation if Asana unavailable
- [Rate Limiting](../patterns/rate-limiting.md) - Batch API calls efficiently
- [Progressive Discovery](../patterns/progressive-discovery.md) - Discover asanaUserId for people.json

## What This Does

Populates `.claude/asana-sources.json` with the Asana workspace structure — teams, projects, goals, and portfolios — enabling instant lookups for cross-functional work without repeated API calls.

**Note:** Asana is the company-wide task manager. Engineering-specific work lives in Linear. Skills should frame Asana data as "cross-functional" or "company-wide" to avoid confusion.

## MCP Tool Loading

Before making any Asana API calls, load the required tools:

```
ToolSearch: "+asana list workspaces"
```

This loads the Asana MCP tools (`mcp__claude_ai_Asana__*`). All Asana operations require these tools to be loaded first.

## Process

### Step 1: Discover Workspace

**IMPORTANT:** `asana_list_workspaces` MUST be called first before any other Asana API call.

1. Call `asana_list_workspaces` to get the workspace GID
2. If multiple workspaces, prompt user to select
3. Store workspace GID and name

```
✓ CHECKPOINT: Step 1 complete - Discover Workspace
  Workspace: [name] (GID: [gid])

Proceeding to Step 2: Discover Teams
```

### Step 2: Discover Teams

Call `asana_get_teams_for_workspace` with the workspace GID:

```json
{
  "TEAM_GID": {
    "name": "Engineering",
    "description": "Engineering team"
  }
}
```

```
✓ CHECKPOINT: Step 2 complete - Discover Teams
  Teams found: [N] ([list names])

Proceeding to Step 3: Discover Projects
```

### Step 3: Discover Projects

For each team, call `asana_get_projects_for_team`:

```json
{
  "PROJECT_GID": {
    "name": "Q1 OKRs",
    "teamGid": "TEAM_GID",
    "teamName": "Engineering",
    "archived": false
  }
}
```

Filter out archived projects. Apply `filters.excludeProjects` and `filters.excludeTeams` if configured.

```
✓ CHECKPOINT: Step 3 complete - Discover Projects
  Active projects: [N] across [N] teams

Proceeding to Step 4: Discover Portfolios
```

### Step 4: Discover Portfolios

Call `asana_get_portfolios` with the workspace GID:

```json
{
  "PORTFOLIO_GID": {
    "name": "Engineering Initiatives",
    "owner": "owner-gid"
  }
}
```

```
✓ CHECKPOINT: Step 4 complete - Discover Portfolios
  Portfolios found: [N]

Proceeding to Step 5: Discover Goals
```

### Step 5: Discover Goals

Call `asana_get_goals` with the workspace GID:

```json
{
  "GOAL_GID": {
    "name": "Improve platform reliability",
    "status": "on_track",
    "owner": "owner-gid",
    "dueOn": "2026-03-31"
  }
}
```

```
✓ CHECKPOINT: Step 5 complete - Discover Goals
  Goals found: [N]

Proceeding to Step 6: Discover User IDs
```

### Step 6: Discover User IDs

Discover Asana user GIDs for people in `people.json`:

1. Call `asana_get_user("me")` to get your own GID
2. For each person in people.json without `asanaUserId`:
   - Use `asana_get_workspace_users` or `asana_typeahead_search` to find by email
   - If found, note the GID
3. Update `people.json` with discovered IDs
4. Rebuild `people.json` indices (`byAsanaUserId`)

```
✓ CHECKPOINT: Step 6 complete - Discover User IDs
  Self GID: [gid] | People matched: [N] new Asana IDs

Proceeding to Step 7: Build Indices
```

### Step 7: Build Indices

**teamByName** - Lowercase team name → team GID:
```json
{
  "engineering": "TEAM_GID",
  "product": "TEAM_GID"
}
```

**projectByName** - Lowercase project name → project GID:
```json
{
  "q1 okrs": "PROJECT_GID"
}
```

**projectByTeam** - Team GID → array of project GIDs:
```json
{
  "TEAM_GID": ["PROJECT_GID_1", "PROJECT_GID_2"]
}
```

```
✓ CHECKPOINT: Step 7 complete - Build Indices
  teamByName: [N] | projectByName: [N] | projectByTeam: [N]

Proceeding to Step 8: Priority Selection
```

### Step 8: Priority Selection (First Run Only)

On first run (when `lastUpdated` is null), prompt the user to mark priority items:

```
Discovered [N] projects, [N] goals, [N] portfolios.

Which items should be checked first by skills? (You can change these later)

Projects:
  1. Q1 OKRs (Engineering)
  2. Website Redesign (Marketing)
  3. ...

Mark priority items (comma-separated numbers, or 'skip'):
```

Store selected GIDs in `sources.*.priority` arrays.

On subsequent runs, preserve existing priority selections.

```
✓ CHECKPOINT: Step 8 complete - Priority Selection
  Priority projects: [N] | Priority goals: [N] | Priority portfolios: [N]

Proceeding to Step 9: Write Cache
```

### Step 9: Write Cache

Save to `.claude/asana-sources.json` with:
- Updated `lastUpdated` timestamp
- All gathered data
- Built indices
- Preserved priority selections and filters

```
✓ CHECKPOINT: Step 9 complete - Write Cache
  File saved: .claude/asana-sources.json
```

## Output

### Summary
```
Asana Sync Complete
====================

Workspace: [name]

Data Gathered:
- Teams: [N] ([list])
- Projects: [N] active
- Portfolios: [N]
- Goals: [N]

User IDs Discovered:
- Self: [gid]
- [N] new Asana user IDs added to people.json

Indices Built:
- teamByName: [N] entries
- projectByName: [N] entries
- projectByTeam: [N] entries

Priority Items:
- Projects: [N] marked
- Goals: [N] marked
- Portfolios: [N] marked

File saved: .claude/asana-sources.json
Last updated: [timestamp]
```

## Using the Cache

Skills can use the cache for instant lookups:

**Get team GID by name:**
```
teamGid = asana-sources.indices.teamByName["engineering"]
```

**Get priority projects:**
```
priorityProjects = asana-sources.sources.projects.priority
// Returns: ["PROJECT_GID_1", "PROJECT_GID_2"]
```

**Get projects for a team:**
```
projects = asana-sources.indices.projectByTeam[teamGid]
// Returns: ["PROJECT_GID_1", "PROJECT_GID_2"]
```

**Check task age filter:**
```
maxAge = asana-sources.filters.taskMaxAgeDays
// Returns: 30 (default)
```

## Cache Freshness

| Data | Recommended Refresh | Reason |
|------|---------------------|--------|
| Teams | Weekly | Rarely change |
| Projects | Daily | New projects, status changes |
| Portfolios | Weekly | Rarely change |
| Goals | Weekly | Status updates are periodic |

The `/orient` skill can prompt if cache is stale:
```
Asana cache is 3 days old. Run /sync-asana to refresh?
```

## Error Handling

### Asana Unavailable
```
✗ Asana API unavailable

Cannot refresh cache. Existing cache will be used:
- Last updated: [timestamp]
- Data may be stale

Retry later with: /sync-asana
```

### Partial Failure
```
⚠ Partial sync completed

Refreshed:
✓ Teams (5)
✓ Projects (23)
✗ Portfolios - API error
✓ Goals (8)

Portfolio data preserved from previous sync.
```

## Integration with Other Skills

- `/update-todos` - Uses cache for assigned task lookups
- `/find-context` - Uses cache for project/person/topic searches
- `/team-status` - Uses cache for cross-functional team tasks
- `/orient` - Checks cache freshness in pre-flight
- `/whats-blocking` - Uses cache for overdue/blocked task lookups
- `/prep-meeting` - Uses cache for shared project context
- `/weekly-review` - Uses cache for completed work during the week
- `/executive-report` - Uses cache for goal/portfolio status
- `/mbr` - Uses cache for goal progress and cross-functional completions

## Notes

- Run after workspace structure changes (new teams, projects, goals)
- Run daily or when `/orient` flags stale cache
- Cache is safe to delete — will be rebuilt on next sync
- Read-only: this skill does not create or update Asana tasks
- Priority items can be changed by running `/sync-asana --priority`
