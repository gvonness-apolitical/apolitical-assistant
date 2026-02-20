# Rubberduck

Capture and document a thinking session - strategy discussions, design decisions, problem-solving, or planning conversations.

## Usage
- `/rubberduck [topic]` - Start a new rubberduck session on a topic
- `/rubberduck [topic] --challenge` - Start with Devil's Advocate mode (team-based dialectic, default)
- `/rubberduck [topic] --challenge --quick` - Devil's Advocate mode (single-shot subagents, no team)
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

When `--challenge` is used, the session runs an [Adversarial Debate](../patterns/adversarial-debate.md) variant to stress-test the user's thinking before documenting conclusions. Default uses agent teams for multi-round dialectic with defense and counter-assessment.

**Activation:**

| Trigger | Mode |
|---------|------|
| `--challenge` flag | Team-based 4-round dialectic (default) |
| `--challenge --quick` flag | Single-shot subagent (Steelman + DA parallel → Judge sequential) |
| `--challenge` + team prerequisites fail | Falls back to single-shot subagent |
| Default (no `--challenge`) | No challenge — standard rubberduck session |

No auto-triggers — rubberduck topics are too varied. The user opts in when they want their thinking pressure-tested.

### How It Works

**Phase 1: Explore** — Run the rubberduck session normally. Discuss the topic, surface the user's position, reasoning, and key assumptions. Gather dossier context for any stakeholders mentioned.

**Phase 2: Challenge** — Once the user's position is clear (either naturally or when they say "challenge this"), execute one of the two paths below.

---

### Path A: `--challenge --quick` OR Team Prerequisites Fail (Single-Shot Subagents)

Current behavior — three sequential/parallel agents without inter-agent communication.

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

---

### Path B: `--challenge` Default (Team-Based 4-Round Dialectic)

Uses Claude Code agent teams for multi-round interaction where the Steelman and Devil's Advocate respond to each other. Follow the [Team Lifecycle](../patterns/team-lifecycle.md) pattern.

**Prerequisites Check:**
```
1. Check env var CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
2. Read settings.json → agentTeams.enabled
3. Confirm not already in a team context
→ If ANY fails: fall back to Path A
```

**Team Setup:**
```
TeamCreate:
  team_name: "rubberduck-challenge-{timestamp}"
  description: "Rubberduck challenge: {TOPIC}"
```

**Round 1 — Steelman (Sequential):**

Spawn `steelman` teammate to strengthen the user's argument:

```
Task:
  team_name: "rubberduck-challenge-{timestamp}"
  name: "steelman"
  subagent_type: "general-purpose"
  prompt: [Steelman Prompt — same as Path A]
```

Wait for completion. The strengthened argument becomes the target for the Devil's Advocate.

**Round 2 — Devil's Advocate Challenges (Sequential):**

Spawn `devils-advocate` teammate. Send the steelmanned argument (not the raw user argument):

```
Task:
  team_name: "rubberduck-challenge-{timestamp}"
  name: "devils-advocate"
  subagent_type: "general-purpose"
  prompt: [Devil's Advocate Prompt — same as Path A, but uses steelmanned argument as THE ARGUMENT]
```

Wait for completion. The DA produces 5 ranked challenges against the strongest version of the argument.

**Round 3 — Steelman Defense (Sequential, NEW):**

Send the DA's 5 challenges to the Steelman via SendMessage:

```
SendMessage:
  type: "message"
  recipient: "steelman"
  content: |
    The Devil's Advocate has produced 5 challenges to your strengthened argument:

    [devils_advocate_output]

    For each challenge, you MUST either:
    (a) CONCEDE AND REVISE: If the challenge is valid, acknowledge it and revise
        the relevant part of the argument. Show the before/after.
    (b) DEFEND WITH EVIDENCE: If the challenge misses the mark, provide specific
        evidence or reasoning that addresses it. "I disagree" is not a defense.

    Conceding a valid challenge and revising strengthens the overall argument.
    Defending every point weakens all of them.

    Produce your defense/revision for all 5 challenges.
  summary: "Round 3: Defend or revise against 5 challenges"
```

