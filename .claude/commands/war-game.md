# War Game

Multi-agent scenario planning using dossier profiles. Spawn stakeholder agents that argue positions based on real personality data, moderated by an analyst who identifies leverage points, compromise zones, and non-negotiables.

## Core Patterns Used
- [Team Lifecycle](../patterns/team-lifecycle.md) - Agent team setup, coordination, and cleanup
- [Dossier Context](../patterns/dossier-context.md) - Load stakeholder profiles and playbooks
- [Person Resolution](../patterns/person-resolution.md) - Resolve stakeholder names
- [Daily Index Update](../patterns/daily-index-update.md) - Append to context index

## Usage

- `/war-game [scenario]` - Run a war game for the described scenario
- `/war-game [scenario] --rounds N` - Override number of interaction rounds (default: 2)

## Requirements

- **Agent teams required**: This skill always uses teams — there is no subagent fallback. If team prerequisites are not met, the skill will error with instructions to enable teams.
- **Dossiers required for stakeholders**: Each stakeholder must have a dossier in `.claude/dossiers.json`. If a stakeholder lacks a dossier, warn and offer to proceed without personality data for that person (generic role-based behavior instead).

## Process

### Step 1: Parse Scenario

Parse the scenario description from the invocation:

```
/war-game "Joel pushes back on the counter-proposal"
/war-game "Byron and Jess disagree on AI squad priorities"
/war-game "Samuel proposes moving to a new CI/CD provider"
```

**1a. Extract stakeholders:**

Identify people mentioned in the scenario. Resolve each via [Person Resolution](../patterns/person-resolution.md).

**1b. Identify the user's role:**

Ask the user via AskUserQuestion:
- "What's your role in this scenario?" — options: "Active participant", "Observer/mediator", "Decision maker"
- "What outcome are you hoping for?" — free text

**1c. Gather context:**

Check daily context (`context/YYYY-MM-DD/index.md`) for recent interactions with the stakeholders. Search Slack and email for recent threads involving the scenario topic.

✓ CHECKPOINT after Step 1

---

### Step 2: Load Dossier Context

For each stakeholder:

1. Resolve to email via [Person Resolution](../patterns/person-resolution.md)
2. Load dossier via [Dossier Context](../patterns/dossier-context.md)
3. Extract for agent prompting:
   - `profile.communicationStyle` — how they argue
   - `profile.decisionMaking` — how they reach conclusions
   - `profile.motivations` — what they optimise for
   - `profile.sensitivities` — what triggers defensiveness
   - `playbook.effectiveFrames` — what arguments land with them
   - `playbook.avoidPatterns` — what approaches backfire
   - `playbook.knownTriggers` — what escalates the situation
   - `dynamics` — relationships between the stakeholders

4. If dossier is missing: warn and note the person will use generic behavior

Present the loaded context to the user for validation:

```
Loaded dossiers for:
- Joel: [brief communication style summary]
- Byron: [brief communication style summary]

Dynamics: [relevant relationship notes]

Proceed with war game?
```

✓ CHECKPOINT after Step 2

---

### Step 3: Team Setup & Round Execution

Follow [Team Lifecycle](../patterns/team-lifecycle.md).

**3a. Prerequisites Check:**

```
1. Check env var CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
2. Read settings.json → agentTeams.enabled
3. Confirm not already in a team context
→ If ANY fails: ERROR — war-game requires agent teams.
   "Enable agent teams: set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
    and set agentTeams.enabled=true in .claude/settings.json"
```

**3b. Create Team:**

```
TeamCreate:
  team_name: "war-game-{timestamp}"
  description: "War game: {scenario}"
```

**3c. Spawn Agents:**

For each stakeholder (typically 2, max 3), spawn a teammate:

```
Task:
  team_name: "war-game-{timestamp}"
  name: "stakeholder-{lowercase-firstname}"
  subagent_type: "general-purpose"
  prompt: [Stakeholder Prompt — see template below]
```

Spawn an analyst teammate:

