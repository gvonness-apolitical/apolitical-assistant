# Engineering Monthly Business Review (MBR)

Generate the Engineering MBR following Mark Douglas's format: header block, 5-8 line prose commentary, and exception register.

## Usage

- `/mbr [month]` - Generate MBR for specified month
- `/mbr` - Interactive mode (will prompt for month)
- `/mbr --resume` - Resume from last completed step if previous run was interrupted

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

If a step is skipped (due to unavailable data), note it explicitly:

```
⊘ CHECKPOINT: Step N skipped - [step name] ([reason])

Proceeding to Step N+1: [next step name]
```

**Progress tracking:** State saved to `context/YYYY-MM-DD/mbr-state.json`
**Resume with:** `/mbr --resume`

### State File Structure

```json
{
  "skill": "mbr",
  "month": "2026-01",
  "startedAt": "2026-01-30T09:00:00Z",
  "currentStep": 5,
  "stepsCompleted": [1, 2, 3, 4],
  "data": {
    "analyticsDocId": "doc-id",
    "previousRag": "green",
    "repoContext": {},
    "externalContext": {}
  },
  "sourceProgress": {
    "okrTracker": "complete",
    "incidents": "complete",
    "humaans": "in_progress",
    "linear": "pending",
    "github": "pending",
    "slack": "pending",
    "notion": "pending"
  },
  "userDecisions": {
    "proceedWithoutAnalytics": false,
    "exceptionsAccepted": [],
    "ragConfirmed": false,
    "draftApproved": false
  },
  "lastUpdated": "2026-01-30T09:15:00Z"
}
```

## Arguments

- `$ARGUMENTS` - Month to report on (optional). Accepts:
  - `January 2026` / `Jan 2026` - Named month
  - `2026-01` - YYYY-MM format
  - `last month` - Previous calendar month
  - If omitted, prompt user to confirm month

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - State file and resume capability
- [Error Handling](../patterns/error-handling.md) - Graceful degradation for API failures
- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context on completion
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for MBR file

## Process

### Step 1: Parse Month & Validate

Resolve the argument to a YYYY-MM period:
- **Named month**: Parse "January 2026" → 2026-01
- **YYYY-MM**: Use directly
- **last month**: Previous calendar month
- **No argument**: Prompt user to select month

Then check for the dev analytics director report:
1. Search Google Drive for the director report matching the month (e.g., "Director Report January 2026" or similar)
2. If found, note the document ID for step 3
3. If not found, warn: "Dev analytics director report not found for [month]. Have analytics been run? The MBR relies heavily on this data."
4. Ask user to confirm whether to proceed (with or without analytics)
5. **Save state**: Record month and user decision in state file

```
✓ CHECKPOINT: Step 1 complete - Parse Month & Validate
  Month: January 2026 | Analytics report: [found/not found]

Proceeding to Step 2: Load Previous MBR
```

### Step 2: Load Previous MBR

Check `reviews/mbr/` for the prior month's MBR:
- If found, read it and extract:
  - Previous RAG status (topline)
  - Commentary themes
  - Exception register items (any unresolved)
  - This enables variance comparisons ("RAG unchanged at ...", "Lead time flagged last month has now recovered")
- If not found (first MBR), note: "No previous MBR found — this will be the baseline"
- **Save state**: Record previous RAG and themes

```
✓ CHECKPOINT: Step 2 complete - Load Previous MBR
  Previous RAG: [green/amber/red] | Unresolved exceptions: [N]

Proceeding to Step 3: Read Dev Analytics
```

### Step 3: Read Dev Analytics

Read the director report and all squad reports from Google Drive/Docs:

**Director Report** — extract:
- DORA metrics (deployment frequency, lead time, change failure rate, MTTR) with trend indicators
- Delivery volume and throughput
- Ticket flow metrics (created vs completed, backlog trends)
- QA metrics (bug rates, test coverage trends)
- Team composition numbers

**Squad Reports** (all 5 squads) — extract:
- Squad-specific DORA and delivery metrics
- Notable outliers vs org average

**Pre-classify metrics**:
- **Topline wins**: Metrics with green/improving trend status
- **Concerns**: Metrics with red/warning trend status or that dropped a DORA level
- This classification accelerates the analysis step

**Save state**: Store analytics data in state file

```
✓ CHECKPOINT: Step 3 complete - Read Dev Analytics
  Director report: [loaded/skipped] | Squad reports: [N] read | Metrics classified: [wins/concerns]

Proceeding to Step 4: Read Repo Context
```

### Step 4: Read Repo Context

Gather local context for the month (YYYY-MM):

