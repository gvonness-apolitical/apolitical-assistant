# Archive Old

Monthly maintenance skill to archive old artifacts and maintain a clean working directory.

## Usage

- `/archive-old` - Interactive mode with confirmations
- `/archive-old --dry-run` - Preview what would be archived
- `/archive-old --auto` - Archive without confirmations (for automation)
- `/archive-old --resume` - Resume from last completed step if previous run was interrupted

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

**IMPORTANT:** Steps 4-5 involve file deletion. Always checkpoint before these steps.

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/archive-old --resume`

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume
- [Frontmatter](../patterns/frontmatter.md) - Update archived files' metadata
- [Error Handling](../patterns/error-handling.md) - Graceful degradation

## Purpose

Keep working directories clean by archiving old artifacts according to retention policy, while maintaining searchability of archived content.

## Retention Policy

| Artifact Type | Active Retention | Archive Action |
|--------------|------------------|----------------|
| Daily context (`context/YYYY-MM-DD/`) | 30 days | Compress to `archive/context/YYYY-MM.tar.gz` |
| Briefings (`briefings/`) | 90 days | Move to `archive/briefings/` |
| EOD summaries (`context/eod-*.md`) | 30 days | Include in daily context archive |
| Reviews (weekly/exec) | 1 year | Move to `archive/reviews/` |
| Investigations | Manual | Never auto-archive |
| Work products | 90 days | Move to `archive/work/` |
| Rubberduck | Manual | Never auto-archive |
| Reference | Indefinite | Never archive |

## Process

### Step 1: Scan for Old Artifacts

```
Scanning for artifacts older than retention period...

Daily Context (30 days):
  - context/2025-12-15/ (43 days old)
  - context/2025-12-16/ (42 days old)
  - context/2025-12-17/ (41 days old)
  ...
  Total: 15 day directories

Briefings (90 days):
  - briefings/2025-10-15.md (104 days old)
  - briefings/2025-10-16.md (103 days old)
  ...
  Total: 12 briefings

EOD Summaries (30 days):
  - context/eod-2025-12-15.md (43 days old)
  - context/eod-2025-12-16.md (42 days old)
  ...
  Total: 15 summaries

Work Products (90 days):
  - work/2025-10-20-project-proposal.md (99 days old)
  ...
  Total: 3 work products

Weekly Reviews (1 year):
  - reviews/weekly/2025-01-10.md (382 days old)
  ...
  Total: 2 reviews

Summary:
  - Day directories to compress: 15
  - Briefings to move: 12
  - EOD summaries to include: 15
  - Work products to move: 3
  - Reviews to move: 2
```

```
✓ CHECKPOINT: Step 1 complete - Scan for Old Artifacts
  Context dirs: [N] | Briefings: [N] | EOD: [N] | Work: [N] | Reviews: [N]

Proceeding to Step 2: Confirm Archive
```

### Step 2: Confirm Archive (User Confirmation Gate)

```
Ready to archive 47 items:

[1] Archive all (recommended)
[2] Archive by category (confirm each)
[3] Preview archive structure
[4] Cancel

Choice:
```

Skip if `--auto` mode (proceed with all).

```
✓ CHECKPOINT: Step 2 complete - Confirm Archive
  User choice: [all/by-category/cancel]

Proceeding to Step 3: Create Archive Structure
```

### Step 3: Create Archive Structure

Ensure archive directories exist:
```
archive/
├── context/
├── briefings/
├── work/
└── reviews/
```

```
✓ CHECKPOINT: Step 3 complete - Create Archive Structure
  Directories created: [N]

Proceeding to Step 4: Archive Daily Context
```

### Step 4: Archive Daily Context (⚠️ DESTRUCTIVE)

**⚠️ This step deletes original files after archiving.**

```
⚠️  DESTRUCTIVE STEP: About to compress and delete [N] day directories.
    Progress saved. Resume with: /archive-old --resume
```

For each month with old day directories:

1. **Create month archive**:
   ```
   Creating archive: archive/context/2025-12.tar.gz

   Including:
   - context/2025-12-15/
   - context/2025-12-16/
   - context/2025-12-17/
   - context/eod-2025-12-15.md
   - context/eod-2025-12-16.md
   - context/eod-2025-12-17.md
   ...
   ```

2. **Add manifest**: Include `manifest.json` in archive:
   ```json
   {
     "created": "2026-01-27T10:30:00Z",
     "period": "2025-12",
     "files": [
       {"path": "2025-12-15/index.md", "type": "context-index"},
       {"path": "2025-12-15/orient-0900.md", "type": "orient"},
       {"path": "2025-12-15/slack-1430.md", "type": "slack"},
       {"path": "eod-2025-12-15.md", "type": "eod"}
     ],
     "stats": {
       "days": 17,
       "total_files": 52
     }
   }
   ```

3. **Verify archive**: Confirm archive is valid before deleting originals

4. **Remove originals**: Delete day directories and EOD files

```
✓ CHECKPOINT: Step 4 complete - Archive Daily Context
  Archives created: [N] | Directories removed: [N]

Proceeding to Step 5: Move Other Artifacts
```

### Step 5: Move Other Artifacts (⚠️ DESTRUCTIVE)

**⚠️ This step moves files from active directories to archive.**

For briefings, work products, and reviews:

1. **Move file**: Copy to archive location
2. **Verify copy**: Confirm file exists and is complete
3. **Update frontmatter**: Add `archived: YYYY-MM-DD` to frontmatter
4. **Remove original**: Delete from active location

```
Moving briefings/2025-10-15.md → archive/briefings/2025-10-15.md ✓
Moving briefings/2025-10-16.md → archive/briefings/2025-10-16.md ✓
...
```

```
✓ CHECKPOINT: Step 5 complete - Move Other Artifacts
  Briefings: [N] | Work products: [N] | Reviews: [N]