```
Task:
  team_name: "war-game-{timestamp}"
  name: "analyst"
  subagent_type: "general-purpose"
  prompt: [Analyst Prompt — see template below]
```

**3d. Round 1 — Position Statements (Parallel):**

All stakeholder agents produce their initial position and constraints simultaneously. Wait for all to complete.

**3e. Round 2 — Responses (Parallel):**

Send each stakeholder the other stakeholders' positions via SendMessage:

```
SendMessage:
  type: "message"
  recipient: "stakeholder-joel"
  content: |
    The other stakeholders have stated their positions:

    [other_stakeholder_positions]

    Respond to their positions IN CHARACTER. Consider:
    - Which points do you agree with? (Concede explicitly)
    - Which points do you push back on? (State your objection and reasoning)
    - What compromise would you accept? What is non-negotiable?
    - How does your communication style affect how you'd frame this?

    Stay in character. Use the communication patterns from your profile.
  summary: "Round 2: Respond to other stakeholders"
```

Wait for all responses.

**3f. Additional Rounds (if --rounds > 2):**

For each additional round, deliver latest responses and prompt for continued negotiation. Diminishing returns expected after round 3.

**3g. Analyst Assessment (Sequential):**

After stakeholder rounds complete, send the analyst the full exchange:

```
SendMessage:
  type: "message"
  recipient: "analyst"
  content: |
    The stakeholder exchange is complete. Here is the full record:

    [all_rounds_output]

    STAKEHOLDER PROFILES:
    [all_dossier_summaries]

    Produce your analysis:

    1. GENUINELY CONTESTED AREAS:
       Issues where stakeholders have irreconcilable positions.
       What's the real underlying disagreement? (Often different
       from the surface disagreement.)

    2. COMPROMISE ZONES:
       Areas where positions are closer than they appear. What
       would a mutually acceptable solution look like?

    3. NON-NEGOTIABLES:
       What each stakeholder absolutely cannot concede (and why —
       based on their motivations and sensitivities).

    4. LEVERAGE POINTS:
       What arguments or evidence would move each stakeholder?
       (Use their dossier: effective frames, decision-making style.)

    5. PROCESS RECOMMENDATIONS:
       How should Greg approach this? In what order should concerns
       be addressed? Who should be talked to first? What framing
       should be used with each person?
  summary: "Analyst assessment of stakeholder exchange"
```

Wait for analyst response.

**3h. Shutdown & Cleanup:**

```
try:
  [Steps 3b-3g above]
finally:
  SendMessage shutdown_request to all stakeholder agents + analyst
  TeamDelete "war-game-{timestamp}"
```

✓ CHECKPOINT after Step 3

---

### Step 4: Synthesis & Output

Lead synthesises the full exchange into a preparation briefing.

**Output Format:**

```markdown
---
type: work
subtype: war-game
date: YYYY-MM-DD
tags: [war-game, STAKEHOLDER_NAMES, TOPIC_KEYWORDS]
related: []
status: draft
stakeholders: [STAKEHOLDER_NAMES]
---

# War Game: [Scenario]

## Scenario
[The scenario being war-gamed]

## Your Role & Goal
- **Role**: [participant/observer/decision-maker]
- **Desired outcome**: [user's stated goal]

## Stakeholder Positions

### [Stakeholder 1]
**Opening position**: [summary]
**Key concerns**: [list]
**Non-negotiables**: [list]
**Communication style**: [from dossier]

### [Stakeholder 2]
**Opening position**: [summary]
**Key concerns**: [list]
**Non-negotiables**: [list]
**Communication style**: [from dossier]

## Exchange Summary

### Round 1: Opening Positions
[Brief summary of each stakeholder's initial position]

### Round 2: Responses
[What changed, what hardened, where movement occurred]

## Analyst Assessment

### Genuinely Contested
[Real underlying disagreements]

### Compromise Zones
[Where positions are closer than they appear]

### Leverage Points

| Stakeholder | Effective Frame | Evidence/Argument |
|-------------|----------------|-------------------|
| [name] | [what works with them] | [specific argument to use] |

### Non-Negotiables

| Stakeholder | Non-Negotiable | Why (motivation) |
|-------------|---------------|-----------------|
| [name] | [position] | [underlying motivation from dossier] |

## Preparation Briefing

### Most Likely Outcome
[What will probably happen based on the exchange]

### Key Decision Points
[Moments where the conversation could go different ways]

### Scenario Branches

**If [condition A]:**
- [preparation advice]
- [specific framing to use]

**If [condition B]:**
- [preparation advice]
- [specific framing to use]

### Recommended Approach
1. [Step 1 — who to talk to first, with what framing]
2. [Step 2]
3. [Step 3]
```

