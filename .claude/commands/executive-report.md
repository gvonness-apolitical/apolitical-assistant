# Executive Report

Generate an executive summary of engineering activity for a given time period, synthesizing data from GitHub, Linear, Slack, email, and meeting transcriptions.

## Usage
- `/executive-report [period]` - Generate report for specified period
- `/executive-report` - Interactive mode (will prompt for date range)
- `/executive-report --resume` - Resume from last completed step if previous run was interrupted
- `/executive-report [period] --compete` - Force critique ratchet (synthesis pressure-tested)
- `/executive-report [period] --single` - Force single-agent (override auto-triggers)

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

For Step 2 (Gather Data from Sources), track each source:

```markdown
## Step 2: Gather Data from Sources

Sources:
- [x] GitHub - 45 PRs, 3 releases
- [x] Linear - 67 completed, 12 blocked
- [x] Slack - 15 key threads
- [ ] Email - (in progress...)
- [ ] Meeting Notes
- [ ] Figma

If interrupted: Resume retries incomplete sources, skips completed ones.
```

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/executive-report --resume`

## MANDATORY: Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Parse Date Range | (computation only) | Never |
| 2. Gather Data | github, linear, slack_search, gmail_search, incidentio_list_incidents, humaans, figma | Individual sources on failure |
| 3. Read Context Files | Read ×N (weekly reviews, MBRs, daily context) | Never |
| 4. Synthesize | (computation only) | Never |
| 5. Generate Report | Write (report file) | Never |
| 6. Save & Update Index | Write, Edit (daily index) | Never |

Each checkpoint must include `Tools:` line with actual tools called and counts.

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume
- [Local Context First](../patterns/local-context-first.md) - Check existing reviews first
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for report
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations
- [Critique Ratchet](../patterns/critique-ratchet.md) - Synthesis sections pressure-tested through critique

## Arguments
- `$ARGUMENTS` - Time period (optional). Accepts:
  - `last week` / `week` - Previous 7 days
  - `last month` / `month` - Previous calendar month
  - `last quarter` / `quarter` - Previous quarter
  - `last year` / `year` - Previous calendar year
  - `YYYY-MM-DD to YYYY-MM-DD` - Custom date range
  - `January 2025` / `Jan 2025` - Specific month

## Process

### Step 1: Determine Date Range

Parse the period argument or prompt the user:
- **last week**: 7 days ending yesterday
- **last month**: Previous calendar month (1st to last day)
- **last quarter**: Previous Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), or Q4 (Oct-Dec)
- **last year**: Previous calendar year
- **Custom**: Parse explicit dates

Confirm the date range with the user before proceeding.

```
✓ CHECKPOINT: Step 1 complete - Determine Date Range
  Period: [start-date] to [end-date] ([N] days)

Proceeding to Step 2: Gather Data from Sources
```

### Step 2: Gather Data from Sources

Collect information from each system for the date range:

#### GitHub (`mcp__github__*`)
- Merged PRs across apolitical repos
- Notable commits and releases
- CI/CD status and any recurring failures

#### Linear (`mcp__linear__*`)
- Completed issues by team (Platform, AI Learning, AI Tools, Enterprise, Data)
- Cycle completion rates and velocity
- Projects with significant progress
- Blocked or stalled work

#### Slack (`mcp__slack__*`)
Search relevant channels for:
- `#engineering` - Team announcements, wins, blockers
- `#incidents` / `#platform-alerts` - Incidents and outages
- `#ship-it` / `#releases` - Shipped features
- Team channels for context on specific work

Keywords to search: "shipped", "released", "incident", "blocked", "completed", "launched"

#### Email (`mcp__google__gmail_*`)
Search for:
- Engineering-related threads (stakeholder updates, partner requests)
- Escalations or urgent issues
- Cross-functional coordination

#### Meeting Transcriptions
Read Gemini auto-notes from `121/` directory for the period:
- 1:1s with direct reports (performance context, blockers, wins)
- Leadership meetings (strategic context)
- Team meetings (project updates)

