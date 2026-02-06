# Process Gemini Notes

Process unread Gemini meeting notes emails: extract action items, save summaries, and archive.

## Usage

- `/process-gemini-notes` - Process all unread Gemini notes
- `/process-gemini-notes [meeting-name]` - Process notes for a specific meeting
- `/process-gemini-notes --dry-run` - Preview without archiving emails
- `/process-gemini-notes --resume` - Resume from last completed step/meeting

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

For per-meeting tracking in Steps 2-7:

```
✓ CHECKPOINT: Meeting 2/5 complete - Platform Standup
  Key points: 3 | My action items: 1

Proceeding to Meeting 3/5: Samuel 1:1
```

**IMPORTANT:** Step 9 (Archive Emails) is **destructive**. Always checkpoint before this step.

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/process-gemini-notes --resume`

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume capability
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for meeting notes
- [Error Handling](../patterns/error-handling.md) - Handle API issues gracefully

## Process

### Step 1: Find Unread Gemini Notes

Search Gmail for unread emails from `gemini-notes@google.com`:

```
from:gemini-notes@google.com is:unread
```

For each email, extract:
- **Meeting title**: From subject line (e.g., `Notes: "Platform Standup" Feb 5, 2026`)
- **Meeting date**: From subject line
- **Doc link**: The "Open meeting notes" link in the email body

```
✓ CHECKPOINT: Step 1 complete - Find Unread Gemini Notes
  Emails found: [N]

Proceeding to Step 2: Fetch Meeting Notes Content
```

### Step 2: Fetch Meeting Notes Content

For each email:

1. Get the full email message to extract the Google Doc link
2. The link format is typically: `https://docs.google.com/document/d/[DOC_ID]/...`
3. Fetch the doc content using `docs_get_content`

```
✓ CHECKPOINT: Step 2 complete - Fetch Meeting Notes Content
  Docs fetched: [N] | Failed: [N]

Proceeding to Step 3: Parse Notes Content
```

### Step 3: Parse Notes Content

Gemini auto-notes typically contain:

- **Attendees**: Listed at the top
- **Transcript sections**: Speaker-attributed text
- **Action items**: May be explicitly marked or implied in discussion

#### Extract Action Items

Look for patterns indicating action items:

**Explicit patterns**:
- `[ ]` or `☐` checkboxes
- "Action item:" or "TODO:"
- "will do", "to do", "needs to"

**Assignment patterns** (for identifying who owns the action):
- `[Name] to [action]` or `[Name] will [action]`
- `@[name]` mentions
- `[Name]:` followed by commitment language

**My action items** - flag if any of these appear:
- "Greg to...", "Greg will..."
- "@Greg", "@greg"
- "Greg:" followed by "I'll...", "I will...", "I can..."

```
✓ CHECKPOINT: Step 3 complete - Parse Notes Content
  Action items found: [N] total | My action items: [N]

Proceeding to Step 4: Determine Meeting Type
```

### Step 4: Determine Meeting Type

Infer from meeting title:

| Pattern | Type | Directory |
|---------|------|-----------|
| `1:1`, `1-1`, `one-on-one`, person's name only | one-on-ones | `meetings/output/one-on-ones/` |
| `standup`, `sync`, `squad`, team name | squad | `meetings/output/squad/` |
| `planning`, `sprint`, `retro`, `review` | planning | `meetings/output/planning/` |
| External domain in attendees, `external`, vendor names | external | `meetings/output/external/` |
| Everything else | general | `meetings/output/general/` |

```
✓ CHECKPOINT: Step 4 complete - Determine Meeting Type
  1:1s: [N] | Squad: [N] | Planning: [N] | External: [N] | General: [N]

Proceeding to Step 5: Generate Meeting Summary
```

### Step 5: Generate Meeting Summary

Create a structured summary:

```markdown
---
type: meeting-notes
date: YYYY-MM-DD
meeting: [Meeting Title]
attendees: [list]
source: gemini
tags: [inferred tags]
---

# [Meeting Title] - YYYY-MM-DD

## Attendees
- [list of attendees]

## Key Points

### [Topic 1]
- [Key discussion point]
- [Decision made]

### [Topic 2]
- [Key discussion point]

## Action Items

### For Greg
- [ ] [Action item with context]

### For Others
- [ ] [Person]: [Action item]

## Notes

[Any additional context or raw notes worth preserving]

---
*Auto-generated from Gemini meeting notes*
```

```
✓ CHECKPOINT: Step 5 complete - Generate Meeting Summary
  Summaries generated: [N]

Proceeding to Step 6: Save Summary
```

### Step 6: Save Summary

Save to appropriate directory based on meeting type:

**Filename pattern**: `YYYY-MM-DD-[slug].md`

**Slug generation**:
- For 1:1s: Use the other person's name (e.g., `2026-02-05-samuel-1-1.md`)
- For squad meetings: Use squad name (e.g., `2026-02-05-platform-standup.md`)
- For others: Slugify the meeting title