**Present to user for review**, offer to save.

**Save to**: `work/YYYY-MM-DD-war-game-[slug].md`

**Update daily context index:**
```markdown
| HH:MM | War Game | [Scenario summary] — [N] stakeholders, [key finding] |
```

**Emit Causantic event:**
```
[war-game-result: scenario=SCENARIO_SLUG, stakeholders=NAMES, rounds=N, contested_areas=N, compromise_zones=N, leverage_points=N]
```

✓ CHECKPOINT after Step 4

---

## Agent Prompt Templates

### Stakeholder Prompt

```
You are role-playing as [PERSON_NAME] in a scenario planning exercise.

SCENARIO: [SCENARIO_DESCRIPTION]

YOUR PROFILE (based on real observations of this person):
- Communication style: [communicationStyle]
- Decision making: [decisionMaking]
- Motivations: [motivations]
- Sensitivities: [sensitivities]
- Known triggers: [knownTriggers]

YOUR TASK:
Present your position on this scenario AS [PERSON_NAME] WOULD.

1. STATE YOUR POSITION clearly (what outcome you want)
2. EXPLAIN YOUR REASONING (what drives this — use your motivations)
3. IDENTIFY YOUR CONSTRAINTS (what you cannot accept)
4. ANTICIPATE OBJECTIONS (what will others say, how would you respond)

Stay in character. Use the communication patterns described in your profile.
If [PERSON_NAME] would be diplomatic, be diplomatic. If they would be
direct, be direct. If they would focus on data, focus on data.

Do NOT break character to provide meta-analysis. You ARE this person
for the purposes of this exercise.
```

### Analyst Prompt

```
You are a strategic analyst observing a multi-stakeholder negotiation.

SCENARIO: [SCENARIO_DESCRIPTION]

STAKEHOLDER PROFILES:
[ALL_DOSSIER_SUMMARIES]

RELATIONSHIP DYNAMICS:
[DYNAMICS_FROM_DOSSIERS]

YOUR ROLE: Observe the stakeholder exchange and identify:
- Where genuine disagreement exists (vs surface-level posturing)
- Where compromise is possible (positions closer than they appear)
- What each stakeholder cannot concede (and the real reason why)
- What leverage exists (arguments that would actually move each person)
- How Greg should approach this strategically

You are NOT a participant. You are an impartial analyst whose job is
to give Greg the clearest possible picture of the landscape and the
most actionable preparation advice.
```

## Graceful Degradation

- **Team prerequisites not met** → ERROR with setup instructions (no fallback — war-game requires teams)
- **Stakeholder dossier missing** → Warn, proceed with generic role-based behavior for that person
- **One stakeholder agent fails** → Continue with remaining stakeholders + analyst; note the gap
- **Analyst fails** → Lead produces analyst assessment (lead-as-analyst fallback)
- **Causantic unavailable** → Skip event emission
- **Daily context unavailable** → Skip context gathering, proceed with scenario only

## Notes

- War games are most valuable when dossiers are well-populated — the quality of stakeholder simulation depends directly on dossier quality
- Limit to 2-3 stakeholders per war game — more creates coordination overhead without proportional insight
- The user's desired outcome shapes the preparation briefing — ensure it's captured in Step 1
- Saved war games can be referenced in `/prep-meeting` when the meeting involves the same stakeholders and scenario
