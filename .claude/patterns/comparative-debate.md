# Comparative Debate Pattern

Two advocate agents each argue FOR their assigned option with conviction; a Judge synthesises with a weighted scorecard and clear recommendation. Variant of [Adversarial Debate](adversarial-debate.md) designed for N-way option comparison rather than binary approve/reject.

## When to Use

- Comparing 2 options where both have legitimate merit (vendor selection, architectural decisions, tool choices)
- Decisions with multiple weighted criteria and stakeholder perspectives
- Used by `/evaluate` — adversarial is the default, `--single` is the escape hatch

## Key Differences from Adversarial Debate

| Aspect | Adversarial Debate | Comparative Debate |
|--------|-------------------|-------------------|
| Agent roles | Advocate + Challenger | Advocate-A + Advocate-B |
| Stance | FOR vs AGAINST one thing | FOR option A vs FOR option B |
| Judge output | Binary (approve/reject) + concerns | Weighted scorecard + recommendation |
| Attack vector | Challenger finds flaws | Each advocate attacks the opposing option |

## Algorithm

### Step 1: Prepare Evidence & Criteria

Collected by the calling skill before launching agents. Both advocates receive:
- Full evidence base (identical — no information asymmetry)
- Criteria list with weights (High=3, Medium=2, Low=1)
- Stakeholder context (dossier profiles, known preferences)

### Step 2: Launch Advocate Agents (Parallel)

Two Task agents launched in parallel with **asymmetric argumentative lenses** to produce structurally different arguments:

**Advocate-A Prompt:**

```
You are evaluating [OPTION_A] vs [OPTION_B] for [DECISION].

Your role: Argue convincingly FOR [OPTION_A]. You spent 6 months researching this
option. Your professional reputation depends on making the strongest possible case.

Your argumentative lens: Lead with LONG-TERM STRATEGIC FIT — emphasise durability,
scalability, ecosystem trajectory, and how well [OPTION_A] positions the organisation
for the next 2-3 years.

REQUIREMENTS:
1. Argue EVERY criterion in the evaluation framework. Do not skip any.
2. For each criterion, explain why [OPTION_A] scores well AND why [OPTION_B] falls short.
3. Identify exactly 3 RISKS of choosing [OPTION_B] — concrete, specific, evidence-based.
4. Address known stakeholder preferences — acknowledge those who prefer the other option
   and explain why they should reconsider.
5. Close with a 3-sentence closing argument summarising your strongest case.

Do NOT hedge with "both are good options". Do NOT use phrases like "it depends" or
"either could work". You are an advocate, not a mediator. Make your case with conviction.

[EVIDENCE_BASE]
[CRITERIA_WITH_WEIGHTS]
[STAKEHOLDER_CONTEXT]
```

**Advocate-B Prompt:**

Same structure but:
- Argues FOR [OPTION_B], attacks [OPTION_A]
- Argumentative lens: **PRAGMATIC NEAR-TERM EXECUTION** — emphasise implementation speed, risk reduction, team productivity in the next 6-12 months, and practical integration concerns

The asymmetric lenses ensure structurally different arguments even with identical evidence.

### Step 3: Launch Judge Agent (Sequential)

After both advocates complete:

**Judge Prompt:**

```
Two advocates have argued for competing options in [DECISION].

ADVOCATE FOR [OPTION_A]:
[advocate_a_output]

ADVOCATE FOR [OPTION_B]:
[advocate_b_output]

Produce the final assessment:

1. CRITERION-BY-CRITERION SCORING: For each criterion, score both options 1-5 with
   a 1-sentence justification per score. Show which advocate's argument was more
   convincing for each criterion.

2. ARGUMENT AUDIT: Did either advocate strawman the opposing option? Did either
   make claims unsupported by the evidence? Flag specific instances.

3. WEIGHTED SCORECARD: Multiply each score by weight (High=3, Medium=2, Low=1).
   Show the math. Present the totals.

4. RECOMMENDATION: Choose one option. State it clearly. Do not hedge.

5. DECISION CONDITIONS: "Choose [OPTION_A] if..." and "Choose [OPTION_B] if..."
   — 2-3 conditions each that would tip the decision.

6. OPEN QUESTIONS: What information, if available, could change the recommendation?

[CRITERIA_WITH_WEIGHTS]
```

## Sycophancy Countermeasures

Shared with [Adversarial Debate](adversarial-debate.md). Key adaptations for comparative debate:

1. **Identity priming**: "You spent 6 months researching this option. Your reputation depends on it."
2. **Mandatory attack**: Each advocate must identify 3 risks of the opposing option
3. **Anti-hedge**: "Do NOT hedge with 'both are good options'"
4. **Closing argument**: Forces commitment — 3-sentence summary of strongest case
5. **Judge audit**: Explicitly checks for strawmanning and unsupported claims

## Cost Gating, Evaluation Metrics, Graceful Degradation

See [Adversarial Debate](adversarial-debate.md) — same principles apply. Key difference: adversarial is the **default** for `/evaluate` (the debate IS the skill's value). `--single` is the escape hatch for quick scorecards.

## Skills Using This Pattern

- `/evaluate` — Structured decision evaluation (vendor, architecture, tool, strategy). See `commands/evaluate.md`.
