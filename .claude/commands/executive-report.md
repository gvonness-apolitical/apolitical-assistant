# Executive Report

Generate an executive summary of engineering activity for a given time period, synthesizing data from GitHub, Linear, Slack, email, and meeting transcriptions.

## Usage
- `/executive-report [period]` - Generate report for specified period
- `/executive-report` - Interactive mode (will prompt for date range)

## Arguments
- `$ARGUMENTS` - Time period (optional). Accepts:
  - `last week` / `week` - Previous 7 days
  - `last month` / `month` - Previous calendar month
  - `last quarter` / `quarter` - Previous quarter
  - `last year` / `year` - Previous calendar year
  - `YYYY-MM-DD to YYYY-MM-DD` - Custom date range
  - `January 2025` / `Jan 2025` - Specific month

## Process

### 1. Determine Date Range

Parse the period argument or prompt the user:
- **last week**: 7 days ending yesterday
- **last month**: Previous calendar month (1st to last day)
- **last quarter**: Previous Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), or Q4 (Oct-Dec)
- **last year**: Previous calendar year
- **Custom**: Parse explicit dates

Confirm the date range with the user before proceeding.

### 2. Gather Data from Sources

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

### 3. Analyze & Categorize

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

### 4. Generate Report

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

### 5. Review & Refine

Before presenting:
- Verify facts against source data
- Ensure sensitive information (individual performance) is appropriately framed
- Check that highlights and lowlights are balanced and fair
- Confirm team attributions are accurate

### 6. Output

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