1. **Weekly reviews**: `reviews/weekly/YYYY-MM-*.md` for weeks in the month
2. **Executive reports**: `reviews/executive/*` covering the month period
3. **EOD summaries**: `context/eod-YYYY-MM-*.md` for days in the month
4. **Briefings**: `briefings/YYYY-MM-*.md` for days in the month
5. **Meeting notes**: `meetings/output/**/*` for the month
6. **Investigations**: `investigations/YYYY-MM-*.md`

Extract themes: recurring topics, decisions made, escalations, wins.

**Save state**: Store repo context summary in state file

```
✓ CHECKPOINT: Step 4 complete - Read Repo Context
  Weekly reviews: [N] | EOD summaries: [N] | Meeting notes: [N] | Themes extracted: [N]

Proceeding to Step 5: Gather External Context
```

### Step 5: Gather External Context

Query external systems for supplementary data. Track each source for resume capability:

**Source Progress Tracking:**
```markdown
Sources:
- [ ] OKR Tracker - (pending)
- [ ] Incident.io - (pending)
- [ ] Humaans - (pending)
- [ ] Linear - (pending)
- [ ] GitHub - (pending)
- [ ] Slack - (pending)
- [ ] Notion - (pending)
- [ ] Asana - (pending)

If interrupted: Resume retries incomplete sources, skips completed ones.
```

#### OKR Tracker (PANTHEON)
- Read Google Sheet `1DAQkiXe5WISbTA0aEqUBlVCQ595CG61Vwosk9ZfAc2w`
- Extract engineering initiative RAG statuses, drivers, and asks
- Note any RAG changes from previous month
- **Mark source complete in state**

#### Incident.io (`mcp__incident-io__*`)
- List incidents for the month
- Note P0/P1 incidents, resolution status, outstanding follow-ups
- Get postmortems for resolved incidents
- **Mark source complete in state**

#### Humaans (`mcp__humaans__*`)
- Team changes: joiners, leavers, role changes during the month
- Current headcount
- **Mark source complete in state**

#### Linear (`mcp__linear__*`)
- Projects completed or with significant milestones
- Epic/initiative progress
- **Mark source complete in state**

#### GitHub (`mcp__github__*`)
- Major releases during the month
- Notable repository activity
- **Mark source complete in state**

#### Slack (`mcp__slack__*`)
- Search `#engineering` for wins, announcements
- Search `#incidents` for incident context
- Search for "shipped", "launched", "released" in engineering channels
- **Mark source complete in state**

#### Notion (`mcp__notion__*`)
- RFCs published or approved during the month
- Architecture decisions
- **Mark source complete in state**

#### Gmail (`mcp__google__gmail_*`)
- Stakeholder updates sent/received about engineering
- Cross-functional coordination threads
- **Mark source complete in state**

#### Asana (`.claude/asana-sources.json`)
- Goal progress for the month
- Cross-functional project completions involving engineering team members
- Portfolio status changes
- Frame as "cross-functional contributions" — distinct from Linear engineering delivery
- **Mark source complete in state**

```
✓ CHECKPOINT: Step 5 complete - Gather External Context
  Sources: 8/8 complete | OKR: [N] initiatives | Incidents: [N] | Team changes: [N]

Proceeding to Step 6: Auto-Suggest Exceptions
```

### Step 6: Auto-Suggest Exceptions (User Confirmation Gate)

Before drafting, analyze collected data and flag candidate exception items:

**Auto-detection rules:**
- Any metric that changed DORA level (e.g., High -> Medium)
- Any P0/P1 incident not fully resolved or with outstanding follow-ups
- Any OKR initiative whose RAG changed during the month
- Any metric with red trend status in the director report
- Any significant team change (>1 joiner/leaver in the month)

**Present candidates to user:**
```
Suggested exception items based on data:

1. [Amber] Lead time for changes increased from 2.1d to 4.8d (High -> Medium DORA level)
2. [Red] P1 incident INC-234 has 2 outstanding follow-ups past deadline
3. [Amber] OKR "Platform reliability" moved from Green to Amber

Accept all / Select which to include / Add your own:
```

Use AskUserQuestion to let the user accept, reject, or modify the suggested exceptions, and add any they want to include manually.

**Save state**: Record selected exceptions in userDecisions

```
✓ CHECKPOINT: Step 6 complete - Auto-Suggest Exceptions
  Candidates suggested: [N] | Accepted: [N] | User-added: [N]

Proceeding to Step 7: Analyze & Determine RAG
```

### Step 7: Analyze & Determine RAG (User Confirmation Gate)

