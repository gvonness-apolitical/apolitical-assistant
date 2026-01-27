# Team Status

Get a comprehensive status update on a team or squad.

## Usage
- `/team-status [squad/team name]` - status for a specific team
- `/team-status` - status for engineering (default)

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
