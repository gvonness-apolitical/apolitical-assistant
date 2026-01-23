# Find Context

Search across all systems to gather context on a person, project, or topic.

## Usage
- `/find-context [person name]` - gather all context about interactions with a person
- `/find-context [project/squad name]` - gather context about a project
- `/find-context [topic/keyword]` - search for relevant information on a topic

## For a Person

Search across:
1. **Humaans**: Role, team, manager, start date, time off
2. **Calendar**: Recent and upcoming meetings together
3. **Slack**: Recent conversations and shared channels
4. **Email**: Recent threads
5. **Linear**: Shared tickets or projects
6. **GitHub**: Shared PRs or reviews
7. **Notion**: Docs they've authored or are mentioned in

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