Assess the topline RAG status using weighted signals:

| Signal | Weight | Source |
|--------|--------|--------|
| DORA metric trends | High | Dev analytics director report |
| Delivery volume trend | High | Dev analytics director report |
| Incident count/severity | High | Incident.io |
| OKR initiative RAGs | Medium | PANTHEON sheet |
| Team stability | Medium | Humaans |
| Cycle time / ticket flow | Medium | Dev analytics director report |

**RAG criteria:**
- **Green**: DORA metrics stable or improving, delivery on track, no unresolved P0/P1 incidents, OKRs on track, team stable
- **Amber**: One or two areas of concern (DORA level drop, delivery below trend, OKR slippage, notable incident), but contained/recovering
- **Red**: Multiple areas of concern, delivery significantly impacted, unresolved critical incidents, or systemic issues

**Compare with previous month:**
- If RAG unchanged: "RAG unchanged at [status]"
- If RAG improved: "RAG improved from [prev] to [current]"
- If RAG worsened: "RAG moved from [prev] to [current]"

Present the proposed RAG to the user with rationale. Allow override.

**Save state**: Record RAG decision and user confirmation

```
✓ CHECKPOINT: Step 7 complete - Analyze & Determine RAG
  Proposed RAG: [green/amber/red] | Previous: [status] | User confirmed: [yes/override]

Proceeding to Step 8: Draft MBR
```

### Step 8: Draft MBR (User Confirmation Gate)

Compose the MBR following Mark's format exactly:

```markdown
# Engineering | Monthly Business Review (Month YYYY)

**Owner:** Greg von Nessi
**Period:** Month YYYY
**RAG (topline):** [emoji] [Status]

## Commentary

[5-8 lines of prose paragraph. Structure: topline verdict and context -> what changed and why (bold key metrics) -> levers pulled or in play -> forward risk or watch items. Use bold for metrics and key facts. Use italic for emphasis on trajectory or sentiment. Single flowing paragraph, not bullet points.]

## Exception Register

| RAG | What changed & why | Ask |
|-----|-------------------|-----|
| [emoji] [Status] | [Specific change with data] | [Action, owner, deadline] |
```

**Formatting rules:**
- Use UTF emoji circles directly: use the actual Unicode characters for green circle, yellow circle, red circle
- Bold key metrics in commentary (e.g., **4.2 deploys/day**)
- Italic for trajectory/sentiment (e.g., *continuing the upward trend*)
- Exception register: max 3 rows (from accepted candidates in step 6)
- If no exceptions: include table with single row "None — no exceptions this month"
- Commentary must be a single prose paragraph, not bullets or multiple sections

**Present draft to user for review:**
```
Draft MBR for [Month YYYY]:

[full draft]

---
Review: Accept / Edit / Regenerate?
```

Use AskUserQuestion to get user approval before proceeding to publish.

**Save state**: Record draft content and user approval

```
✓ CHECKPOINT: Step 8 complete - Draft MBR
  Draft generated: [N] words | User approved: [yes/revision requested]

Proceeding to Step 9: Create Google Doc
```

### Step 9: Create Google Doc

Once the user approves the draft:

1. Use `docs_create` to create the Google Doc with the MBR content
2. Title: "Engineering MBR — [Month YYYY]"
3. Content: The approved markdown content
4. The Google Docs tool accepts markdown — bold, italic, tables, and headings will render correctly

Note the document URL for the user and for the local copy.

**Save state**: Record Google Doc URL

```
✓ CHECKPOINT: Step 9 complete - Create Google Doc
  Doc created: [url]

Proceeding to Step 10: Save Local Copy
```

### Step 10: Save Local Copy

Save to `reviews/mbr/YYYY-MM.md` with YAML frontmatter and data sources appendix:

```yaml
---
type: review
subtype: mbr
date: YYYY-MM-DD
period: YYYY-MM
rag: green|amber|red
previous_rag: green|amber|red|null
google_doc_url: https://docs.google.com/...
tags: [mbr, monthly-review]
---
```

After the MBR content, include a data sources appendix:

```markdown
---

## Data Sources (not included in Google Doc)

### Dev Analytics
- Director Report: [doc title / link]
- Squad Reports: [list]

### Repo Context
- Weekly reviews read: [count]
- EOD summaries read: [count]
- Meeting notes read: [count]

### External Systems
- Incidents: [count] reviewed
- OKR tracker: [read/not available]
- Team changes: [summary]
- Linear projects: [count] reviewed
- GitHub releases: [count] reviewed
- Slack searches: [channels searched]
- Notion RFCs: [count] reviewed

### Exception Candidates
- Auto-suggested: [count]
- Accepted: [count]
- User-added: [count]
- Rejected: [count]
```

