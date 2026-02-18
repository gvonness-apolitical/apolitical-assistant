# Team Status

Get a comprehensive status update on a team or squad.

## Usage

- `/team-status [squad/team name]` - status for a specific team
- `/team-status` - status for engineering (default)
- `/team-status [squad] --quick` - use cached data only, no API calls

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve team members
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Progressive Discovery](../patterns/progressive-discovery.md) - Cache GitHub/Linear user IDs
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations
- [Rate Limiting](../patterns/rate-limiting.md) - Batch API calls efficiently

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

## Output Structure

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
