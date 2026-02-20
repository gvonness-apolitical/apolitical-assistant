# Adversarial Debate Pattern

Two competing agents (Advocate + Challenger) argue opposing positions on a binary assessment; a Judge synthesizes the final output. Based on Stackelberg game theory — Agent A's dominant strategy is to pre-empt B's strongest critiques; Agent B's dominant strategy is to find genuine weaknesses (not nitpick), because the Judge discounts weak arguments. In Nash equilibrium, both present maximally strong cases and real issues surface.

## When to Use

- Binary assessment decisions (approve/reject, GREEN/RED, accept/revise)
- High-stakes evaluations where a single-pass review may miss issues
- Activated by `--compete` flag or auto-gating rules (see Cost Gating below)

## Files Involved

- The skill's command file (e.g., `commands/review-rfc.md`)
- This pattern file
- Causantic MCP (for memory feedback)

## Algorithm

### Step 1: Context Gathering (Single Agent)

The skill gathers all context as normal — RFC content, architecture docs, related code, industry research. This data is collected **once** and shared with both agents. No API call duplication.

### Step 2: Cost Gate Check

Determine whether competitive mode is active:

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Skill-specific auto-trigger (see skill docs) | Yes |
| Default (no flag, no auto-trigger) | No — single-agent |

If competitive mode is not active, fall back to single-agent execution and skip remaining steps.

### Step 3: Launch Advocate Agent (Parallel)

Launch a Task agent with the gathered context and the Advocate prompt template. The Advocate reviews with a bias toward approval, presenting the strongest case that the artifact is well-designed and ready to proceed.

**Advocate Prompt Template:**

```
You are reviewing [ARTIFACT] with a bias toward approval. Present the strongest
case that it is well-designed and ready to proceed. Identify what works,
acknowledge trade-offs, argue concerns are manageable. You MUST flag genuine
blocking issues — but frame them as addressable. Use [EVALUATION_FRAMEWORK].
Be specific — cite evidence from the artifact.
```

### Step 4: Launch Challenger Agent (Parallel)

Launch a Task agent with the gathered context and the Challenger prompt template. The Challenger reviews with a bias toward finding real issues. **Sycophancy countermeasures are critical here** — see below.

**Challenger Prompt Template (Sycophancy-Hardened):**

```
You are a senior staff engineer who has seen 50+ [ARTIFACT_TYPE]s fail in
production. Your reputation depends on finding real issues.

Present the strongest case that this [ARTIFACT] has significant issues. Find
architectural weaknesses, missing edge cases, operational risks, and anti-patterns.

STRUCTURAL REQUIREMENT: Produce exactly 5 concerns ranked by severity. For each:
- Cite specific text from the [ARTIFACT]
- Explain the concrete production risk
- Suggest a specific fix

Do NOT soften concerns with "minor nitpick", "probably fine but", or "just a
thought". If it's a problem, state it as a problem. An artifact with zero real
issues doesn't exist.

You MUST acknowledge what works — but argue the issues outweigh the strengths.
```

Steps 3 and 4 run as **parallel** Task agents — they receive identical context and produce independent outputs.

### Step 5: Launch Judge Agent (Sequential)

After both agents complete, launch the Judge agent with both outputs.

**Judge Prompt Template:**

```
You have two reviews of the same [ARTIFACT]:

ADVOCATE POSITION:
[advocate_output]

CHALLENGER POSITION:
[challenger_output]

Produce the final assessment by:
1. Which Advocate arguments survived the Challenger's critique?
2. Which Challenger concerns did the Advocate fail to address?
3. For each concern: genuine issue or a stretch? Score 1-5.
4. Did the Challenger pull punches? Were concerns genuine or performative?
5. Produce the final output in [STANDARD_FORMAT]
6. Mark agreement zones (high confidence) vs contested zones (flag for attention)
7. Extract 2-3 key narratives — specific arguments that survived the debate and should be emphasised in the skill's downstream output
```

### Step 6: Format Output (Transparency)

The final output includes the full debate — the user sees all three positions, not just the synthesis. This serves two purposes: (1) the user can override the judge if they disagree, (2) the full debate is more informative than a single blended output.

**Output Format:**

```markdown
## Competitive Review

### Advocate Position
[Full advocate argument]

### Challenger Position
[Full challenger argument]

### Judge Synthesis
[Analysis of which arguments won, final recommendation]

**Key narratives:**
1. [specific argument that survived the debate and should be emphasised downstream]
2. [narrative]
3. [narrative]

**Agreement zones** (high confidence): [list]
**Contested zones** (flag for attention): [list]
```

