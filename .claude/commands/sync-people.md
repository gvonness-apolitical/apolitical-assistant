# Sync People

Initialize or refresh the person identifier cache from Humaans and Slack.

## Usage

- `/sync-people` - Full sync from Humaans and Slack, populate people.json
- `/sync-people --refresh` - Re-verify existing people, mark missing as inactive
- `/sync-people --add-contact [email] [name]` - Add external contact manually
- `/sync-people --resume` - Resume from last completed step if previous run was interrupted

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/sync-people --resume`

## MANDATORY: Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Load Cache | Read (people.json) | Never |
| 2. Fetch Humaans | humaans_list_employees, humaans_get_org_chart | If Humaans unavailable |
| 3. Fetch Slack | slack_list_users | If Slack unavailable |
| 4. Merge & Deduplicate | (computation only) | Never |
| 5. Build Indices | (computation only) | Never |
| 6. Discover IDs | Various (progressive) | If no new people |
| 7. Save | Write (people.json) | Never |

Each checkpoint must include `Tools:` line with actual tools called and counts.

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume
- [Progressive Discovery](../patterns/progressive-discovery.md) - Build identifier cache
- [Error Handling](../patterns/error-handling.md) - Handle Humaans/Slack unavailability
- [Rate Limiting](../patterns/rate-limiting.md) - Batch user lookups

## What This Does

Populates `.claude/people.json` with team member identifiers from multiple sources, enabling instant person resolution across all skills.

## Process

### Step 1: Load Existing Data

Read current `.claude/people.json` if it exists:
- Preserve manually added aliases
- Preserve `contacts` section (external people)
- Preserve discovered identifiers (GitHub, Linear)

```
✓ CHECKPOINT: Step 1 complete - Load Existing Data
  Existing people: [N] | Contacts: [N] | Aliases preserved: [N]

Proceeding to Step 2: Gather Fresh Data
```

### Step 2: Gather Fresh Data

**From Humaans** (`humaans_list_employees`):
- Employee ID, email, name
- Team and role
- Manager ID
- Start date

**From Slack** (`slack_list_users`):
- User ID (U...), email, real name
- Match to Humaans by email

**From Meeting Config** (`.claude/meeting-config.json`):
- DM channel IDs from `oneOnOnes`
- Canvas IDs from `oneOnOnes`
- `isDirectReport` flags

```
✓ CHECKPOINT: Step 2 complete - Gather Fresh Data
  Humaans: [N] employees | Slack: [N] users | Meeting Config: [N] 1:1s

Proceeding to Step 3: Build Person Records
```

### Step 3: Build Person Records

For each employee in Humaans:

```json
{
  "displayName": "Leonardo Maglio",
  "aliases": ["Leonardo", "Leo"],
  "identifiers": {
    "slackUserId": "U08ABC123",
    "slackDmChannelId": "D08GD5934R3",
    "githubUsername": null,
    "linearUserId": null,
    "humaansEmployeeId": "humaans-id",
    "asanaUserId": null
  },
  "metadata": {
    "team": "Engineering",
    "role": "Software Engineer",
    "managerId": "manager@apolitical.co",
    "isDirectReport": true
  },
  "lastVerified": "2026-01-27"
}
```

```
✓ CHECKPOINT: Step 3 complete - Build Person Records
  Records built: [N] | Slack IDs matched: [N]

Proceeding to Step 4: Generate Aliases
```

### Step 4: Generate Aliases

For each person, create aliases from:
- First name (always)
- Common nicknames:
  - Leonardo → Leo
  - Peter → Pete
  - Romilly → Rom
  - Charles → Charlie
  - Dominic → Dom
  - Jessica → Jess
  - Samuel → Sam
  - Christopher → Chris
  - Robert → Rob, Robbie
  - Richard → Rich
  - Michael → Mike
  - Nicholas → Nick
  - Benjamin → Ben
  - Alexander → Alex
  - William → Will, Bill
  - Elizabeth → Liz, Beth
  - Katherine → Kate, Katie
  - Jennifer → Jen, Jenny
  - Rebecca → Bec, Becky
  - Fatimat → Fati

Preserve any manually added aliases from existing data.

```
✓ CHECKPOINT: Step 4 complete - Generate Aliases
  Aliases generated: [N] | Nicknames applied: [N]

Proceeding to Step 5: Build Indices
```

### Step 5: Build Indices

**byAlias** - lowercase alias → email:
```json
{
  "leo": "leonardo.maglio@apolitical.co",
  "leonardo": "leonardo.maglio@apolitical.co"
}
```

**bySlackUserId** - Slack ID → email:
```json
{
  "U08ABC123": "leonardo.maglio@apolitical.co"
}
```

```
✓ CHECKPOINT: Step 5 complete - Build Indices
  Alias index: [N] entries | Slack ID index: [N] entries

