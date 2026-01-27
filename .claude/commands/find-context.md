# Find Context

Search across all systems to gather context on a person, project, or topic.

## Usage
- `/find-context [person name]` - gather all context about interactions with a person
- `/find-context [project/squad name]` - gather context about a project
- `/find-context [topic/keyword]` - search for relevant information on a topic

## Person Lookup

When the query appears to be a person, use `.claude/people.json` for instant resolution:

### Lookup Algorithm
1. If query is email format → direct lookup in `people[email]`
2. If query matches Slack ID (U...) → check `indices.bySlackUserId`
3. Lowercase query → check `indices.byAlias`
4. Fuzzy match against all `displayName` values
5. Check `contacts` section for external people
6. If not found → fall back to API search (Humaans, Slack)

### Using Cached Identifiers
Once a person is resolved, use their cached identifiers:
- `slackUserId` → for Slack searches
- `slackDmChannelId` → to read DM history directly
- `humaansEmployeeId` → for Humaans lookups
- `githubUsername` → for GitHub PR/issue searches (if populated)
- `linearUserId` → for Linear ticket searches (if populated)

### Cache Updates
If you discover a new identifier during search (e.g., GitHub username from a PR):
1. Update the person's record in people.json
2. Set the new identifier value
3. Rebuild indices if needed (bySlackUserId)
4. Update `lastVerified` to today

## Check Daily Context First

Before making API calls, check local context files for relevant information:

1. **Today's daily context**: `context/daily/YYYY-MM-DD.md`
   - Recent Slack summaries mentioning the person/topic
   - Email triage results
   - Action items related to them
2. **Recent session context**: `context/YYYY-MM-DD-session.md`
   - Notes and decisions from today
3. **Yesterday's EOD**: `context/eod-YYYY-MM-DD.md`
   - Carry-forward items mentioning them
4. **Recent orient files**: `context/orient-*.md` (last 3 days)

If context is found locally, include it first, then supplement with fresh API calls as needed.

## For a Person

First resolve the person using people.json (see Lookup Algorithm above). Then search across:

1. **People Cache**: Use cached metadata (team, role, manager, isDirectReport)
2. **Humaans**: Role, team, manager, start date, time off (use `humaansEmployeeId` if cached)
3. **Calendar**: Recent and upcoming meetings together
4. **Slack**: Recent conversations and shared channels (use `slackUserId`/`slackDmChannelId` if cached)
5. **Email**: Recent threads
6. **Linear**: Shared tickets or projects (use `linearUserId` if cached)
7. **GitHub**: Shared PRs or reviews (use `githubUsername` if cached)
8. **Notion**: Docs they've authored or are mentioned in

**If person not in cache**: Search Humaans/Slack by name, then add them to people.json.

### Output for Person
- Profile summary (role, team, tenure)
- Recent interactions (last 2 weeks)
- Shared work (tickets, PRs, projects)
- Communication patterns (how we typically interact)
- Open items (things pending with them)

## For a Project

Search across:
1. **Linear**: Project/squad tickets, milestones, roadmap
2. **GitHub**: Related repositories, recent PRs
3. **Notion**: Project docs, RFCs, specs
4. **Slack**: Project channels, recent discussions
5. **Incidents**: Related incidents

### Output for Project
- Project overview (goals, timeline, status)
- Team members involved
- Recent activity summary
- Current blockers or risks
- Key docs and resources

## For a Topic

Search across all systems for keyword/phrase:
1. **Slack**: Threads mentioning topic
2. **Notion**: Pages and databases
3. **Google Drive**: Docs and sheets
4. **Linear**: Tickets and projects
5. **GitHub**: Issues, PRs, code

### Output for Topic
- Overview of what was found
- Key discussions and decisions
- Related people and teams
- Timeline of activity
- Links to primary sources

## Notes
- Be thorough - check all systems even if first results seem sufficient
- Highlight the most recent and relevant items
- Note if topic appears contentious or has conflicting information
- Flag if context seems incomplete (e.g., references to things not found)
- **Update people.json** when discovering new identifiers (GitHub username, Linear user ID)