Wait for response.

**Round 4 — Devil's Advocate Counter-Assessment (Sequential, NEW):**

Send the Steelman's defenses to the DA via SendMessage:

```
SendMessage:
  type: "message"
  recipient: "devils-advocate"
  content: |
    The Steelman has responded to your 5 challenges:

    [steelman_defense_output]

    For each defense/revision, assess:

    1. If they CONCEDED and REVISED: Is the revised argument actually stronger,
       or did the revision introduce new weaknesses? Does the revision address
       the root concern or just rephrase it?

    2. If they DEFENDED: Was the defense substantive (new evidence, specific
       reasoning) or deflection (restating the original position)? Rate each
       defense: ADDRESSED / PARTIALLY ADDRESSED / DEFLECTED.

    Produce a verdict for each challenge.
  summary: "Round 4: Assess steelman defenses"
```

Wait for response.

**Lead Synthesis:**

The lead (coordinator) synthesises all 4 rounds. Lead-as-judge is appropriate here — lighter synthesis than `/evaluate`.

```
Synthesis from full dialectic:
- Round 1: Steelmanned argument
- Round 2: 5 challenges from Devil's Advocate
- Round 3: Steelman defense/revision for each challenge
- Round 4: DA assessment of each defense

Produce:
1. Defense & Counter-Assessment table (see output format below)
2. Overall verdict: What is the revised argument after the dialectic?
3. Categories: Survived intact / Revised and strengthened / Needs further work / Consider abandoning
```

**Shutdown & Cleanup:**
```
try:
  [Rounds 1-4 + synthesis above]
finally:
  SendMessage shutdown_request to steelman, devils-advocate
  TeamDelete "rubberduck-challenge-{timestamp}"
```

---

### Challenge Output Format

**Path A (single-shot)** uses the existing format:

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

**Path B (team dialectic)** uses an expanded format with the defense/assessment exchange:

```markdown
## Steelman
[The strongest version of your argument — Round 1]

---

## Devil's Advocate Challenges
[5 ranked challenges — Round 2]

---

## Defense & Counter-Assessment

| # | Challenge | Steelman Defense | DA Assessment | Verdict |
|---|-----------|-----------------|---------------|---------|
| 1 | [challenge summary] | [defense/revision summary] | [assessment] | Addressed / Partially / Deflected |
| 2 | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... |
| 4 | ... | ... | ... | ... |
| 5 | ... | ... | ... | ... |

---

## Synthesis

### Survived Intact
[Parts of the argument that withstood all challenges]

### Revised and Strengthened
[Parts that were validly challenged, revised, and are now stronger]

### Needs Further Work
[Parts where the defense was partial or the revision introduced new issues]

### Consider Abandoning
[Parts where the challenge was devastating and no adequate defense was offered — if any]
```

The rest of the template (Thinking About, Context, Conclusions, Open Questions, Actions) still applies — but Conclusions and Actions are informed by the synthesis rather than the raw conversation.

### Causantic Event

```
[compete-result: skill=rubberduck, topic=TOPIC_SLUG, mode=team-dialectic|subagent, rounds=N, challenges_addressed=N/5, challenges_deflected=N/5]
```

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
- [Team Lifecycle](../patterns/team-lifecycle.md) - Agent team setup, coordination, and cleanup (challenge mode)

## Notes
- The skill captures conversation context from the current session
- Be explicit about decisions vs open questions
- Tag action items with owners where possible
- Link to Linear tickets created from action items
- Sessions can be referenced in future `/find-context` searches
- All rubberduck files include YAML frontmatter for searchability
- Files are encrypted via git-crypt (may contain sensitive strategy)
- **Stakeholder dossiers are loaded when available** to inform strategic framing
