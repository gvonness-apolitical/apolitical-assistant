# Migrate Artifacts

One-time migration of existing artifacts to the new consolidated structure.

## Usage

- `/migrate-artifacts` - Run migration with confirmation prompts
- `/migrate-artifacts --dry-run` - Preview what would be moved without making changes
- `/migrate-artifacts --force` - Run without confirmation prompts

## Purpose

Migrate existing artifacts from the old directory structure to the new consolidated structure, adding YAML frontmatter to all migrated files.

## Migration Rules

### Morning Briefings
**From:** `morning-briefing/*.md`
**To:** `briefings/*.md`

Files matching `YYYY-MM-DD.md` pattern are moved as-is. Add frontmatter:
```yaml
---
type: briefing
date: YYYY-MM-DD
tags: []
---
```

### Weekly Reviews
**From:** `context/weekly-review-*.md`
**To:** `reviews/weekly/*.md`

Files matching `weekly-review-YYYY-MM-DD.md` become `YYYY-MM-DD.md`. Add frontmatter:
```yaml
---
type: review
date: YYYY-MM-DD
period: week
tags: []
---
```

### Executive Reports
**From:** `context/executive-report-*.md`
**To:** `reviews/executive/*.md`

Files matching `executive-report-YYYY-MM-DD-to-YYYY-MM-DD.md` become `YYYY-MM-DD-to-YYYY-MM-DD.md`. Add frontmatter:
```yaml
---
type: review
date: YYYY-MM-DD
period: custom
range_start: YYYY-MM-DD
range_end: YYYY-MM-DD
tags: []
---
```

### Dated Tech Notes (Investigations)
**From:** `tech-notes/YYYY-MM-DD-*.md`
**To:** `investigations/YYYY-MM-DD-*.md`

Files with date prefix are treated as investigations. Add frontmatter:
```yaml
---
type: investigation
date: YYYY-MM-DD
tags: []
related: []
status: final
---
```

### Undated Tech Notes (Reference)
**From:** `tech-notes/[name].md` (no date prefix)
**To:** `reference/[name].md`

Files without date prefix are reference documentation. Add frontmatter:
```yaml
---
type: reference
tags: []
---
```

### Context Files - Orient
**From:** `context/orient-YYYY-MM-DD-HHMM.md`
**To:** `context/YYYY-MM-DD/orient-HHMM.md`

Create day directory if needed. Add frontmatter:
```yaml
---
type: context
subtype: orient
date: YYYY-MM-DD
time: HH:MM
---
```

### Context Files - Slack Read
**From:** `context/YYYY-MM-DD-HHMM-slack-read.md`
**To:** `context/YYYY-MM-DD/slack-HHMM.md`

Create day directory if needed. Add frontmatter:
```yaml
---
type: context
subtype: slack
date: YYYY-MM-DD
time: HH:MM
---
```

### Context Files - Session Notes
**From:** `context/YYYY-MM-DD-session.md`
**To:** `context/YYYY-MM-DD/session.md`

Create day directory if needed. Add frontmatter:
```yaml
---
type: context
subtype: session
date: YYYY-MM-DD
---
```

### Work Products (Ad-hoc files in context/)
**From:** `context/YYYY-MM-DD-[slug].md` (not matching other patterns)
**To:** `work/YYYY-MM-DD-[slug].md`

Add frontmatter:
```yaml
---
type: work
date: YYYY-MM-DD
tags: []
status: final
---
```

### Files to Leave in Place
- `context/eod-*.md` - EOD summaries stay flat
- `context/preferences.json` - Config file
- `context/store.db` - Database
- `context/daily/` - Already in new structure

## Process

### 1. Scan Existing Files