Proceeding to Step 6: Update Archive Index
```

### Step 6: Update Archive Index

Maintain searchable index at `archive/index.md`:

```markdown
# Archive Index

Last updated: 2026-01-27

## Context Archives

| Period | File | Days | Size |
|--------|------|------|------|
| 2025-12 | context/2025-12.tar.gz | 17 | 2.3 MB |
| 2025-11 | context/2025-11.tar.gz | 30 | 4.1 MB |

## Archived Briefings

| Date | File | Tags |
|------|------|------|
| 2025-10-15 | briefings/2025-10-15.md | planning |
| 2025-10-16 | briefings/2025-10-16.md | |

## Archived Work Products

| Date | File | Title | Tags |
|------|------|-------|------|
| 2025-10-20 | work/2025-10-20-project-proposal.md | Project Proposal | proposal, planning |

## Archived Reviews

| Date | Type | File |
|------|------|------|
| 2025-01-10 | weekly | reviews/2025-01-10.md |

## Quick Search

To find content in archives:
1. Check this index for file locations
2. For compressed archives, extract temporarily: `tar -xzf archive/context/2025-12.tar.gz -C /tmp/`
3. Search extracted content
4. Clean up: `rm -rf /tmp/2025-12/`
```

```
✓ CHECKPOINT: Step 6 complete - Update Archive Index
  Index updated with [N] new entries

Proceeding to Step 7: Report
```

### Step 7: Report

```
Archive Complete
================

Archived:
- 15 day directories → archive/context/2025-12.tar.gz (2.3 MB)
- 15 EOD summaries → included in context archive
- 12 briefings → archive/briefings/
- 3 work products → archive/work/
- 2 reviews → archive/reviews/

Space recovered: 8.7 MB

Archive index updated: archive/index.md

Note: Investigations and rubberduck sessions are not auto-archived.
Run with specific dates to archive manually.
```

```
✓ CHECKPOINT: Step 7 complete - Report
  Summary displayed to user
```

## Final Summary

After ALL 7 steps complete, display:

```
# Archive Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Scan           ✓ 2. Confirm        ✓ 3. Create Structure
✓ 4. Archive Context ✓ 5. Move Artifacts ✓ 6. Update Index
✓ 7. Report

## Key Results
- **Day directories compressed**: [N] → archive/context/
- **EOD summaries included**: [N]
- **Briefings moved**: [N]
- **Work products moved**: [N]
- **Reviews moved**: [N]
- **Space recovered**: [X] MB

---
Archive complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /archive-old --resume"

### Resume Behavior

When `/archive-old --resume` is run:
1. Check daily context for incomplete archive run
2. Skip completed steps
3. Resume from first incomplete step
4. For destructive steps (4-5), verify what was already processed

## Mode Reference

| Flag | Steps Run | Destructive Steps | Use Case |
|------|-----------|-------------------|----------|
| (none) | All 7 | 4, 5 execute with confirmation | Interactive archive |
| `--dry-run` | 1-3, 6-7 | Skip 4-5 | Preview only |
| `--auto` | All 7 | 4, 5 execute without confirmation | Automation |
| `--resume` | Remaining | If not done | Recovery |

### Step Summary by Mode

| Step | Default | --dry-run | --auto |
|------|:-------:|:---------:|:------:|
| 1. Scan | ✓ | ✓ | ✓ |
| 2. Confirm | ✓ | ✓ | - |
| 3. Create Structure | ✓ | ✓ | ✓ |
| 4. Archive Context ⚠️ | ✓ | - | ✓ |
| 5. Move Artifacts ⚠️ | ✓ | - | ✓ |
| 6. Update Index | ✓ | ✓ | ✓ |
| 7. Report | ✓ | ✓ | ✓ |

## Manual Archive

For investigations and rubberduck sessions that should be archived manually:

```
/archive-old investigations/2025-06-15-old-investigation.md
```

This will:
1. Move to `archive/investigations/`
2. Update frontmatter with archive date
3. Update archive index

## Restore from Archive

To restore archived content:

### Single File
```
/archive-old --restore archive/briefings/2025-10-15.md
```

### From Compressed Archive
```
/archive-old --restore archive/context/2025-12.tar.gz --date 2025-12-15
```

This extracts the specific day directory back to `context/`.

## Edge Cases

### Partially Archived Month
If some days in a month are already archived:
- Skip already-archived days
- Add new days to existing archive (re-compress)

### Missing Frontmatter
If a file lacks frontmatter:
- Add basic frontmatter with archive date
- Log warning for manual review

### Large Archives
If archive would exceed 50MB:
- Split by week instead of month
- Warn user about size

### Active References
Check if files being archived are referenced by recent artifacts:
- Scan last 30 days of artifacts for links
- Warn if references found
- Offer to skip or proceed

## Automation

Add to monthly routine:
```
/archive-old --auto
```

Or schedule via cron/launchd to run first of each month.

## Related Maintenance

As part of monthly maintenance, also consider running:

- `/sync-figma --cleanup` - Archive stale Figma entries (>90 days without activity)
- `/sync-people --refresh` - Verify and update people cache

These can be combined in a monthly maintenance routine:
```
/archive-old --auto && /sync-figma --cleanup && /sync-people --refresh
```

## Notes

- Archives preserve original directory structure
- Compressed archives include manifest for easy searching
- Archive index enables quick lookup without extraction
- Restoration is straightforward for both compressed and flat archives
- Manual archive decision for investigations and thinking sessions
- Figma sources are maintained separately via `/sync-figma`
