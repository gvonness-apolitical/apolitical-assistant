# Rubberduck

Capture and document a thinking session - strategy discussions, design decisions, problem-solving, or planning conversations.

## Usage
- `/rubberduck [topic]` - Start a new rubberduck session on a topic
- `/rubberduck --save` - Save the current conversation as a documented session
- `/rubberduck --save [title]` - Save with a specific title

## What This Does

This skill flags the current exchange for documentation. When invoked with `--save`, it captures the conversation and outputs a structured document that preserves:
- The problem or question being explored
- Key insights and decisions reached
- Action items identified
- Context for future reference

## Session Types

Sessions can vary by **domain** and **scope**:

### Domain
- **Technical**: Architecture, design patterns, implementation approaches, debugging
- **Business**: Strategy, planning, process, team dynamics, stakeholder management

### Scope
- **Strategic**: Long-term direction, major decisions, organizational change
- **Tactical**: Medium-term planning, project-level decisions, resource allocation
- **Operational**: Day-to-day problem solving, immediate issues, quick decisions

The document will be tagged with domain and scope for future searchability.

## Output Structure

```markdown
# Rubberduck: [Title]

**Date**: YYYY-MM-DD
**Domain**: Technical | Business
**Scope**: Strategic | Tactical | Operational
**Tags**: [relevant keywords]

## Context
What prompted this discussion? What's the background?

## Problem Statement
Clear articulation of the problem or question being explored.

## Discussion Summary
Key points from the exchange:
- Point 1
- Point 2
- ...

## Key Insights
What did we learn or realize?
- Insight 1
- Insight 2

## Decisions
What was decided (if anything)?
- Decision 1: [rationale]
- Decision 2: [rationale]

## Action Items
- [ ] Action 1 - [owner if identified]
- [ ] Action 2

## Open Questions
What remains unresolved?
- Question 1
- Question 2

## References
Links to related docs, tickets, or resources mentioned.
```

## Output Location

Documents are saved to: `rubberduck/YYYY-MM-DD-[slug].md`

## Examples

**Starting a session:**
```
/rubberduck team structure for AI squad
```

**Saving after discussion:**
```
/rubberduck --save "AI Squad Reporting Lines Decision"
```

## Notes
- The skill captures conversation context from the current session
- Be explicit about decisions vs open questions
- Tag action items with owners where possible
- Link to Linear tickets created from action items
- Sessions can be referenced in future `/find-context` searches
