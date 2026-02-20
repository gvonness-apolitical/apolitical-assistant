# Evaluate

Structured decision evaluation with adversarial debate. Two advocate agents argue for competing options with conviction; a judge synthesises with a weighted scorecard and clear recommendation. Default mode uses agent teams for multi-round debate with rebuttals.

## Core Patterns Used
- [Comparative Debate](../patterns/comparative-debate.md) - Dual-advocate debate with scorecard
- [Team Lifecycle](../patterns/team-lifecycle.md) - Agent team setup, coordination, and cleanup
- [Dossier Context](../patterns/dossier-context.md) - Stakeholder communication and decision profiles
- [Local Context First](../patterns/local-context-first.md) - Check daily context before API calls
- [Daily Index Update](../patterns/daily-index-update.md) - Append to context index
- [Person Resolution](../patterns/person-resolution.md) - Resolve stakeholder names

## Usage

- `/evaluate [topic]` - Full evaluation with team-based 3-round debate (default)
- `/evaluate [topic] --quick` - Skip automated gathering, use provided context only
- `/evaluate [topic] --quick-debate` - Subagent debate without rebuttals (faster, no team needed)
- `/evaluate [topic] --single` - Single-agent scorecard (no debate)
- `/evaluate [topic] --options "A, B"` - Pre-specify options
- `/evaluate [topic] --type vendor` - Pre-specify decision type
- `/evaluate [topic] --web` - Include web search in automated gathering
- `/evaluate [topic] --refresh [artifact-path]` - Re-evaluate with previous evidence as baseline

## Decision Types

| Type | Default Criteria |
|------|-----------------|
| **vendor** | Cost, Feature completeness, API/Integration quality, Vendor stability, Migration effort, Team preference, Support quality |
| **architecture** | Complexity, Performance, Maintainability, Team familiarity, Migration effort, Extensibility, Operational burden |
| **tool** | Developer experience, Feature completeness, Community/ecosystem, Cost, Integration effort, Learning curve |
| **strategy** | Strategic alignment, Risk, Effort, Reversibility, Stakeholder buy-in, Time to value |

Weights: High (3) / Medium (2) / Low (1) — directional guidance for the judge, not a formula.

## Scope

- Exactly **2 options**. For 3+ options, triage to 2 finalists manually before invoking.
- Adversarial debate is the **default** — the debate IS the skill's value. `--single` is the escape hatch for quick scorecards.

---

## Process

### Step 1: Setup

Parse arguments and gather all setup information interactively.

**1a. Parse arguments:**
- Extract topic from invocation (e.g., "Vanta vs Drata", "GRC platform selection")
- Check for flags: `--quick`, `--quick-debate`, `--single`, `--options`, `--type`, `--web`, `--refresh`
- If `--refresh [path]`, read the referenced artifact for prior evidence base

**1b. Resolve decision parameters:**

If topic, options, or type are not provided via flags, ask the user via `AskUserQuestion`:

```
Questions:
1. "What decision are you evaluating?" (if topic unclear)
2. "What are the two options?" (if --options not provided)
3. "What type of decision is this?" — options: Vendor, Architecture, Tool, Strategy
```

**1c. Confirm criteria and weights:**

Load default criteria for the decision type. Present to the user:

```
Default criteria for [type] evaluation:

| Criterion | Weight |
|-----------|--------|
| Cost | Medium |
| Feature completeness | Medium |
| ... | ... |

Adjust criteria or weights? (Or press enter to accept defaults)
```

Use `AskUserQuestion` with options:
- "Accept defaults" (recommended)
- "Adjust weights" — user specifies which criteria to change
- "Add/remove criteria" — user customises the list

**1d. Collect evidence and stakeholder context:**

Ask the user:

```
What evidence do you have? Provide any of:
- Documents (URLs, file paths, email IDs)
- Notes or observations
- Team preferences or feedback
- Stakeholder list (who has a stake in this decision?)
- Known constraints or requirements
```