**If file exists**: Append or update (don't overwrite manual additions)

```
✓ CHECKPOINT: Step 6 complete - Save Summary
  Files saved: [N] | Updated: [N]

Proceeding to Step 7: Create Tasks for My Action Items
```

### Step 7: Create Tasks for My Action Items

For each action item assigned to me:

1. Check if a similar task already exists (fuzzy match on description)
2. If new, offer to create:
   - As a todo in daily context
   - As a Linear ticket (if substantial)
   - Skip (already tracked elsewhere)

```
✓ CHECKPOINT: Step 7 complete - Create Tasks for My Action Items
  Tasks offered: [N] | Created: [N] | Skipped: [N]

Proceeding to Step 8: Update Daily Context
```

### Step 8: Update Daily Context

Append to `context/YYYY-MM-DD/index.md`:

```markdown
## Gemini Notes Processed (HH:MM)
- **Meetings**: X notes processed
- **Summaries saved**: [list of files]
- **My action items**: X items found
- **Tasks created**: X
```

```
✓ CHECKPOINT: Step 8 complete - Update Daily Context
  Daily context updated.

Proceeding to Step 9: Archive Emails
```

### Step 9: Archive Emails (⚠️ DESTRUCTIVE)

**⚠️ This step is destructive - archiving removes emails from inbox.**

Skip if `--dry-run` mode is active.

```
⚠️  DESTRUCTIVE STEP: About to archive [N] emails.
    Progress saved. Resume with: /process-gemini-notes --resume
```

After successful processing, archive each Gemini notes email.

If `--dry-run`, skip this step and show what would be archived.

```
✓ CHECKPOINT: Step 9 complete - Archive Emails
  Archived: [N]
```

## Final Summary

After ALL 9 steps complete, display:

```
# Gemini Notes Processing Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Find Emails       ✓ 2. Fetch Content    ✓ 3. Parse Notes
✓ 4. Determine Type    ✓ 5. Generate Summary ✓ 6. Save Files
✓ 7. Create Tasks      ✓ 8. Update Context   ✓ 9. Archive Emails

## Key Results
- **Meetings processed**: [N]
- **Summaries saved**: [N]
- **My action items**: [N]
- **Tasks created**: [N]
- **Emails archived**: [N]

---
Gemini notes processing complete.
```

## Output Format

```
## Gemini Notes Processing

### Processed: 3 meetings

---

#### 1. Platform Standup (Feb 5, 2026)
- **Type**: squad
- **Attendees**: Greg, Khalifa, Samuel, Rihards, Amber
- **Saved to**: meetings/output/squad/2026-02-05-platform-standup.md

**Key Points**:
- OpenFGA migration on track for next week
- Samuel's PR needs review (PLA-305)

**My Action Items**:
- [ ] Review Samuel's PR by EOD Friday

---

#### 2. Samuel 1:1 (Feb 5, 2026)
- **Type**: one-on-one
- **Attendees**: Greg, Samuel
- **Saved to**: meetings/output/one-on-ones/2026-02-05-samuel-1-1.md

**Key Points**:
- Probation checkpoint Feb 12
- GCP IAM spike going well

**My Action Items**:
- [ ] Schedule probation review meeting

---

#### 3. Think Tank (Feb 5, 2026)
- **Type**: general
- **Attendees**: Greg, Dom, Khalifa, Charles, Byron
- **Saved to**: meetings/output/general/2026-02-05-think-tank.md

**Key Points**:
- OpenFGA RFCs reviewed (Admin access, Banned users)
- Dom's Provider Configuration RFC discussed

**My Action Items**:
- (none)

---

## Summary

| Metric | Count |
|--------|-------|
| Meetings processed | 3 |
| Summaries saved | 3 |
| My action items | 2 |
| Emails archived | 3 |

### Action Items for Greg

1. [ ] Review Samuel's PR by EOD Friday (from Platform Standup)
2. [ ] Schedule probation review meeting (from Samuel 1:1)

Create tasks? [y/N]
```

## Integration with Other Skills

### /triage-inbox

Gemini notes are marked as `alwaysKeep` in email rules. After triage, suggest running `/process-gemini-notes` if unread Gemini notes remain.

### /begin-day

If unread Gemini notes exist during begin-day, note in briefing:
```
**Unread Gemini notes**: 3 meetings need processing
Consider running /process-gemini-notes
```

### /meeting-notes

`/meeting-notes [meeting]` can invoke this skill for a specific meeting if Gemini notes exist.

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /process-gemini-notes --resume"

### Specific Error Cases

- **Doc not accessible**: Note in output, skip to next meeting
- **Empty/minimal notes**: Still save summary, note "minimal content"
- **No action items found**: Normal - not all meetings have action items
- **Email archive fails**: Continue processing, report at end

### Resume Behavior

When `/process-gemini-notes --resume` is run:
1. Check daily context for incomplete processing
2. Skip meetings already processed
3. Resume from last incomplete meeting
4. Continue through remaining steps

## Mode Reference

| Flag | Steps Run | Destructive Step | Use Case |
|------|-----------|------------------|----------|
| (none) | All 9 | Step 9 executes | Normal processing |
| `--dry-run` | 1-8 | Skip 9 | Preview without archive |
| `--resume` | Remaining | If not done | Recovery |

### Step Summary by Mode

| Step | Default | --dry-run |
|------|:-------:|:---------:|
| 1. Find Emails | ✓ | ✓ |
| 2. Fetch Content | ✓ | ✓ |
| 3. Parse Notes | ✓ | ✓ |
| 4. Determine Type | ✓ | ✓ |
| 5. Generate Summary | ✓ | ✓ |
| 6. Save Files | ✓ | ✓ |
| 7. Create Tasks | ✓ | ✓ |
| 8. Update Context | ✓ | ✓ |
| 9. Archive Emails ⚠️ | ✓ | - |

## Notes

- Gemini notes quality varies - some meetings have detailed transcripts, others are sparse
- Action item extraction is heuristic - may need manual review
- For recurring meetings, consider linking to previous notes
- 1:1 notes are sensitive - ensure proper encryption via git-crypt
