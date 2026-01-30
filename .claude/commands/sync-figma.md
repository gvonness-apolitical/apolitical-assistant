# Sync Figma

Synchronize and maintain the Figma sources cache. Verify existing entries, discover new links, and clean up stale entries.

## Usage

- `/sync-figma` - Full sync: verify existing + search for new links
- `/sync-figma --verify` - Verify existing entries are still accessible
- `/sync-figma --discover` - Search Slack for Figma links not yet cached
- `/sync-figma --cleanup` - Archive/remove stale entries (not shared in 90+ days)
- `/sync-figma --stats` - Show cache statistics

## Process

### 1. Load Current Cache

Read `.claude/figma-sources.json` and gather statistics:
- Total entries
- Entries by category
- Entries by owner
- Oldest/newest entries
- Last updated timestamp

### 2. Verify Existing Entries (--verify or default)

For each entry in `files`:

1. **Check accessibility** via Figma API:
   - Use `mcp__figma__get_metadata` with fileKey and nodeId "0:1" (root)
   - If successful → entry is valid
   - If error (404, permission denied) → mark as inaccessible

2. **Update entry status**:
   ```json
   {
     "status": "active" | "inaccessible" | "stale",
     "lastVerified": "2026-01-30",
     "verificationError": null | "File not found" | "Permission denied"
   }
   ```

3. **Check staleness**:
   - If `lastShared` > 90 days ago and not recently verified as active → mark as stale
   - Stale threshold is configurable (default 90 days)

### 3. Discover New Links (--discover or default)

Search Slack for Figma links not yet in cache:

1. **Search Slack**:
   ```
   slack_search("figma.com has:link", count=100, sort="timestamp")
   ```

2. **Parse results**:
   - Extract Figma URLs from message text
   - Parse fileKey, type, name, nodeId

3. **Filter new entries**:
   - Skip if fileKey already exists in cache
   - Skip if URL is malformed

4. **For each new link**:
   - Capture owner (message author)
   - Cross-reference with people.json
   - Capture channel and date
   - Infer category from channel name
   - Add to figma-sources.json

5. **Verify new entries** (optional):
   - Call Figma API to confirm accessibility
   - Capture file name from API response (more accurate than URL)

### 4. Cleanup Stale Entries (--cleanup)

For entries marked as stale or inaccessible:

1. **Present summary**:
   ```
   Found 5 stale/inaccessible entries:

   INACCESSIBLE (2):
   - [Old Design](fileKey) - "File not found"
   - [Deleted Board](fileKey) - "Permission denied"

   STALE (3):
   - [Q3 Planning](fileKey) - Last shared: 2025-08-15 (168 days ago)
   - [Old Wireframes](fileKey) - Last shared: 2025-09-01 (152 days ago)
   - [Unused Flow](fileKey) - Last shared: 2025-09-20 (133 days ago)
   ```

2. **Confirm action**:
   ```
   Options:
   [1] Archive all (move to archivedFiles section)
   [2] Remove all (delete from cache)
   [3] Review individually
   [4] Skip cleanup
   ```

3. **If archiving**:
   - Move entries to `archivedFiles` section
   - Preserve all metadata for reference
   - Add `archivedDate` timestamp

4. **If removing**:
   - Delete from `files` object
   - Remove from all indices
   - Update `discoveredPeople` if owner has no other files

5. **Update indices**:
   - Rebuild `byCategory` index
   - Rebuild `byOwnerSlackId` index

### 5. Update Cache

After any changes:

1. Update `lastUpdated` timestamp
2. Write to `.claude/figma-sources.json`
3. Report changes made

## Output

### Full Sync Summary

```
Figma Sync Complete - 2026-01-30
================================

CACHE STATISTICS:
- Total entries: 17
- Active: 15
- Stale: 2
- Last updated: 2026-01-30T10:00:00Z

VERIFICATION RESULTS:
- Verified: 17 files
- Accessible: 15
- Inaccessible: 1 (removed)
- Permission denied: 1 (marked for review)

DISCOVERY RESULTS:
- Slack messages searched: 100
- New Figma links found: 3
- Already cached: 45
- Added to cache: 3

NEW ENTRIES:
| File | Type | Owner | Channel |
|------|------|-------|---------|
| [New Design](url) | design | Alice | #design |
| [Sprint Board](url) | board | Jayna | #team-eng |
| [Flow Diagram](url) | board | Lowell | #product |

CLEANUP:
- Archived: 2 stale entries
- Removed: 1 inaccessible entry

Updated: .claude/figma-sources.json
```

### Stats Only (--stats)

```
Figma Sources Cache Statistics
==============================

Total entries: 17
Last updated: 2026-01-30T10:00:00Z

BY CATEGORY:
- product: 6
- engineering: 3
- operations: 4
- marketing: 3
- research: 1

BY OWNER:
- Jayna Mistry: 4
- Lowell Weisbord: 3
- Tanya Riordan: 3
- Alice Sinclair: 3
- Others: 4

AGE DISTRIBUTION:
- < 7 days: 3
- 7-30 days: 5
- 30-90 days: 6
- > 90 days: 3 (candidates for cleanup)

DISCOVERED PEOPLE (not in people.json): 8
```

## Configuration

Optional settings in `.claude/figma-config.json`:

```json
{
  "staleDays": 90,
  "verifyOnSync": true,
  "autoArchiveInaccessible": false,
  "discoverySearchDays": 30,
  "excludeChannels": ["#random", "#social"]
}
```

## Figma API Notes

### Checking File Accessibility

Use `mcp__figma__get_metadata` with minimal parameters:
```
fileKey: "abc123"
nodeId: "0:1"
```

If the file exists and is accessible, this returns metadata.
If not, it returns an error indicating the issue.

### Rate Limiting

- Figma API has rate limits
- For large caches (50+ entries), consider batching verification
- Add small delays between API calls if needed

## Schema Updates

When updating figma-sources.json, ensure schema consistency:

### File Entry Schema

```json
{
  "name": "File Name",
  "type": "design" | "board" | "file" | "make",
  "url": "https://www.figma.com/...",
  "category": "product" | "engineering" | "operations" | "marketing" | "research" | "general",
  "description": "Context from sharing message",
  "owner": {
    "displayName": "Person Name",
    "email": "email@company.com" | null,
    "slackUserId": "U12345678"
  },
  "contributors": [],
  "sharedIn": ["channel-name"],
  "lastShared": "2026-01-30",
  "status": "active" | "stale" | "inaccessible",
  "lastVerified": "2026-01-30",
  "verificationError": null | "error message"
}
```

### Archived Entry Schema

```json
{
  "...all file entry fields...",
  "archivedDate": "2026-01-30",
  "archiveReason": "stale" | "inaccessible" | "manual"
}
```

## Integration with Other Skills

- `/slack-read` - Adds new entries during message processing
- `/prep-meeting` - Adds new entries during channel reading
- `/archive-old` - Can trigger `/sync-figma --cleanup` as part of monthly maintenance

## Notes

- Run periodically (weekly or monthly) to keep cache fresh
- Verification helps identify deleted or restricted files
- Discovery catches links that were shared before cache existed
- Cleanup prevents cache bloat from old, unused files
- Cross-references with people.json for owner resolution
- Statistics help understand design activity patterns