For each stakeholder mentioned:
- Resolve to email via [Person Resolution](../patterns/person-resolution.md)
- Load dossier via [Dossier Context](../patterns/dossier-context.md) — extract `profile.decisionMaking`, `profile.motivations`, `profile.communicationStyle`
- Note any stated preferences (e.g., "Samuel prefers Drata")

**1e. Check for `--refresh` baseline:**

If `--refresh` was provided:
- Load the previous artifact
- Extract evidence base and criteria
- Present: "Previous evaluation found. What's changed since then?"
- Merge new evidence with previous baseline

✓ CHECKPOINT after Step 1

---

### Step 2: Automated Gathering

⊘ Skip with `--quick` flag.

Search internal systems for relevant context. Check `context/YYYY-MM-DD/index.md` first (Local Context First pattern).

**Sources to search:**

| Source | Search For | Tool |
|--------|-----------|------|
| Slack | Mentions of both options, decision topic | `slack_search` |
| Email | Threads about the decision, vendor comms | `gmail_search` |
| Notion | RFCs, PRDs mentioning the topic | `notion-search` |
| Drive | Proposals, comparison docs, contracts | `drive_search` |
| Causantic | Prior discussions, related decisions | `causantic-search` |

**Optional (with `--web` flag):**

| Source | Search For | Tool |
|--------|-----------|------|
| Web | Pricing pages, feature comparisons, reviews | `WebSearch` |
| G2/reviews | User reviews, competitive analysis | `WebFetch` |

Compile all discovered evidence. Tag each item with its source for the Evidence Base section.

✓ CHECKPOINT after Step 2

---

### Step 3: Evidence Review (Approval Gate)

Present the compiled evidence base to the user:

```markdown
## Evidence Base for [Topic]

### Option A: [Name]
- [Source]: [Summary]
- [Source]: [Summary]

### Option B: [Name]
- [Source]: [Summary]
- [Source]: [Summary]

### Stakeholder Positions
| Stakeholder | Known Position | Confidence |
|-------------|---------------|------------|
| [Name] | [Preference/concern] | [Stated/Inferred] |

### Evidence Gaps
- [ ] [Missing information that could affect the decision]
- [ ] [Area where neither option has clear evidence]

### Criteria (confirmed)
| Criterion | Weight |
|-----------|--------|
| ... | ... |
```

Ask user to confirm: "Evidence base looks complete? Any additions before the debate runs?"

Use `AskUserQuestion`:
- "Proceed with debate" (recommended)
- "Add more evidence" — user provides additional context
- "Adjust criteria" — last chance to change weights

✓ CHECKPOINT after Step 3

---

### Step 4: Evaluate

Three execution paths based on flags and team prerequisites:

#### Path A: `--single` (Single-Agent Scorecard)

Skip debate entirely. Run a single agent that scores both options against all criteria, produces a scorecard, and makes a recommendation. Use the Judge prompt template from the [Comparative Debate](../patterns/comparative-debate.md) pattern directly, but without advocate arguments to synthesise — just score from evidence.

#### Path B: `--quick-debate` OR Team Prerequisites Fail (Subagent Debate)

Current subagent behavior — no team needed. Two parallel advocate subagents produce arguments, then a sequential judge subagent synthesises.

This path activates when:
- `--quick-debate` flag is explicitly set
- Team prerequisites fail (env var, settings, or nesting check — see [Team Lifecycle](../patterns/team-lifecycle.md))

**4a. Launch Advocate-A (Task agent, parallel):**

Prompt structure (full template below):
- Role: Argue FOR Option A
- Lens: Long-term strategic fit
- Evidence: Full evidence base
- Criteria: Full list with weights
- Stakeholder context: Dossier profiles + stated preferences
- Requirements: Argue every criterion, attack Option B (3 risks), closing argument
- Anti-hedge instructions

**4b. Launch Advocate-B (Task agent, parallel):**

Prompt structure:
- Role: Argue FOR Option B
- Lens: Pragmatic near-term execution
- Evidence: Full evidence base (identical to Advocate-A)
- Criteria: Full list with weights
- Stakeholder context: Dossier profiles + stated preferences
- Requirements: Same structural requirements as Advocate-A
- Anti-hedge instructions