Proceeding to Step 6: Update "me" Section
```

### Step 6: Update "me" Section

Populate with your identity:
```json
{
  "email": "greg.vonness@apolitical.co",
  "displayName": "Greg von Ness",
  "slackUserId": "U08EWPC9AP9",
  "slackDmChannelId": null,
  "humaansEmployeeId": "your-humaans-id"
}
```

```
✓ CHECKPOINT: Step 6 complete - Update "me" Section
  Identity configured: [email]

Proceeding to Step 7: Write people.json
```

### Step 7: Write people.json

Save to `.claude/people.json` with:
- Updated `lastUpdated` timestamp
- Version number preserved
- All sections populated

```
✓ CHECKPOINT: Step 7 complete - Write people.json
  File saved: .claude/people.json
```

## Final Summary

After ALL 7 steps complete, display:

```
# Sync People Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Load Existing     ✓ 2. Gather Fresh    ✓ 3. Build Records
✓ 4. Generate Aliases  ✓ 5. Build Indices   ✓ 6. Update "me"
✓ 7. Write File

## Key Results
- **People synced**: [N]
- **New people**: [N]
- **Marked inactive**: [N]
- **Slack IDs matched**: [N]
- **Aliases indexed**: [N]

## Saved to
.claude/people.json

---
People sync complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /sync-people --resume"

### Resume Behavior

When `/sync-people --resume` is run:
1. Check daily context for incomplete sync
2. Skip completed steps
3. Resume from first incomplete step
4. Continue through remaining steps

## Refresh Mode (`--refresh`)

When running with `--refresh`:

1. Load existing people.json
2. Fetch fresh data from Humaans and Slack
3. For each existing person:
   - If found in Humaans: update metadata, set `lastVerified` to today
   - If NOT found in Humaans: mark `inactive: true`, preserve other data
4. Add any new people from Humaans
5. Rebuild indices

**Inactive people are NOT deleted** - they may be:
- Contractors with different HR systems
- External collaborators
- Recently departed (useful for context)

## Add Contact Mode (`--add-contact`)

Add external contact to `contacts` section:

```
/sync-people --add-contact vendor@example.com "Vendor Contact"
```

Creates:
```json
"contacts": {
  "vendor@example.com": {
    "displayName": "Vendor Contact",
    "aliases": ["Vendor"],
    "context": null
  }
}
```

Optionally add context:
```
/sync-people --add-contact vendor@example.com "Jane Vendor" --context "SSO integration vendor"
```

## Output

### Summary
```
People Sync Complete
====================

Sources:
- Humaans: 45 employees found
- Slack: 52 users matched (41 by email)
- Meeting Config: 24 people with DM channels

Results:
- People updated: 45
- New people added: 3
- Marked inactive: 1 (alice@apolitical.co - not in Humaans)
- Slack IDs matched: 41
- DM channels migrated: 24

Indices rebuilt:
- 67 aliases → 45 people
- 41 Slack user IDs indexed

File saved: .claude/people.json
Last updated: 2026-01-27T10:00:00Z
```

### Warnings
```
Warnings:
- Could not match Slack user to Humaans: bot@apolitical.co (likely bot)
- Missing Slack ID for: fatimat.gbajabiamila@apolitical.co
- Duplicate alias "sam" - already mapped to samuel.balogun@apolitical.co
```

## Error Handling

### Humaans Unavailable
- Warn user, continue with Slack-only sync
- Mark existing Humaans metadata as potentially stale

### Slack Unavailable
- Warn user, continue with Humaans-only sync
- Existing Slack IDs preserved

### Both Unavailable
- Error out - nothing useful can be done
- Suggest retry later

## Progressive Discovery

Some identifiers can't be populated during sync:

| Identifier | When Discovered |
|------------|-----------------|
| `githubUsername` | `/team-status`, `/whats-blocking` - from PR author lookups |
| `linearUserId` | `/create-ticket`, `/team-status` - from assignee resolution |
| `asanaUserId` | `/sync-asana`, `/find-context`, `/team-status` - from Asana user lookups |

Skills that discover these identifiers should update people.json:
1. Look up person by name/email
2. Set the new identifier
3. Write back to people.json

## Notes

- Run after new hires join (or `/orient` will prompt if cache is old)
- Contacts section is manual - not touched by refresh
- Aliases are case-insensitive in the index
- Multiple aliases can point to the same person
- The "me" section is used by other skills for @mention detection
