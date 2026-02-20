# Rubberduck

Capture and document a thinking session - strategy discussions, design decisions, problem-solving, or planning conversations.

## Usage
- `/rubberduck [topic]` - Start a new rubberduck session on a topic
- `/rubberduck [topic] --challenge` - Start with Devil's Advocate mode (stress-test your thinking)
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

## Challenge Mode (Devil's Advocate)

When `--challenge` is used, the session runs an [Adversarial Debate](../patterns/adversarial-debate.md) variant to stress-test the user's thinking before documenting conclusions.

**Activation:**

| Trigger | Challenge? |
|---------|-----------|
| `--challenge` flag | Yes |
| Default (no flag) | No — standard rubberduck session |

No auto-triggers — rubberduck topics are too varied. The user opts in when they want their thinking pressure-tested.

### How It Works

**Phase 1: Explore** — Run the rubberduck session normally. Discuss the topic, surface the user's position, reasoning, and key assumptions. Gather dossier context for any stakeholders mentioned.

**Phase 2: Challenge** — Once the user's position is clear (either naturally or when they say "challenge this"), launch three sequential agents:

**Steelman Agent** (parallel, subagent_type: `general-purpose`):
```
You are strengthening the following argument to its most compelling form.
Fill logical gaps, find supporting evidence, anticipate objections and
pre-empt them, and articulate the strongest version of this position.

Do NOT change the core thesis — strengthen it. If a supporting point is
weak, replace it with a stronger one that supports the same conclusion.

THE ARGUMENT:
[user's position and reasoning from the conversation]

STAKEHOLDER CONTEXT:
[dossier summaries if available]
```

**Devil's Advocate Agent** (parallel, subagent_type: `general-purpose`, sycophancy-hardened per [Adversarial Debate](../patterns/adversarial-debate.md)):
```
You are a rigorous strategic thinker whose job is to find every weakness
in the following argument. Your reputation depends on finding real problems,
not performing disagreement.

STRUCTURAL REQUIREMENT: Produce exactly 5 challenges ranked by severity.
For each:
- State the assumption being challenged
- Present the strongest counterargument or contradicting evidence
- Explain the concrete risk if this assumption is wrong

Do NOT soften with "this is probably fine but" or "minor point". If it's
a weakness, state it plainly.

THE ARGUMENT:
[user's position and reasoning from the conversation]

STAKEHOLDER CONTEXT:
[dossier summaries if available — use to identify political/relational
risks the argument may be ignoring]
```

Both agents receive the conversation context and any dossier content as prompt text. They do NOT have MCP tool access.

**Judge Agent** (sequential, after both complete):
```
You have a steelmanned argument and a devil's advocate teardown of the
same position:

STEELMANNED VERSION:
[steelman_output]

DEVIL'S ADVOCATE CHALLENGES:
[devils_advocate_output]

Produce the synthesis:
1. Which parts of the argument survived the devil's advocate intact?
2. Which challenges exposed genuine weaknesses?
3. For each challenge: fatal flaw, real concern, or a stretch? Score 1-5.
4. Did the devil's advocate find substantive issues or just perform
   disagreement?
5. What is the revised argument — the original position with its weak
   points acknowledged or addressed?
6. What should the user do differently as a result?
```

After the Judge synthesis, emit a Causantic event:
```
[compete-result: skill=rubberduck, topic=TOPIC_SLUG, disagreements=N, resolution=SUMMARY, survived=N/5_challenges]
```

### Challenge Output Format

The challenge debate replaces the Exploration section in the standard output template:

```markdown
## Steelman
[The strongest version of your argument]

---

## Devil's Advocate
[5 ranked challenges with counterarguments]

---

## Synthesis
[What survived, what needs work, revised position]

**Survived intact**: [list]
**Needs strengthening**: [list]
**Consider abandoning**: [list, if any]
```

The rest of the template (Thinking About, Context, Conclusions, Open Questions, Actions) still applies — but Conclusions and Actions are informed by the synthesis rather than the raw conversation.

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
- [Adversarial Debate](../patterns/adversarial-debate.md) - Devil's Advocate variant for challenge mode

## Notes
- The skill captures conversation context from the current session
- Be explicit about decisions vs open questions
- Tag action items with owners where possible
- Link to Linear tickets created from action items
- Sessions can be referenced in future `/find-context` searches
- All rubberduck files include YAML frontmatter for searchability
- Files are encrypted via git-crypt (may contain sensitive strategy)
- **Stakeholder dossiers are loaded when available** to inform strategic framing