Steps 4a and 4b run as **parallel** Task agents with `subagent_type: "general-purpose"`.

**4c. Launch Judge (Task agent, sequential):**

After both advocates complete, launch the Judge with both outputs. Judge produces:
1. **Criterion-by-criterion scoring** (1-5 per option, per criterion, with justification)
2. **Argument audit** (strawmanning? unsupported claims?)
3. **Weighted scorecard** (score × weight, show math, totals)
4. **Recommendation** (clear, no hedging)
5. **Decision conditions** ("Choose A if..." / "Choose B if...")
6. **Open questions** (what could change the recommendation?)

#### Path C: Default (Team-Based 3-Round Debate)

The default execution path. Uses Claude Code agent teams for multi-round debate with rebuttals — the rebuttal round is the key quality improvement over Path B.

Follow the [Team Lifecycle](../patterns/team-lifecycle.md) pattern for setup and cleanup.

**4a. Prerequisites Check:**

```
1. Check env var CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
2. Read settings.json → agentTeams.enabled
3. Confirm not already in a team context
→ If ANY fails: fall back to Path B
```

**4b. Create Team:**

```
TeamCreate:
  team_name: "evaluate-{timestamp}"
  description: "Evaluate: {TOPIC}"
```

**4c. Round 1 — Opening Arguments (Parallel):**

Spawn `advocate-a` and `advocate-b` as teammates:

```
Task (parallel):
  team_name: "evaluate-{timestamp}"
  name: "advocate-a"
  subagent_type: "general-purpose"
  prompt: [Advocate Prompt with Option A, strategic lens]

Task (parallel):
  team_name: "evaluate-{timestamp}"
  name: "advocate-b"
  subagent_type: "general-purpose"
  prompt: [Advocate Prompt with Option B, pragmatic lens]
```

Both receive identical evidence base, criteria, and stakeholder context. Wait for both to complete.

**4d. Round 2 — Rebuttals (Parallel):**

Send each advocate the other's opening argument via SendMessage with the Rebuttal Prompt:

```
SendMessage:
  type: "message"
  recipient: "advocate-a"
  content: [Rebuttal Prompt + advocate-b's opening argument]
  summary: "Round 2 rebuttal of opponent's argument"

SendMessage:
  type: "message"
  recipient: "advocate-b"
  content: [Rebuttal Prompt + advocate-a's opening argument]
  summary: "Round 2 rebuttal of opponent's argument"
```

Wait for both rebuttal responses.

**4e. Round 3 — Judge Synthesis:**

Spawn a **separate `judge` teammate** (not lead-as-judge — keeps context clean for complex synthesis):

```
Task:
  team_name: "evaluate-{timestamp}"
  name: "judge"
  subagent_type: "general-purpose"
  prompt: [Judge Prompt with all 4 documents: both openings + both rebuttals]
```

Judge produces:
1. **Criterion-by-criterion scoring** (1-5 per option, per criterion, with justification)
2. **Rebuttal analysis** (see Section 2b in Judge prompt)
3. **Argument audit** (strawmanning? unsupported claims? Did rebuttals land?)
4. **Weighted scorecard** (score × weight, show math, totals)
5. **Recommendation** (clear, no hedging)
6. **Decision conditions** ("Choose A if..." / "Choose B if...")
7. **Open questions** (what could change the recommendation?)

**4f. Shutdown & Cleanup:**

```
try:
  [Steps 4b-4e above]
finally:
  SendMessage shutdown_request to advocate-a, advocate-b, judge
  TeamDelete "evaluate-{timestamp}"
```

✓ CHECKPOINT after Step 4

---

### Step 5: Draft, Review & Save

**5a. Format decision brief:**

Use the [decision-brief template](../templates/decision-brief.md). Populate:
- Executive summary from Judge recommendation
- Scorecard from Judge output
- Advocate arguments (full text — transparency)
- Judge synthesis (argument audit, agreement/contested zones)
- Recommendation with risks and mitigations
- Decision conditions
- Stakeholder input table (from Step 1 + evidence)
- Evidence base with sources and gaps

