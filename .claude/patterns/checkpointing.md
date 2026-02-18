# Checkpointing Pattern

Checkpoint discipline for multi-step skills to enable progress tracking, resume capability, and graceful error handling.

## When to Use

- Skills with 5+ sequential steps
- Skills with destructive operations (delete, archive, mark-as-read)
- Skills with user confirmation gates
- Skills involving parallel API calls to multiple sources
- Long-running operations that may be interrupted

## Enforcement Rules

These rules make faked or skipped checkpoints structurally detectable. Every checkpoint is an audit trail of actual execution.

### Rule 1: Tool Call Audit

Every checkpoint marker MUST include a `Tools:` line listing the MCP tools actually called during that step, with call counts for multi-source steps. A checkpoint without tool calls listed is invalid (unless the step is purely computational, like deduplication or file writing).

Format:
```
✓ CHECKPOINT: Step 4 complete - Email Triage
  Processed: 39 | Trashed: 20 | Archived: 11 | Respond: 2
  Tools: gmail_search ×1, gmail_trash ×1, gmail_archive ×1
```

For multi-source steps:
```
✓ CHECKPOINT: Step 6 complete - Slack Read
  DMs: 7 read | Channels: 3 read | Action items: 2
  Tools: slack_read_dm ×7, slack_read_channel ×3
```

If you cannot list tools with counts, you haven't done the step.

### Rule 2: Execute, Don't Summarise

Each step must involve actual tool calls. A step that says "fetch emails" means calling `gmail_search` — not reviewing emails you saw in a previous step. A step that says "read channels" means calling `slack_read_channel` — not paraphrasing the orient snapshot. Each step does its own work.

### Rule 3: Metrics Are Mandatory

Every checkpoint must include counts/metrics from actual execution. Valid: `Items: 0`. Invalid: `Nothing found` without having checked. Invalid: `All noise` without having applied rules.

### Rule 4: Task Creation Before Checkpoint

If a step discovers action items, create tasks (with `P{n}.{m}:` format) via TaskCreate BEFORE outputting the checkpoint. The checkpoint references the task IDs. The step is not complete until the tasks exist.

### Rule 5: No Silent Skips

A step can only be skipped with the `⊘` marker AND a mode flag that justifies skipping (e.g., `--quick`, `--focus`). You cannot skip a step just because you think it won't find anything. If the mode requires it, execute it.

### Rule 6: Post-Skill TaskList Verification

For skills that create tasks (update-todos, triage-inbox, begin-day), the final checkpoint MUST include a TaskList call verifying all created tasks have `P{n}.{m}:` prefixes. If any don't, fix them before completing the skill.

### Anti-Pattern Gallery

Real failures observed in practice — these are WRONG and must not be repeated:

| Anti-Pattern | What Happened | Correct Behaviour |
|---|---|---|
| "10 emails, all noise" | Eyeballed 10 of 39 emails, didn't load rules or execute trash/archive | Fetch 50, apply rules, call gmail_trash + gmail_archive, report metrics |
| "Steps 4-7 complete" in one block | Batched 4 steps, skipped actual execution of 3 of them | Complete one step, output checkpoint with tool audit, then start next |
| "Found 12 items: [list]" | Listed items in prose, never called TaskCreate | Call TaskCreate for each item with P{n}.{m}: prefix before checkpoint |
| "All meetings done, moving on" | Summarised calendar from memory without calling calendar API | Call calendar_list_events, report actual meeting data |
| "7 DMs — 2 action items" | Paraphrased orient snapshot, didn't call slack_read_dm | Call slack_read_dm ×7, extract action items from actual messages |
| Tasks without P-prefix | Created "Respond to Jess Sansom" | Must be "P1.1: Respond to Jess Sansom" |

## Files Involved

- `context/YYYY-MM-DD/index.md` - Daily context index for progress tracking
- `context/YYYY-MM-DD/[skill]-state.json` - State file for long-running skills (mbr, catchup)
- Skill output files - For preserving partial results

## Checkpoint Markers

### Completion Marker

After each step completes successfully, output:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary with metrics]

Proceeding to Step N+1: [next step name]
```

### Skipped Marker

When a step is skipped due to mode flag or condition:

```
⊘ CHECKPOINT: Step N skipped - [step name] ([reason])

Proceeding to Step N+1: [next step name]
```

### Examples

```
✓ CHECKPOINT: Step 2 complete - Orient
  Calendar: 5 meetings | Email: 12 unread | Slack: 3 DMs | Linear: 4 assigned