#### Figma (`.claude/figma-sources.json`)
- Design files shared during the period
- Group by category (product, engineering, marketing)
- Note significant design work (user flows, new features, system diagrams)

#### Asana (`.claude/asana-sources.json`)
- Goal progress during the reporting period
- Portfolio status and project completions
- Cross-functional tasks completed by engineering team members
- Frame as "cross-functional contributions" — distinct from Linear engineering delivery

```
✓ CHECKPOINT: Step 2 complete - Gather Data from Sources
  GitHub: [N] PRs | Linear: [N] tickets | Slack: [N] threads | Email: [N] | Meetings: [N] | Figma: [N] | Asana: [N]

Proceeding to Step 3: Analyze & Categorize
```

### Critique Ratchet Mode

Before generating the report, determine whether to use critique ratchet mode. When active, the draft report (from Steps 3-4) is critiqued and revised before output — the user receives a better report without seeing the intermediate critique. See [Critique Ratchet](../patterns/critique-ratchet.md) for the full pattern.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Report covers >2 weeks (14+ days) | Auto-yes |
| Default (no flag, short period) | No — single-agent |

**How it works:** After Step 4 (Generate Report) produces the draft, the ratchet runs two sequential Task agents (subagent_type: `general-purpose`). Both agents receive the draft as prompt text. Neither has MCP tool access.

**Critique targets synthesis sections only** — Highlights framing, Lowlights framing, Teams & Focus Areas narrative, and Outlook. Factual data (PR counts, ticket numbers, incident details) passes through unchanged.

**Critic Prompt:**

```
Review this executive report and identify exactly 3 weaknesses in the SYNTHESIS
sections (Highlights framing, Lowlights framing, Teams & Focus Areas, Outlook).
Do NOT critique factual data sections — only the framing, emphasis, and narrative.

For each weakness:
1. Cite specific text from the report
2. Explain why it's a weakness (wrong emphasis, missing context, unsupported claim,
   overly optimistic/pessimistic framing, audience mismatch)
3. Suggest a concrete fix

Do NOT list strengths. Do NOT soften with "this is mostly good but". Your only
job is to find the 3 biggest problems with how the data is framed and presented.

REPORT TO CRITIQUE:
[draft_report]
```

**Reviser Prompt:**

```
Below is an executive report and 3 critiques of its synthesis sections. For each
critique, either:
(a) Fix the issue in the revised report, OR
(b) Write a 1-sentence justification for why the original framing should stand

Then produce the complete revised report incorporating your fixes. Preserve all
factual data exactly — only revise framing, emphasis, and narrative.

ORIGINAL REPORT:
[draft_report]

CRITIQUES:
[critic_output]
```

**Causantic event:**
```
[compete-ratchet: skill=executive-report, period=PERIOD, critiques_addressed=N, critiques_justified=N]
```

### Step 3: Analyze & Categorize

Group findings into:

**Highlights (Wins)**
- **Completed Projects** - Shipped features, closed initiatives
- **In Progress (Good Momentum)** - Work progressing well, on track
- **Process Improvements** - Tooling, workflow, or culture wins

**Lowlights (Concerns)**
- **Incidents** - Outages, bugs, production issues (include root cause if known)
- **Resource/Scaling Challenges** - Capacity, infrastructure, cost issues
- **Performance Concerns** - Team or individual delivery issues (anonymize appropriately)
- **Blockers** - Stalled work, dependencies, external blockers

**Team Focus Areas**
- Summarize each team's key focus during the period
- Note any team-specific wins or concerns

**Outlook**
- Upcoming work in backlog
- Planned initiatives for next period
- Risks or dependencies to watch

```
✓ CHECKPOINT: Step 3 complete - Analyze & Categorize
  Highlights: [N] | Lowlights: [N] | Team focus areas: [N]

Proceeding to Step 4: Generate Report
```

### Step 4: Generate Report

**If critique ratchet mode is active**: Generate the report draft using the format below, then run the Critique Ratchet pipeline (Critic → Reviser) on the synthesis sections before proceeding to Step 5. The user receives the revised version.

**If single-agent mode** (default): Generate the report directly.