**5b. Present for review (approval gate):**

Show the formatted brief to the user. Ask:

```
Decision brief complete. Review the recommendation and scorecard above.

Anything to adjust before saving?
```

Use `AskUserQuestion`:
- "Save as-is" (recommended)
- "Adjust and save" — user requests specific changes
- "Don't save" — user wants to iterate further

**5c. Save artifact:**

Save to `work/YYYY-MM-DD-evaluate-[slug].md` where slug is derived from the topic (lowercase, hyphens, truncated to ~40 chars).

**Frontmatter:**
```yaml
---
type: work
subtype: decision-brief
date: YYYY-MM-DD
tags: [decision, evaluate, TYPE]
related: []
status: draft
stakeholders: [STAKEHOLDER_NAMES]
---
```

**5d. Update daily context index:**

Follow [Daily Index Update](../patterns/daily-index-update.md):
- Append session log entry: `| HH:MM | Evaluate | [Topic]: [Recommendation summary] |`
- Add link to artifact

**5e. Emit Causantic event:**

```
[evaluate-result: topic=TOPIC, type=TYPE, option_a=NAME, option_b=NAME, recommendation=WINNER, score_a=N, score_b=N, mode=team-debate|subagent-debate|single, rounds=N, rebuttals_effective=N/total, claims_collapsed=N, stakeholders=N]
```

- `mode`: `team-debate` (Path C), `subagent-debate` (Path B), or `single` (Path A)
- `rounds`: Number of debate rounds completed (3 for team, 1 for subagent, 0 for single)
- `rebuttals_effective`: How many rebuttals scored 4-5 by judge / total rebuttals (team mode only)
- `claims_collapsed`: How many opening claims collapsed under rebuttal (team mode only)

✓ CHECKPOINT after Step 5

---

## Agent Prompt Templates

### Advocate Prompt (Full)

```
You are evaluating [OPTION_A] vs [OPTION_B] for the following decision:

DECISION: [TOPIC]
TYPE: [DECISION_TYPE]

Your role: Argue convincingly FOR [YOUR_OPTION]. You spent 6 months researching
this option. Your professional reputation depends on making the strongest possible case.

Your argumentative lens: [LENS_DESCRIPTION]

EVALUATION CRITERIA (argue every one):
[CRITERIA_TABLE_WITH_WEIGHTS]

EVIDENCE BASE:
[COMPILED_EVIDENCE]

STAKEHOLDER CONTEXT:
[DOSSIER_SUMMARIES_AND_STATED_PREFERENCES]

REQUIREMENTS:
1. Argue EVERY criterion listed above. For each:
   - Why [YOUR_OPTION] scores well on this criterion
   - Why [OTHER_OPTION] falls short on this criterion
   - Cite specific evidence where available

2. Identify exactly 3 RISKS of choosing [OTHER_OPTION]:
   - Each must be concrete, specific, and evidence-based
   - Not hypothetical "could happen" risks — real, likely consequences

3. Address stakeholder preferences:
   - For stakeholders who prefer [OTHER_OPTION], explain why they should reconsider
   - For stakeholders who prefer [YOUR_OPTION], reinforce their reasoning

4. Deliver a CLOSING ARGUMENT:
   - Exactly 3 sentences
   - Summarise your single strongest case for [YOUR_OPTION]

ANTI-HEDGE RULES:
- Do NOT use "both are good options"
- Do NOT use "it depends on your priorities"
- Do NOT use "either could work"
- Do NOT soften with "minor concern" or "slight edge"
- You are an advocate, not a mediator. Make your case.
```

**Lens assignments:**
- Advocate-A: "Lead with LONG-TERM STRATEGIC FIT — emphasise durability, scalability, ecosystem trajectory, and how well [OPTION_A] positions the organisation for the next 2-3 years."
- Advocate-B: "Lead with PRAGMATIC NEAR-TERM EXECUTION — emphasise implementation speed, risk reduction, team productivity in the next 6-12 months, and practical integration concerns."

