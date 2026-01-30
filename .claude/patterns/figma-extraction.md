# Figma Link Extraction Pattern

Extract Figma links from text and persist them to the figma-sources.json cache.

## When to Use

- Processing Slack messages that may contain Figma links
- Reading channel content for meeting preparation
- Scanning documents for design references

## Files Involved

- `.claude/figma-sources.json` - Figma files cache
- `.claude/people.json` - For cross-referencing owners

## URL Patterns

Recognized Figma URL formats:

```
https://www.figma.com/design/[fileKey]/[name]   → Design files
https://www.figma.com/board/[fileKey]/[name]    → FigJam boards
https://www.figma.com/file/[fileKey]/[name]     → Legacy format
https://www.figma.com/make/[fileKey]/[name]     → Slide decks
```

Optional parameters:
- `?node-id=X-Y` - Specific node reference
- `?type=design` - Type hint

## Algorithm

### Step 1: Detect URLs

```regex
https?://(?:www\.)?figma\.com/(design|board|file|make)/([a-zA-Z0-9]+)/([^?\s]+)(?:\?[^\s]*)?
```

Captures:
- Group 1: Type (design, board, file, make)
- Group 2: fileKey
- Group 3: URL-encoded name

### Step 2: Parse Components

```
1. Extract fileKey from URL path
2. Determine type (design, board, file, make)
3. URL-decode the file name
4. Extract node-id if present in query params
```

### Step 3: Capture Context

From the surrounding context, capture:

```json
{
  "owner": {
    "displayName": "Message author name",
    "email": "email if known from people.json",
    "slackUserId": "U12345"
  },
  "sharedIn": ["channel-name"],
  "lastShared": "2026-01-30",
  "description": "First 200 chars of surrounding text"
}
```

### Step 4: Cross-Reference People

```
1. Get message author's Slack user ID
2. Check people.json indices.bySlackUserId
3. If found:
   → Use their email as owner.email
   → Use their displayName
4. If not found:
   → Add to figma-sources.json discoveredPeople section
```

### Step 5: Infer Category

Based on channel name patterns:

| Pattern | Category |
|---------|----------|
| `*engineering*`, `*platform*`, `*data*`, `*infrastructure*` | engineering |
| `*product*`, `*roadmap*`, `*feature*` | product |
| `*design*`, `*ux*`, `*ui*` | design |
| `*marketing*`, `*comms*`, `*brand*` | marketing |
| `*partnerships*`, `*sales*`, `*customer*` | partnerships |
| `*incident*`, `*bug*`, `*support*` | operations |
| (default) | general |

### Step 6: Update Cache

```
1. Load .claude/figma-sources.json
2. Check if fileKey exists in files object

IF new entry:
  → Add to files with full metadata
  → Add fileKey to indices.byCategory[category]
  → Add fileKey to indices.byOwnerSlackId[slackUserId]

IF existing entry:
  → Update lastShared if more recent
  → Append channel to sharedIn if not present
  → Update description if new context is more informative
  → Update owner info if we now have more details

3. Update lastUpdated timestamp
4. Write file back
```

## Example

Input message:
```
Check out the new user flow design:
https://www.figma.com/design/abc123/Homepage-Redesign?node-id=1-2
```

Extracted:
```json
{
  "abc123": {
    "name": "Homepage Redesign",
    "type": "design",
    "url": "https://www.figma.com/design/abc123/Homepage-Redesign",
    "nodeId": "1-2",
    "category": "product",
    "owner": {
      "displayName": "Tanya Riordan",
      "email": "tanya.riordan@apolitical.co",
      "slackUserId": "U09ECJKFLV7"
    },
    "sharedIn": ["product-design"],
    "lastShared": "2026-01-30",
    "description": "Check out the new user flow design"
  }
}
```

## Index Structure

```json
{
  "indices": {
    "byCategory": {
      "product": ["abc123", "def456"],
      "engineering": ["ghi789"]
    },
    "byOwnerSlackId": {
      "U09ECJKFLV7": ["abc123"],
      "U04A8BBTBEC": ["ghi789"]
    }
  }
}
```

## Skills Using This Pattern

- `/slack-read` - Extracts Figma links from all processed messages
- `/prep-meeting` - Extracts from channel content during meeting prep
- `/sync-figma` - Validates and maintains the cache