```
✓ CHECKPOINT: Step 10 complete - Save Local Copy
  Saved to: reviews/mbr/YYYY-MM.md

Proceeding to Step 11: Offer OKR Tracker Update
```

### Step 11: Offer OKR Tracker Update (Optional)

After saving, prompt the user:

```
Update PANTHEON OKR tracker with Engineering RAG/Driver/Ask?

RAG: [status]
Driver (1 line): [derived from commentary]
Ask (1 line): [derived from top exception, or "No ask"]

Update tracker? (Y/n)
```

If accepted:
- Use `sheets_get_metadata` on spreadsheet `1DAQkiXe5WISbTA0aEqUBlVCQ595CG61Vwosk9ZfAc2w` to find the correct sheet and cells for Engineering's row and the current month's column
- Use `sheets_get_values` to read current values and confirm the right cells
- Present the exact cells and values to the user for confirmation before writing
- Note: Writing to Google Sheets requires the sheets update tool — if not available, provide the values for manual entry

```
✓ CHECKPOINT: Step 11 complete - Offer OKR Tracker Update
  OKR tracker: [updated/skipped/manual values provided]

Proceeding to Step 12: Update Daily Context
```

### Step 12: Update Daily Context

Append to today's daily context index `context/YYYY-MM-DD/index.md`:

```markdown
| [TIME] | MBR | Generated Engineering MBR for [Month YYYY] — RAG: [status]. Saved to reviews/mbr/YYYY-MM.md. Google Doc: [url] |
```

Create the day directory and index if they don't exist yet (use the context-index template).

**Clean up state file** (optional): Delete `context/YYYY-MM-DD/mbr-state.json` or mark as complete.

```
✓ CHECKPOINT: Step 12 complete - Update Daily Context
  Daily context updated.
```

## Final Summary

After ALL 12 steps complete, display:

```
# MBR Complete - [Month YYYY]

## Steps Completed
✓ 1. Parse Month       ✓ 2. Load Previous   ✓ 3. Read Analytics
✓ 4. Repo Context      ✓ 5. External Context ✓ 6. Suggest Exceptions
✓ 7. Determine RAG     ✓ 8. Draft MBR        ✓ 9. Create Google Doc
✓ 10. Save Local Copy  ✓ 11. OKR Tracker     ✓ 12. Update Context

## Key Results
- **Month**: [Month YYYY]
- **RAG**: [status] ([unchanged/improved/worsened] from [previous])
- **Exceptions**: [N] registered
- **Google Doc**: [url]
- **Local copy**: reviews/mbr/YYYY-MM.md

---
MBR complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to state file (for `--resume`)
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /mbr --resume"

### Specific Error Cases

- **Dev analytics not found**: Warn but allow proceeding — MBR will rely more on repo context and external systems. Note in data sources appendix.
- **MCP server unavailable**: Note which integration is down, continue with available sources, flag gaps in output. Mark source as failed in state file.
- **Previous MBR not found**: Proceed without variance comparison — note this is the baseline MBR.
- **OKR tracker unreadable**: Skip OKR context and tracker update step — provide values for manual entry.
- **Google Doc creation fails**: Save local copy, provide content for manual doc creation.
- **Interruption at any step**: State file preserves progress. Resume from last completed step.

### Resume Behavior

When `/mbr --resume` is run:
1. Load state file from `context/YYYY-MM-DD/mbr-state.json`
2. Display completed steps and their results
3. Restore user decisions (exceptions, RAG, draft approval)
4. Resume from first incomplete step
5. Continue through remaining steps

## Examples

### Standard Usage
```
/mbr January 2026
```
Generates MBR for January 2026, reading dev analytics, gathering all context, and producing the formatted output.

### Interactive Mode
```
/mbr
```
Prompts for month selection, then proceeds through the full workflow.

### Last Month
```
/mbr last month
```
Automatically resolves to the previous calendar month.

## Notes

- Dev analytics is the quantitative backbone — the skill works without it but produces a weaker MBR
- Previous month's MBR enables narrative continuity and RAG trajectory
- Director report trend statuses are used to pre-classify metrics before analysis
- Exception candidates are auto-suggested from data; user accepts/rejects before drafting
- Commentary is a single prose paragraph per Mark's format — not bulleted sections
- User reviews the draft before the Google Doc is created (high-stakes MT document)
- Local copy includes data provenance; Google Doc is the clean output
- MBR directory (`reviews/mbr/`) stores the authoritative local copies