Proceeding to Step 3: Email Triage
```

```
⊘ CHECKPOINT: Step 3 skipped - Email Triage (--quick mode)

Proceeding to Step 4: Process Gemini Notes
```

## Per-Source Tracking

For steps involving parallel API calls to multiple sources, track each source individually:

```markdown
## Step 5: Gather External Context

Sources:
- [x] OKR Tracker - 3 initiatives found
- [x] Incident.io - 0 incidents
- [x] Humaans - 2 team changes
- [ ] Linear - (in progress)
- [ ] GitHub
- [ ] Slack
- [ ] Notion

If interrupted: Resume retries incomplete sources, skips completed ones.
```

### Source Status Indicators

| Indicator | Meaning |
|-----------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| `[!]` | Failed (will retry on resume) |
| `[-]` | Skipped (not applicable) |

## Progress Tracking

### Daily Context Index

For skills that complete within a session, append progress to `context/YYYY-MM-DD/index.md`:

```markdown
## [Skill Name] (HH:MM)
- **Mode**: [Normal / Quick / Focus / etc.]
- **Steps completed**: 1, 2, 3, 4, 5
- **Steps skipped**: 6, 7 (--quick mode)
- **Key metrics**: [summary]
```

### State Files

For long-running skills (mbr, catchup, executive-report), create a state file:

**Location**: `context/YYYY-MM-DD/[skill]-state.json`

**Structure**:
```json
{
  "skill": "mbr",
  "startedAt": "2026-01-30T09:00:00Z",
  "currentStep": 5,
  "stepsCompleted": [1, 2, 3, 4],
  "stepsSkipped": [],
  "data": {
    "step1": { "month": "2026-01" },
    "step2": { "previousRag": "green" },
    "step3": { "analyticsDoc": "doc-id" },
    "step4": { "repoContext": { "weeklyReviews": 4 } }
  },
  "sourceProgress": {
    "step5": {
      "okrTracker": { "status": "complete", "result": { "initiatives": 3 } },
      "incidents": { "status": "complete", "result": { "count": 0 } },
      "humaans": { "status": "in_progress" },
      "linear": { "status": "pending" }
    }
  },
  "userDecisions": {
    "exceptionsAccepted": ["lead-time", "incident-followup"],
    "ragConfirmed": false
  },
  "lastUpdated": "2026-01-30T09:15:00Z"
}
```

### State File Operations

**Writing state** - After each step:
```
1. Load existing state (or create new)
2. Update currentStep
3. Add step to stepsCompleted
4. Store step data in data.[stepN]
5. Update lastUpdated
6. Write back to file
```

**Reading state** - For resume:
```
1. Load state file
2. Find last completed step
3. Restore data from completed steps
4. Resume from currentStep
```

**Cleaning up** - After skill completes:
```
1. State file can be deleted (ephemeral)
2. Or preserved with status: "complete" for debugging
```

## Resume Logic

### Resume Flag

Skills support `--resume` flag to continue from last completed step:

```
/mbr --resume
/catchup --resume
/slack-read --resume
```

### Resume Algorithm

```
1. Check for state file at context/YYYY-MM-DD/[skill]-state.json
2. If found and status != "complete":
   a. Load state
   b. Display: "Resuming from Step N (last completed: N-1)"
   c. Restore data from completed steps
   d. Skip to first incomplete step
   e. Continue execution
3. If not found or status == "complete":
   a. Display: "No incomplete run found. Starting fresh."
   b. Begin from Step 1
```

### Resume Output

```
Resuming /mbr from Step 7 (Analyze & Determine RAG)

Previously completed:
✓ 1. Parse Month & Validate - January 2026
✓ 2. Load Previous MBR - RAG: green
✓ 3. Read Dev Analytics - Director report loaded
✓ 4. Read Repo Context - 4 weekly reviews, 12 EOD summaries
✓ 5. Gather External Context - 6/6 sources complete
✓ 6. Auto-Suggest Exceptions - 3 candidates identified