### Rebuttal Prompt (Team Mode — Round 2)

Sent via SendMessage to each advocate after Round 1, along with the opponent's opening argument.

```
Your opponent has presented their opening argument for [OTHER_OPTION]:

OPPONENT'S OPENING ARGUMENT:
[opponent_opening_output]

YOUR TASK: Write a rebuttal targeting their 3 weakest claims.

For each claim you target:
1. QUOTE the specific claim from their argument
2. Explain WHY it fails (logic gap, missing evidence, cherry-picked data, ignores trade-off)
3. Present COUNTER-EVIDENCE or a stronger framing that undermines their claim

RULES:
- Do NOT restate your opening argument — attack theirs
- Target exactly 3 claims — choose the weakest, not the easiest
- If a claim from your opponent is genuinely strong, say so — then attack
  a different one. Acknowledging a strong point is not weakness; it builds
  credibility for your remaining attacks.
- Be specific. "Their cost analysis is flawed" is not a rebuttal. "Their
  cost analysis omits migration labour, which based on [evidence] adds
  approximately [X]" is a rebuttal.
```

### Judge Prompt (Full — Subagent Mode / Path B)

```
Two advocates have argued for competing options in the following decision:

DECISION: [TOPIC]
TYPE: [DECISION_TYPE]

ADVOCATE FOR [OPTION_A]:
[advocate_a_output]

ADVOCATE FOR [OPTION_B]:
[advocate_b_output]

EVALUATION CRITERIA AND WEIGHTS:
[CRITERIA_TABLE_WITH_WEIGHTS]

Produce the final assessment:

1. CRITERION-BY-CRITERION SCORING:
   For each criterion, provide:
   - [OPTION_A] score (1-5) with 1-sentence justification
   - [OPTION_B] score (1-5) with 1-sentence justification
   - Which advocate's argument was more convincing for this criterion

2. ARGUMENT AUDIT:
   - Did either advocate strawman the opposing option? Cite specific instances.
   - Did either make claims unsupported by the evidence base? Flag them.
   - Did either advocate pull punches or hedge despite the anti-hedge instructions?

3. WEIGHTED SCORECARD:
   For each criterion:
   - [OPTION_A] score × weight = weighted score
   - [OPTION_B] score × weight = weighted score
   Show the math. Present totals for both options.

4. RECOMMENDATION:
   Choose one option. State it as: "Recommend: [OPTION]"
   Follow with 2-3 sentences explaining the primary reason.
   Do NOT hedge. Do NOT say "it's close" unless the scores are within 5%.

5. DECISION CONDITIONS:
   "Choose [OPTION_A] if:" — 2-3 conditions that would make A the right choice
   "Choose [OPTION_B] if:" — 2-3 conditions that would make B the right choice

6. OPEN QUESTIONS:
   What information, if available, could change the recommendation?
   List 2-4 specific questions.

7. KEY RISKS OF RECOMMENDED OPTION:
   Even the recommended option has risks. List the top 2-3 with mitigations.
```

### Judge Prompt (Full — Team Mode / Path C)

Used when rebuttals are available from Round 2.

