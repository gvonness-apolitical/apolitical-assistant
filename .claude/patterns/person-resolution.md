# Person Resolution Pattern

Instant resolution of names to system identifiers using the cached people.json file.

## When to Use

- Resolving a person's name to their system identifiers (Slack, GitHub, Linear, Humaans)
- Looking up team membership or role information
- Finding DM channel IDs for direct Slack communication
- Cross-referencing mentions across systems

## Files Involved

- `.claude/people.json` - Primary cache with all person data
- `.claude/figma-sources.json` - May contain additional people in `discoveredPeople`

## Algorithm

### Step 1: Determine Query Type

```
IF query is email format (contains @):
  → Direct lookup in people[email]

ELSE IF query matches Slack ID pattern (starts with U):
  → Check indices.bySlackUserId[query]

ELSE IF query matches GitHub username pattern:
  → Check indices.byGithubUsername[query]

ELSE:
  → Proceed to alias/fuzzy matching
```

### Step 2: Alias Lookup

```
1. Lowercase the query
2. Check indices.byAlias[lowercase_query]
3. If found, return people[email]
```

### Step 3: Fuzzy Matching

If not found by alias:

```
1. Iterate through all people entries
2. Compare query against displayName (case-insensitive)
3. Use partial matching for multi-word names
4. Return best match if confidence is high
```

### Step 4: Contacts Check

```
1. Check contacts section for external people
2. Contacts have limited identifiers but may have displayName
```

### Step 5: API Fallback

If still not found:

```
1. Search Humaans by name (humaans_list_employees)
2. Search Slack by name (slack_list_users)
3. If found, add to people.json for future lookups
4. Update lastVerified timestamp
```

## Using Cached Identifiers

Once resolved, use the appropriate identifier for each system:

| System | Identifier | Usage |
|--------|------------|-------|
| Slack | `slackUserId` | @mentions, searches, user lookups |
| Slack | `slackDmChannelId` | Reading DM history directly |
| GitHub | `githubUsername` | PR/issue author searches |
| Linear | `linearUserId` | Ticket assignee operations |
| Humaans | `humaansEmployeeId` | HR data lookups |

## Metadata Usage

The `metadata` section provides additional context:

```json
{
  "team": "Engineering",      // Filter people by team
  "role": "Software Engineer", // Display in context
  "squad": "Platform",        // Squad assignment
  "managerId": "email",       // Manager lookup
  "isDirectReport": true      // Direct report filtering
}
```

## Example

```
Query: "Leo"

1. Not email format
2. Not Slack ID pattern
3. Check indices.byAlias["leo"]
4. Found: "leonardo.maglio@apolitical.co"
5. Return people["leonardo.maglio@apolitical.co"]

Result:
{
  "displayName": "Leonardo Maglio",
  "identifiers": {
    "slackUserId": "U07UJU7CBLL",
    "slackDmChannelId": "D08GD5934R3",
    "githubUsername": "lmaglio-apolitical",
    ...
  },
  "metadata": {
    "team": "Engineering",
    "squad": "Enterprise"
  }
}
```

## Cache Updates

When you discover a new identifier (e.g., GitHub username from a PR):

1. Look up the person by known identifier
2. Set the new identifier value
3. Rebuild relevant index (if indexed field)
4. Update `lastVerified` to today's date
5. Write back to people.json

## Skills Using This Pattern

- `/orient` - Resolving names in calendar events
- `/find-context` - Looking up person across all systems
- `/team-status` - Resolving team members
- `/whats-blocking` - Finding blockers by person
- `/prep-meeting` - Gathering attendee context
- `/slack-read` - Resolving message authors
- `/create-ticket` - Resolving assignees
- `/triage-inbox` - Identifying email senders
