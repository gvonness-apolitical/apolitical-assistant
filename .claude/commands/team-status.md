# Team Status

Get a comprehensive status update on a team or squad.

## Usage

- `/team-status [squad/team name]` - status for a specific team
- `/team-status` - status for engineering (default)
- `/team-status [squad] --quick` - use cached data only, no API calls
- `/team-status [squad] --compete` - Force critique ratchet (assessment pressure-tested)
- `/team-status [squad] --single` - Force single-agent (override auto-triggers)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve team members
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Progressive Discovery](../patterns/progressive-discovery.md) - Cache GitHub/Linear user IDs
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations
- [Rate Limiting](../patterns/rate-limiting.md) - Batch API calls efficiently
- [Critique Ratchet](../patterns/critique-ratchet.md) - Health assessment and recommendations pressure-tested

## Quick Mode

When `--quick` flag is provided:

1. Skip all MCP/API calls
2. Use only cached data:
   - `people.json` - Team roster with `indices.byTeam` and `indices.bySquad`
   - `linear-cache.json` - Sprint structure and progress
   - `context/YYYY-MM-DD/` - Today's context (incidents, blockers)
   - `figma-sources.json` - Recent design activity
   - `asana-sources.json` - Cross-functional Asana tasks
3. Note in output: "Quick mode - cached data (may be stale)"

Use quick mode when:
- You need a fast team overview
- MCP servers are unavailable
- Checking team composition without live status

## Person Resolution

Use `.claude/people.json` to resolve team members:

1. **Filter by team**: Get people where `metadata.team` matches the squad name
2. **Get identifiers**: Use cached `slackUserId`, `githubUsername`, `linearUserId`
3. **Direct reports**: Filter on `metadata.isDirectReport` for your team
4. **Progressive discovery**: If you discover a GitHub username or Linear user ID during status lookup, update people.json

## Check Daily Context First

Before making API calls, check local context files:

1. **Today's daily context**: `context/daily/YYYY-MM-DD.md`
   - Who's out (from orient/morning-briefing)
   - Active incidents
   - Recent Slack activity summaries
2. **Today's morning briefing**: `morning-briefing/YYYY-MM-DD.md`
   - Team availability
   - P1 items affecting team
3. **Recent EODs**: `context/eod-*.md` (last 3 days)
   - Blocked items mentioned
   - Team accomplishments

Use local context to supplement API calls and provide historical context.

## Gather Data

1. **Linear**:
   - Current sprint/cycle progress
   - Tickets by status (todo, in progress, blocked, done)
   - Upcoming milestones
   - Backlog health

2. **GitHub**:
   - Open PRs and their age
   - PRs awaiting review
   - Recent merges
   - CI/CD status

3. **Humaans**:
   - Team roster
   - Who's out today/this week
   - Recent team changes

4. **Incidents**:
   - Active incidents involving the team
   - Recent incidents and follow-up status

5. **Slack**:
   - Recent team channel activity
   - Any escalations or blockers flagged

6. **Notion Priority Sources** (load from `.claude/notion-sources.json`):
   - **Product Roadmap**: Squad's upcoming priorities and planned work
   - **PRDs**: Active product specs for the team's initiatives
   - **RFCs**: Technical decisions affecting the team (Accepted or In Review)

7. **Figma** (load from `.claude/figma-sources.json`):
   - Recent design files shared in team channels
   - Active design work by category matching team (e.g., "engineering" for Platform)
   - Files owned by team members (cross-reference with people.json)

8. **Asana** (load from `.claude/asana-sources.json`):
   - Cross-functional tasks assigned to team members (use `asanaUserId` from people.json)
   - Goal progress relevant to the team
   - Priority projects involving team members
   - Frame as "cross-functional work" — distinct from Linear sprint work

## Critique Ratchet Mode

Before generating output, determine whether to use critique ratchet mode. When active, the draft status report is critiqued and revised — the user receives a better assessment without seeing the intermediate critique. See [Critique Ratchet](../patterns/critique-ratchet.md) for the full pattern.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Any blocked ticket count >= 3 | Auto-yes |
| Burndown assessment is "behind" or "at risk" | Auto-yes |
| Default (no flag, healthy team) | No — single-agent |

**How it works:** After gathering all data and producing the draft status report, the ratchet runs two sequential Task agents (subagent_type: `general-purpose`). Both agents receive the draft as prompt text. Neither has MCP tool access.

**Critique targets assessment sections only** — Health Indicators, Risks & Blockers, and Recommendations. Factual data (team roster, ticket tables, PR lists) passes through unchanged.

**Critic Prompt:**

```
Review this team status report and identify exactly 3 weaknesses in the ASSESSMENT
sections (Health Indicators, Risks & Blockers, Recommendations). Do NOT critique
factual data tables — only the interpretation, risk assessment, and recommendations.

For each weakness:
1. Cite specific text from the report
2. Explain why it's a weakness (missed risk, overly optimistic assessment,
   recommendation without actionable detail, missing root cause)
3. Suggest a concrete fix

Do NOT list strengths. Do NOT soften with "this is mostly good but". Your only
job is to find the 3 biggest problems with the assessment and recommendations.

REPORT TO CRITIQUE:
[draft_report]
```

**Reviser Prompt:**

```
Below is a team status report and 3 critiques of its assessment sections. For each
critique, either:
(a) Fix the issue in the revised report, OR
(b) Write a 1-sentence justification for why the original assessment should stand

Then produce the complete revised report incorporating your fixes. Preserve all
factual data tables exactly — only revise Health Indicators, Risks & Blockers,
and Recommendations.

ORIGINAL REPORT:
[draft_report]

CRITIQUES:
[critic_output]
```

**Causantic event:**
```
[compete-ratchet: skill=team-status, team=TEAM_NAME, critiques_addressed=N, critiques_justified=N]
```

## Output Structure

**If critique ratchet mode is active**: Generate the full status report below, then run the Critique Ratchet pipeline (Critic → Reviser) on the assessment sections before presenting to the user. The user receives the revised version.

**If single-agent mode** (default): Generate the status report directly.

### [Team Name] Status - [Date]

### Team
| Name | Role | Status |
(Status: available, OOO, in meetings, etc.)

### Sprint Progress
- Sprint goal and progress percentage
- Days remaining
- Burndown assessment (on track, at risk, behind)

### Current Work
**In Progress**
| Ticket | Assignee | Started | Status |

**Blocked**
| Ticket | Blocker | Since | Owner |

**Awaiting Review**
| PR/Ticket | Author | Waiting Since | Reviewer |

### Recent Completions
Tickets and PRs completed this week

### Active Design Work
Recent Figma files shared by or relevant to the team:
| File | Owner | Last Shared | Category |

### Cross-Functional Work (Asana)
Tasks assigned to team members in Asana (company-wide projects):
| Task | Assignee | Project | Due Date | Status |
- Goal progress relevant to the team

### Health Indicators
- Cycle time trend
- PR review time
- Blocked ticket count
- Unplanned work percentage

### Risks & Blockers
- Current blockers and who can resolve
- Risks to sprint completion
- External dependencies

### Recommendations
- Suggested actions to improve flow
- Items needing attention
- Potential escalations

## Notes
- Compare to previous week where helpful
- Flag systemic issues (same blocker recurring)
- Note if team capacity is affected by OOO