### Step 7: Emit Causantic Event

After output is complete, emit a brief structured summary so Causantic hooks capture it:

```
[compete-result: skill=SKILL_NAME, artifact=ARTIFACT_ID, disagreements=N, resolution=SUMMARY, sided_with=challenger:N/advocate:N]
```

## Sycophancy Countermeasures

LLMs default to constructive, agreeable output. The Challenger role must be explicitly hardened:

1. **Identity priming**: "You are a senior staff engineer who has seen 50+ [ARTIFACT_TYPE]s fail in production. Your reputation depends on finding real issues."
2. **Structural forcing**: "Produce exactly 5 concerns ranked by severity. For each, cite specific text. An artifact with zero issues doesn't exist."
3. **Anti-sycophancy instruction**: "Do NOT soften concerns with 'minor nitpick' or 'probably fine but'. If it's a problem, state it as a problem."
4. **Judge calibration**: The Judge explicitly asks "Did the Challenger pull punches? Were concerns genuine or performative?" — creating pressure for the Challenger to be substantive.

These countermeasures also apply to the Critic role in the [Critique Ratchet](critique-ratchet.md) pattern.

## Cost Gating

Competition doubles or triples token cost. Auto-enable only when worth it:

| Trigger | Action |
|---------|--------|
| `--compete` flag | Always enable |
| `--single` flag | Always disable (override auto) |
| `deep` review depth | Auto-enable for `review-rfc` |
| RFC tagged "architecture" or "infrastructure" | Auto-enable for `review-rfc` |
| RFC author is senior/principal | Auto-enable for `review-rfc` (higher-stakes review) |
| Email/response to exec or manager | Auto-enable for `respond-to`/`draft-email` |
| Previous month's RAG was AMBER or RED | Auto-enable for `mbr` |
| Multiple DORA level drops in current month | Auto-enable for `mbr` |
| P0/P1 incident with outstanding follow-ups | Auto-enable for `mbr` |
| Default (no trigger) | Single-agent (no competition) |

Skills define their own auto-trigger rules within their command files.

## Evaluation Metrics

Track competitive mode quality over time to calibrate whether it's adding value:

- **User edit distance**: How much does the user modify competitive output vs single-agent? Less editing = better quality.
- **Acceptance rate**: How often does the user accept competitive output without changes?
- **Disagreement value**: When Advocate and Challenger disagreed, how often did the final output align with each? Persistent alignment with one side suggests the other isn't pulling weight.

**Storage**: Emit structured Causantic events after each competitive run:

```
[compete-eval: skill=SKILL_NAME, edit_distance=low|medium|high, acceptance=true|false, disagreements=N, sided_with=challenger:N/advocate:N]
```

**Threshold**: If 5+ consecutive competitive runs show zero disagreement value (agents always agree), the competitive mode isn't adding value for that skill — flag for review.

## Graceful Degradation

- If either Advocate or Challenger agent fails → fall back to single-agent review using the surviving agent's output
- If both agents fail → fall back to standard single-agent execution (no competitive mode)
- If Judge agent fails → present both outputs side-by-side without synthesis; ask user to adjudicate
- If Causantic is unavailable → skip the memory event; everything else works

## Variants

### Devil's Advocate (`/rubberduck --challenge`) — Implemented

For stress-testing strategic thinking in `/rubberduck` sessions:

- **Steelman Agent** develops the user's argument to its strongest form — fills gaps, finds supporting evidence, pre-empts objections
- **Devil's Advocate Agent** (sycophancy-hardened) systematically attacks it: exactly 5 challenges ranked by severity, each citing the assumption being challenged, the strongest counterargument, and the concrete risk
- **Judge** identifies which parts of the argument survived and which need strengthening, produces a revised position

Unlike standard Adversarial Debate, there's no user selection step — the Judge synthesis IS the output. The user sees all three positions (steelman, devil's advocate, synthesis) in the saved document.

No auto-triggers — user opts in with `--challenge`. See `commands/rubberduck.md` for full prompt templates and output format.

### Priority Voting (`/update-todos --compete`) — Implemented

For resolving priority disagreements in `/update-todos`:

- **Agent A (Urgency Lens)** independently assigns P0-P3 priorities based on who is waiting, response time, and deadlines
- **Agent B (Impact Lens)** independently assigns P0-P3 priorities based on strategic value, team health, and leverage
- **Disagreement surfacing**: Items where agents disagree by 2+ priority levels are flagged for user attention with both justifications
- **Resolution**: Borda count (P0=4, P1=3, P2=2, P3=1, summed across agents) produces a suggested ordering; disagreements shown explicitly via `AskUserQuestion` for user confirmation

Auto-triggers when total action items >= 15 after deduplication. See `commands/update-todos.md` for full prompt templates, Borda scoring, and disagreement output format.

### Comparative Debate (`/evaluate`) — Implemented

For N-way option comparison (vendor selection, architecture decisions, tool choices):

- **Advocate-A** argues FOR Option A with long-term strategic fit lens
- **Advocate-B** argues FOR Option B with pragmatic near-term execution lens
- **Judge** produces criterion-by-criterion scores, weighted scorecard, and clear recommendation

Key differences from standard Adversarial Debate: both agents are advocates (not advocate/challenger), output is a scorecard (not binary approve/reject), asymmetric argumentative lenses ensure structural differentiation.

Adversarial is the **default** — `--single` is the escape hatch. See [Comparative Debate](comparative-debate.md) pattern and `commands/evaluate.md` for full details.

## Team-Based Execution

When Claude Code agent teams are available (see [Team Lifecycle](team-lifecycle.md)), skills using this pattern can upgrade from single-shot subagent debate to multi-round interaction where agents respond to each other's output.

### Upgrade Path

| Skill | Subagent Behavior | Team Behavior | Judge Architecture |
|-------|-------------------|---------------|-------------------|
| `/evaluate` | 2 parallel advocates → 1 judge | 3-round: opening → rebuttal → judge | Separate judge teammate |
| `/review-rfc deep` | Advocate + Challenger → Judge | 3 specialised reviewers → cross-reference → judge | Separate judge teammate |
| `/rubberduck --challenge` | Steelman + DA parallel → Judge | 4-round: steelman → challenges → defense → assessment | Lead-as-judge |
| `/mbr --compete` | Optimist + Skeptic → Judge | 3-round: positions → cross-examination → synthesis | Lead-as-judge |

### Lead-as-Judge vs Separate Judge

| Approach | When | Why |
|----------|------|-----|
| **Separate judge teammate** | `/evaluate`, `/review-rfc` | Complex synthesis requiring clean context — judge shouldn't see orchestration overhead |
| **Lead-as-judge** | `/rubberduck`, `/mbr` | Lighter synthesis, fewer competing positions — lead already has full context |

### Fallback Chain

Every team-using skill implements this cascade:

```
1. Team-based multi-round execution (default when prerequisites met)
   ↓ (team prerequisites fail)
2. Subagent execution (existing single-shot patterns)
   ↓ (subagent execution fails)
3. Single-agent execution
```

`--single` always bypasses both team AND subagent modes, going straight to single-agent.

### Related Patterns

- [Team Lifecycle](team-lifecycle.md) — prerequisites, team creation, round orchestration, shutdown, cleanup
- [Cross-Examination](cross-examination.md) — targeted evidence challenges used by `/mbr` and `/review-rfc`
- [Comparative Debate](comparative-debate.md) — variant with rebuttal round used by `/evaluate`

## Skills Using This Pattern

- `/review-rfc` — Advocate argues "approve", Challenger argues "needs rework" (implemented). `deep` mode upgrades to specialised team (security/architecture/operations reviewers) with cross-reference round. Judge produces key themes that prioritise the review's Blocking Concerns and Recommendations. Competitive reviews are saved locally to `work/` for Causantic recall.
- `/mbr` — Optimist argues GREEN, Skeptic argues AMBER/RED for RAG status (implemented). Team mode adds cross-examination round where lead produces targeted questions per agent. Judge/lead produces key narratives that feed into the MBR commentary prose. Debate summary persisted in the local copy's Data Sources appendix.
- `/rubberduck` — Devil's Advocate variant for strategic thinking (implemented). Team mode: 4-round dialectic (steelman → challenges → defense → counter-assessment). Subagent mode: Steelman + DA parallel → Judge. No auto-triggers — user opts in with `--challenge`. Dossier context informs both agents when stakeholders are mentioned.
- `/update-todos` — Priority Voting variant for action item triage (implemented). Urgency vs Impact lenses with Borda count resolution. Auto-triggers when >= 15 items after dedup. Disagreements (2+ level gap) surfaced via AskUserQuestion. **Not upgraded to teams** — marginal improvement doesn't justify overhead.