```
Two advocates have argued for competing options in the following decision,
including a rebuttal round where each targeted the other's weakest claims:

DECISION: [TOPIC]
TYPE: [DECISION_TYPE]

--- ROUND 1: OPENING ARGUMENTS ---

ADVOCATE FOR [OPTION_A] — OPENING:
[advocate_a_opening]

ADVOCATE FOR [OPTION_B] — OPENING:
[advocate_b_opening]

--- ROUND 2: REBUTTALS ---

ADVOCATE FOR [OPTION_A] — REBUTTAL OF [OPTION_B]:
[advocate_a_rebuttal]

ADVOCATE FOR [OPTION_B] — REBUTTAL OF [OPTION_A]:
[advocate_b_rebuttal]

EVALUATION CRITERIA AND WEIGHTS:
[CRITERIA_TABLE_WITH_WEIGHTS]

Produce the final assessment:

1. CRITERION-BY-CRITERION SCORING:
   For each criterion, provide:
   - [OPTION_A] score (1-5) with 1-sentence justification
   - [OPTION_B] score (1-5) with 1-sentence justification
   - Which advocate's argument was more convincing for this criterion

2. REBUTTAL ANALYSIS:
   For each rebuttal claim (6 total — 3 per advocate):
   - Quote the targeted claim from the opponent's opening
   - Quote the rebuttal response
   - Score the rebuttal effectiveness 1-5:
     1 = Irrelevant or strawman attack
     2 = Addresses the claim but with weak evidence
     3 = Reasonable challenge but not decisive
     4 = Strong rebuttal that significantly weakens the claim
     5 = Devastating — the original claim cannot stand
   - Verdict: Did the targeted claim SURVIVE or COLLAPSE?

   Summary: Claims surviving rebuttal → assign HIGH confidence in scoring.
   Claims collapsing under rebuttal → DOWNWEIGHT in scoring.

3. ARGUMENT AUDIT:
   - Did either advocate strawman the opposing option? Cite specific instances.
   - Did either make claims unsupported by the evidence base? Flag them.
   - Did either advocate pull punches or hedge despite the anti-hedge instructions?
   - Did rebuttals introduce NEW unsupported claims?

4. WEIGHTED SCORECARD:
   For each criterion:
   - [OPTION_A] score × weight = weighted score
   - [OPTION_B] score × weight = weighted score
   Show the math. Present totals for both options.
   Note: Scores should reflect rebuttal outcomes — a criterion where
   one side's claims collapsed should favour the other.

5. RECOMMENDATION:
   Choose one option. State it as: "Recommend: [OPTION]"
   Follow with 2-3 sentences explaining the primary reason.
   Reference the most decisive rebuttal outcome.
   Do NOT hedge. Do NOT say "it's close" unless the scores are within 5%.

6. DECISION CONDITIONS:
   "Choose [OPTION_A] if:" — 2-3 conditions that would make A the right choice
   "Choose [OPTION_B] if:" — 2-3 conditions that would make B the right choice

7. OPEN QUESTIONS:
   What information, if available, could change the recommendation?
   List 2-4 specific questions.

8. KEY RISKS OF RECOMMENDED OPTION:
   Even the recommended option has risks. List the top 2-3 with mitigations.
```

---

## Single-Agent Mode (`--single`)

When `--single` is specified, skip the debate entirely. Run a single agent that:

1. Receives the full evidence base and criteria
2. Scores both options against each criterion (1-5)
3. Produces a weighted scorecard
4. Makes a recommendation

Use the Judge prompt template directly, replacing advocate arguments with the evidence base. The output follows the same decision-brief template but omits the Advocate Arguments and Judge Synthesis sections.

---

## Graceful Degradation

**Team mode (Path C) failures:**
- Team prerequisites fail → fall back to Path B (subagent debate)
- Team creation fails → fall back to Path B
- One advocate fails during Round 1 → shut down team, fall back to Path B
- Rebuttal round fails (Round 2) → degrade within team: proceed to judge with opening arguments only (no rebuttals)
- Judge fails → present both advocate outputs (openings + rebuttals if available) side-by-side, ask user to adjudicate
- TeamDelete fails → log error, proceed with skill output

**Subagent mode (Path B) failures:**
- If one advocate agent fails → present the surviving advocate's argument + single-agent scoring for the other option
- If both advocate agents fail → fall back to `--single` mode
- If Judge agent fails → present both advocate outputs side-by-side, ask user to adjudicate

**General:**
- If Causantic is unavailable → skip event emission
- If dossiers.json is missing → proceed without stakeholder profiles
- If `--quick` and no user evidence provided → warn and ask for at least some context

---

## Future Extensions

- **3+ options**: Bracket elimination to 2 finalists, then debate. Requires triage criteria and elimination prompts.
- **`--refresh`**: Re-evaluate with a previous artifact as baseline (framework exists in Step 1e, needs testing).
- **Web search integration**: Currently opt-in via `--web`. Could auto-enable for vendor type decisions.