Use this format:

```markdown
# Engineering Executive Report
**Period:** [Start Date] - [End Date]
**Generated:** [Today's Date]

---

## 🟢 Highlights

### Completed Projects
- **[Project Name]** — [Brief description of what shipped and impact]

### In Progress (Good Momentum)
- **[Project Name]** — [Status, who's leading, expected completion]

### Process Improvements
- **[Improvement]** — [What changed and why it matters]

---

## 🔴 Lowlights

### [Incident/Issue Title]
- **Impact:** [What was affected]
- **Root Cause:** [If known]
- **Resolution:** [How it was fixed]
- **Lessons Learned:** [Takeaways]

### [Other Concerns]
- [Description of concern and any actions being taken]

---

## 📊 Teams & Focus Areas

| Team | Key Focus |
|------|-----------|
| Enterprise | [Focus areas] |
| AI Learning | [Focus areas] |
| AI Tools | [Focus areas] |
| Platform | [Focus areas] |
| Data | [Focus areas] |

---

## 🔮 Next Period Outlook

- **[Initiative]** — [Status and expected timing]
- **[Risk/Dependency]** — [What to watch]
```

```
✓ CHECKPOINT: Step 4 complete - Generate Report
  Report drafted with [N] highlights, [N] lowlights

Proceeding to Step 5: Review & Refine
```

### Step 5: Review & Refine

Before presenting:
- Verify facts against source data
- Ensure sensitive information (individual performance) is appropriately framed
- Check that highlights and lowlights are balanced and fair
- Confirm team attributions are accurate

```
✓ CHECKPOINT: Step 5 complete - Review & Refine
  Report reviewed and refined

Proceeding to Step 6: Output
```

### Step 6: Output

Save the report to: `reviews/executive/[start-date]-to-[end-date].md`

Add YAML frontmatter:
```yaml
---
type: review
date: YYYY-MM-DD
period: custom
range_start: [start-date]
range_end: [end-date]
tags: []
---
```

Present a summary to the user and offer:
- "Copy to clipboard?"
- "Create Google Doc?"
- "Email to [recipient]?"

```
✓ CHECKPOINT: Step 6 complete - Output
  Saved to: reviews/executive/[start-date]-to-[end-date].md
```

## Final Summary

After ALL 6 steps complete, display:

```
# Executive Report Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Determine Range   ✓ 2. Gather Data      ✓ 3. Analyze
✓ 4. Generate Report   ✓ 5. Review & Refine  ✓ 6. Output

## Key Results
- **Period**: [start-date] to [end-date]
- **Highlights**: [N] items
- **Lowlights**: [N] items
- **Teams covered**: [N]

## Saved to
reviews/executive/[start-date]-to-[end-date].md

---
Executive report complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /executive-report --resume"

### Resume Behavior

When `/executive-report --resume` is run:
1. Check daily context for incomplete executive report
2. Skip completed steps
3. For Step 2 (Gather Data), resume from first incomplete source
4. Continue from first incomplete step

## Data Source Priority

When information conflicts, prioritize:
1. Linear (source of truth for work items)
2. GitHub (source of truth for code/releases)
3. Meeting notes (context and decisions)
4. Slack (real-time context)
5. Email (external coordination)

## Privacy Guidelines

- Anonymize individual performance concerns unless explicitly requested
- Don't include specific salary, HR, or personnel details
- Frame team challenges constructively
- Incidents should focus on systems, not blame individuals

## Examples

### Example: Monthly Report
```
/executive-report last month
```

Generates report for previous calendar month with all sections.

### Example: Quarterly Report
```
/executive-report Q4 2024
```

or

```
/executive-report last quarter
```

Generates comprehensive quarterly summary.

### Example: Custom Range
```
/executive-report 2025-01-06 to 2025-01-17
```

Generates report for specific two-week period.

## Notes

- For longer periods (quarter/year), focus on major themes rather than exhaustive lists
- Include metrics where available (cycle time, velocity, incident count)
- Link to relevant Linear projects or GitHub releases where helpful
- If data is sparse for a period, note it and focus on available information