Continuing from Step 7...
```

## Error Handling Integration

When a step fails:

1. **Log the error**:
   ```
   ✗ CHECKPOINT: Step N failed - [step name]
     Error: [error message]
   ```

2. **Save progress** to state file with error info:
   ```json
   {
     "currentStep": 5,
     "stepsCompleted": [1, 2, 3, 4],
     "stepErrors": {
       "5": {
         "error": "Linear API timeout",
         "timestamp": "2026-01-30T09:20:00Z",
         "retryable": true
       }
     }
   }
   ```

3. **Continue if possible**:
   - For non-critical steps, mark as skipped and continue
   - For critical steps, save state and suggest resume

4. **Report in final summary**:
   ```
   ## Steps with Errors
   - Step 5 (Gather External Context): Linear API timeout
     → Used cached data instead
   ```

5. **Suggest recovery**:
   ```
   Some steps had errors. Options:
   [1] Resume with: /[skill] --resume
   [2] Retry failed sources only
   [3] Continue with partial data
   ```

## Destructive Operations

For steps with destructive operations (delete, archive, mark-as-read):

### Pre-Destructive Checkpoint

**Always checkpoint BEFORE destructive operations**:

```
✓ CHECKPOINT: Step 5 complete - Generate Summary
  234 messages analyzed, 5 action items found

Ready for Step 6: Mark as Read

⚠️  DESTRUCTIVE: This step will mark 234 messages as read.
    State saved. Resume with: /slack-read --resume

Proceed with marking messages as read? [y/N]
```

### Confirmation Gates

For bulk destructive operations:

```
## Step 8: Execute Bulk Actions

About to perform destructive actions:
- Delete 12 emails (recoverable in Trash for 30 days)
- Archive 25 emails
- Mark 234 Slack messages as read

State saved. If cancelled, resume with: /triage-inbox --resume

Confirm actions? [y/N]
```

## Final Summary

After ALL steps complete (or explicitly skipped), display a final summary:

```
# [Skill Name] Complete - YYYY-MM-DD

## Steps Completed
✓ 1. [Name]  ✓ 2. [Name]  ✓ 3. [Name]  ⊘ 4. [Name] (skipped)
✓ 5. [Name]  ✓ 6. [Name]  ✓ 7. [Name]

## Key Results
- [Primary outcome with metrics]
- [Secondary outcomes]

## Errors/Warnings
- [Any steps that had issues]

---
[Skill] complete.
```

## Mode Reference Table

Each skill with checkpointing should include a mode reference table:

```markdown
## Mode Reference

| Flag | Steps Run | Steps Skipped | Use Case |
|------|-----------|---------------|----------|
| (none) | All | None | Normal execution |
| `--quick` | 1, 2, 7 | 3, 4, 5, 6 | Fast, cache-only |
| `--focus` | 1, 2, 8 | 3, 4, 5, 6, 7 | Deep work mode |
| `--resume` | Remaining | Completed | Recovery |
| `--dry-run` | All except destructive | Destructive | Preview |

### Step Summary by Mode

| Step | Default | --quick | --focus | --dry-run |
|------|:-------:|:-------:|:-------:|:---------:|
| 1. [Name] | ✓ | ✓ | ✓ | ✓ |
| 2. [Name] | ✓ | ✓ | ✓ | ✓ |
| 3. [Name] | ✓ | - | - | ✓ |
...
```

## Skills Using This Pattern

Skills that implement checkpointing:

| Skill | Steps | State File | Destructive Steps |
|-------|-------|------------|-------------------|
| `/begin-day` | 8 | No (daily index) | None |
| `/mbr` | 12 | Yes | Google Doc creation |
| `/catchup` | 5 per day | Yes | None |
| `/slack-read` | 7 | No (daily index) | Step 6 (mark-as-read) |
| `/triage-inbox` | 8 | No (email-rules.json) | Step 8 (delete/archive) |
| `/process-gemini-notes` | 9 | No (daily index) | Step 9 (email archive) |
| `/update-todos` | 5 sources | No (daily index) | None |
| `/archive-old` | 7 | No | Step 6 (file deletion) |
| `/weekly-review` | 8 | No (daily index) | None |
| `/executive-report` | 6 | No (daily index) | None |
| `/prep-meeting` | 5-7 | No (meeting-config) | None |
| `/sync-people` | 7 | No | None |
| `/sync-figma` | 5 | No | Step 4 (cleanup) |

## Implementation Checklist

When adding checkpointing to a skill:

- [ ] Add "Checkpoint Discipline" section after Usage
- [ ] Number all steps clearly (### Step N: Name)
- [ ] Add checkpoint marker template after each step
- [ ] Add per-source tracking for parallel steps
- [ ] Add `--resume` flag to Usage
- [ ] Implement state file (if long-running)
- [ ] Add checkpoint before destructive operations
- [ ] Add final summary template
- [ ] Add mode reference table
- [ ] Update error handling to save state
- [ ] Test resume functionality
