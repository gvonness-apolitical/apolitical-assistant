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

Use the template from `.claude/templates/rubberduck.md`:

```markdown
---
type: rubberduck
date: YYYY-MM-DD
domain: technical | business
scope: strategic | tactical | operational
tags: [relevant, keywords]
related: []
---

# [Title]

## Thinking About
What question or problem we're exploring.

## Context
Background information, constraints, what prompted this discussion.

## Exploration

### Thread 1: [Topic]
Discussion and reasoning...

### Thread 2: [Topic]
Discussion and reasoning...

## Conclusions
What we landed on and why.

## Open Questions
Things still unresolved or to explore later.

## Actions
- [ ] Action 1 - [owner if identified]
- [ ] Action 2
```

## Output Location

Documents are saved to: `rubberduck/YYYY-MM-DD-[slug].md`

The slug is derived from the title (lowercase, hyphens, no special characters).

## Daily Context Integration

When saving a rubberduck session:

1. Save the full document to `rubberduck/YYYY-MM-DD-[slug].md`
2. Append a summary to the daily context index at `context/YYYY-MM-DD/index.md`:

```markdown
| HH:MM | Rubberduck | [Title] - [1-line summary] |
```

3. Add link to Links section:
```markdown
- [Rubberduck: Title](../rubberduck/YYYY-MM-DD-[slug].md)
```

## Examples

**Starting a session:**
```
/rubberduck team structure for AI squad
```

**Saving after discussion:**
```
/rubberduck --save "AI Squad Reporting Lines Decision"
```

## Dossier Context

When stakeholders are mentioned in the session (either in the topic or tagged in frontmatter):

1. **Load dossiers**: Read `.claude/dossiers.json`
2. **For each stakeholder**: Look up dossier by email (resolve name via person-resolution pattern)
3. **If dossier found**, load to inform the thinking session:
   - **Profile** — communication style, motivations, sensitivities, strengths
   - **Playbook** — effective frames, avoid patterns, known triggers
   - **Dynamics** — relationships between stakeholders (especially useful for multi-stakeholder strategy)
   - **Recent notes** — recent observations that may be relevant
4. **Use during session**: Dossier context helps frame strategic analysis. For example, when exploring how to approach a difficult conversation, the person's sensitivities and effective frames directly inform the framing.
5. **If no dossier exists**: Proceed without — dossier context is additive, never blocking.

### Core Patterns Used

- [Dossier Context](../patterns/dossier-context.md) - Load stakeholder profiles and playbooks

## Notes
- The skill captures conversation context from the current session
- Be explicit about decisions vs open questions
- Tag action items with owners where possible
- Link to Linear tickets created from action items
- Sessions can be referenced in future `/find-context` searches
- All rubberduck files include YAML frontmatter for searchability
- Files are encrypted via git-crypt (may contain sensitive strategy)
- **Stakeholder dossiers are loaded when available** to inform strategic framing