```
Scanning for artifacts to migrate...

morning-briefing/
  - 2026-01-22.md → briefings/2026-01-22.md
  - 2026-01-23.md → briefings/2026-01-23.md
  - 2026-01-26.md → briefings/2026-01-26.md
  - 2026-01-27.md → briefings/2026-01-27.md

context/
  - weekly-review-2026-01-24.md → reviews/weekly/2026-01-24.md
  - executive-report-2026-01-16-to-2026-01-22.md → reviews/executive/2026-01-16-to-2026-01-22.md
  - orient-2026-01-25-1000.md → context/2026-01-25/orient-1000.md
  - orient-2026-01-26-1000.md → context/2026-01-26/orient-1000.md
  - 2026-01-26-1742-slack-read.md → context/2026-01-26/slack-1742.md
  - 2026-01-26-canvas-investigation.md → investigations/2026-01-26-canvas-investigation.md
  - 2026-01-26-data-lead-cv-review.md → work/2026-01-26-data-lead-cv-review.md
  - 2026-01-26-data-lead-cv-review-summary.md → work/2026-01-26-data-lead-cv-review-summary.md
  - 2026-01-22-session.md → context/2026-01-22/session.md
  - 2026-01-24-session.md → context/2026-01-24/session.md
  - 2026-01-26-session.md → context/2026-01-26/session.md
  - 2026-01-27-session.md → context/2026-01-27/session.md

tech-notes/
  - 2026-01-26-humaans-linear-incidentio-integration-feasibility.md → investigations/2026-01-26-humaans-linear-incidentio-integration-feasibility.md
  - architecture.md → reference/architecture.md
  - getstream.md → reference/getstream.md

Total: X files to migrate
```

### 2. Confirm Migration

```
Ready to migrate X files. This will:
- Move files to new locations
- Add YAML frontmatter to each file
- Create day directories as needed

[1] Proceed with migration
[2] Show detailed preview
[3] Cancel

Choice:
```

### 3. Execute Migration

For each file:
1. Read original content
2. Check if frontmatter already exists (skip if present)
3. Prepend appropriate frontmatter
4. Write to new location
5. Verify write succeeded
6. Delete original (or move to backup)

Progress output:
```
Migrating artifacts...

[1/18] morning-briefing/2026-01-22.md → briefings/2026-01-22.md ✓
[2/18] morning-briefing/2026-01-23.md → briefings/2026-01-23.md ✓
...
```

### 4. Create Day Index Files

For each day directory created, generate initial `index.md`:

```markdown
---
type: context
date: YYYY-MM-DD
---

# Daily Context - YYYY-MM-DD

## Session Log

| Time | Activity | Summary |
|------|----------|---------|
| HH:MM | Orient | Migrated from legacy location |

## Active Items

_Migrated from previous structure_

## Links

- [Morning Briefing](../briefings/YYYY-MM-DD.md)
```

### 5. Cleanup

```
Migration complete!

Files migrated: X
Frontmatter added: X
Day directories created: X
Index files created: X

Empty directories to remove:
- morning-briefing/ (now empty)

Remove empty directories? [y/n]:
```

### 6. Generate Report

Write migration report to `context/migration-report-YYYY-MM-DD.md`:

```markdown
# Artifact Migration Report

**Date:** YYYY-MM-DD HH:MM
**Files Migrated:** X

## Moves

| Original | New Location | Status |
|----------|--------------|--------|
| morning-briefing/2026-01-22.md | briefings/2026-01-22.md | ✓ |
| ... | ... | ... |

## Directories Created
- briefings/
- reviews/weekly/
- reviews/executive/
- investigations/
- work/
- reference/
- context/2026-01-22/
- context/2026-01-24/
- context/2026-01-25/
- context/2026-01-26/
- context/2026-01-27/

## Directories Removed
- morning-briefing/

## Notes
- All files received YAML frontmatter
- Day index files created for migrated context
```

## Edge Cases

### Files with Existing Frontmatter
If a file already has YAML frontmatter (starts with `---`), preserve it and only add missing fields.

### Ambiguous Files
Files that don't match known patterns:
- List them separately
- Ask user to classify manually
- Options: investigation, work, reference, skip

### Name Conflicts
If destination file already exists:
- Compare contents
- If identical, skip and delete source
- If different, rename with `-migrated` suffix and warn

### Large Files
For files > 100KB:
- Warn user
- Ask for confirmation before moving

## Notes

- Run this skill once to migrate to the new structure
- Future artifacts will be created in the correct locations by updated skills
- Migration report is saved for audit purposes
- Empty directories are removed after confirmation
