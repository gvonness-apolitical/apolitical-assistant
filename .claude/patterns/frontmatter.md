# YAML Frontmatter Pattern

Consistent metadata structure for all artifacts to enable searchability and organization.

## When to Use

- Creating any artifact file (briefings, context, reviews, investigations, etc.)
- Updating existing artifacts with new metadata
- Cross-referencing related artifacts

## Files Involved

All artifact files in:
- `briefings/`
- `context/`
- `meetings/output/`
- `reviews/`
- `investigations/`
- `work/`
- `rubberduck/`
- `reference/`

## Required Fields

Every artifact MUST include these fields:

```yaml
---
type: [artifact type]
date: YYYY-MM-DD
---
```

### Type Values

| Value | Description | Directory |
|-------|-------------|-----------|
| `briefing` | Daily briefings | `briefings/` |
| `context` | Daily context files | `context/YYYY-MM-DD/` |
| `review` | Periodic reviews | `reviews/` |
| `investigation` | Research and analysis | `investigations/` |
| `work` | Deliverables for external use | `work/` |
| `rubberduck` | Thinking sessions | `rubberduck/` |
| `reference` | Evergreen documentation | `reference/` |
| `meeting-prep` | Meeting preparation | `meetings/output/` |
| `meeting-notes` | Meeting notes | `meetings/output/` |

## Optional Fields

Add these fields when relevant:

```yaml
---
type: investigation
date: 2026-01-30
tags: [api, integration, humaans]
related:
  - investigations/2026-01-25-humaans-api.md
  - work/2026-01-28-api-design.md
status: draft | final | archived
stakeholders: [Joel, Byron]
subtype: orient | slack | email | todos
time: HH:MM
period: weekly | monthly | quarterly
---
```

### Field Descriptions

| Field | Purpose | Example |
|-------|---------|---------|
| `tags` | Searchable keywords | `[api, auth, sso]` |
| `related` | Links to related artifacts | `[path/to/file.md]` |
| `status` | Work product status | `draft`, `final`, `archived` |
| `stakeholders` | People involved or interested | `[Joel, Byron, Renzo]` |
| `subtype` | Context file subtype | `orient`, `slack`, `email` |
| `time` | Time for timestamped files | `14:30` |
| `period` | Review period type | `weekly`, `monthly` |

## Examples

### Daily Briefing
```yaml
---
type: briefing
date: 2026-01-30
---
```

### Context Orient File
```yaml
---
type: context
subtype: orient
date: 2026-01-30
time: 09:30
---
```

### Investigation
```yaml
---
type: investigation
date: 2026-01-30
tags: [authentication, sso, azure]
related:
  - reference/auth-architecture.md
stakeholders: [Joel, Khalifa]
status: draft
---
```

### Weekly Review
```yaml
---
type: review
date: 2026-01-30
period: weekly
tags: [engineering, q1]
---
```

### Meeting Prep
```yaml
---
type: meeting-prep
date: 2026-01-30
meeting: Joel 1:1
attendees: [Joel Patrick]
related:
  - context/2026-01-30/index.md
---
```

## Parsing Frontmatter

When reading files, parse frontmatter:

```
1. Check if file starts with ---
2. Read until closing ---
3. Parse YAML between delimiters
4. Rest of file is content
```

## Searching by Metadata

Use grep to find artifacts by metadata:

```bash
# Find all investigations
grep -l "type: investigation" investigations/*.md

# Find artifacts about auth
grep -l "tags:.*auth" **/*.md

# Find artifacts involving Joel
grep -l "stakeholders:.*Joel" **/*.md
```

## Skills Using This Pattern

All artifact-producing skills:
- `/orient` - Creates context files with subtype
- `/morning-briefing` - Creates briefings
- `/slack-read` - Creates context/slack files
- `/triage-inbox` - Creates context/email files
- `/weekly-review` - Creates reviews with period
- `/investigation` - Creates investigations
- `/rubberduck` - Creates thinking sessions
- `/save-artifact` - Creates work products
