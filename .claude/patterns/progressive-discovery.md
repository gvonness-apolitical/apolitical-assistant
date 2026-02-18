# Progressive Discovery Pattern

Cache discovered identifiers during skill execution for future use.

## When to Use

- When API calls reveal identifiers not yet in local caches
- When resolving a person finds new system IDs
- When cross-referencing reveals new connections

## Files Involved

- `.claude/people.json` - Primary person cache
- `.claude/linear-cache.json` - Linear structure cache
- `.claude/figma-sources.json` - Figma files cache (discoveredPeople section)
- `.claude/slack-channels.json` - Channel cache
- `.claude/asana-sources.json` - Asana workspace cache

## Discoverable Identifiers

| Identifier | Cache Location | Discovered During |
|------------|---------------|-------------------|
| `githubUsername` | people.json | PR author lookups in /team-status, /whats-blocking |
| `linearUserId` | people.json | Assignee resolution in /create-ticket, /team-status |
| `humaansEmployeeId` | people.json | HR lookups in /sync-people |
| `slackUserId` | people.json | User resolution in /slack-read |
| `slackDmChannelId` | people.json | DM operations |
| `asanaUserId` | people.json | Asana user resolution in /sync-asana, /find-context, /team-status |
| Linear team IDs | linear-cache.json | First Linear API call |
| Linear project IDs | linear-cache.json | Project lookups |
| Channel IDs | slack-channels.json | Channel operations |
| Figma file owners | figma-sources.json | Figma link extraction |
| Asana team/project GIDs | asana-sources.json | Asana workspace discovery |

## Algorithm

### Step 1: Detect New Identifier

During normal skill operation, when an API returns data:

```
1. Extract identifiers from API response
2. Look up associated person in people.json
3. Compare returned identifier to cached value
4. If new or different, proceed to update
```

### Step 2: Validate Identifier

Before caching:

```
1. Confirm identifier format is correct
   - Slack IDs start with U (users) or C/D (channels)
   - GitHub usernames match expected pattern
   - Linear IDs are UUIDs
2. Confirm association is correct
   - Email matches
   - Name matches
   - Or other corroborating data
```

### Step 3: Update Cache

```
1. Load relevant cache file
2. Navigate to correct location
3. Set new identifier value
4. Update lastVerified timestamp
5. Rebuild indices if indexed field
6. Write file back
```

### Step 4: Rebuild Indices

For indexed fields in people.json:

```
IF updating slackUserId:
  → Add to indices.bySlackUserId

IF updating githubUsername:
  → Add to indices.byGithubUsername

IF updating linearUserId:
  → Add to indices.byLinearUserId (if index exists)

IF updating asanaUserId:
  → Add to indices.byAsanaUserId
```

## Example: Discovering GitHub Username

Scenario: Running `/team-status Platform` reveals a PR by Rihards

```
1. GitHub API returns PR authored by "rjukna-apolitical"
2. PR email is "rihards.jukna@apolitical.co"
3. Look up in people.json by email
4. Found: Rihards Jukna
5. Current githubUsername: null
6. Update:
   - Set identifiers.githubUsername = "rjukna-apolitical"
   - Set lastVerified = "2026-01-30"
   - Add to indices.byGithubUsername
7. Write people.json
```

## Example: Discovering Linear User ID

Scenario: Running `/create-ticket` and assigning to Byron

```
1. Use Linear API to search users by email
2. API returns Linear user ID for byron.sorgdrager@apolitical.co
3. Look up in people.json
4. Current linearUserId: null
5. Update:
   - Set identifiers.linearUserId = "uuid-here"
   - Set lastVerified = "2026-01-30"
   - Add to indices.byLinearUserId (if index exists)
6. Write people.json
7. Use ID for ticket assignment
```

## Handling Unknown People

When discovering someone not in people.json:

```
1. Check if internal (email domain matches)

IF internal:
  → Add to people section
  → Set discovered identifiers
  → Generate basic aliases
  → Set lastVerified
  → Suggest running /sync-people for full data

IF external:
  → Add to contacts section
  → Set available identifiers
  → Add source/context note
```

## Cache Write Frequency

- Write immediately after discovery
- Don't batch updates (risk of losing data)
- OK to write multiple times in one skill execution

## Skills That Discover

| Skill | May Discover |
|-------|-------------|
| `/team-status` | githubUsername, linearUserId |
| `/whats-blocking` | githubUsername, linearUserId |
| `/create-ticket` | linearUserId |
| `/slack-read` | slackUserId, slackDmChannelId |
| `/find-context` | Various identifiers |
| `/sync-people` | All identifiers (primary refresh) |
| `/sync-figma` | Figma file owners |
| `/sync-asana` | asanaUserId, Asana team/project GIDs |
