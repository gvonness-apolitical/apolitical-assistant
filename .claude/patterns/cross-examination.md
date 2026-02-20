# Cross-Examination Pattern

Reusable protocol for targeted evidence challenges after independent analysis. Turns independent assessments into genuine arguments by forcing agents to defend specific claims under scrutiny.

## When to Use

- After independent analysis rounds where agents produced positions with specific claims
- When you need to test whether claims survive targeted questioning
- When the gap between "stated position" and "evidenced position" matters

## Files Involved

- The skill's command file
- [Team Lifecycle](team-lifecycle.md) — team setup and coordination
- [Adversarial Debate](adversarial-debate.md) — shares sycophancy countermeasures
- This pattern file

## Algorithm

### Phase 1: Independent Analysis (Parallel)

Standard single-shot parallel execution. Each analyst produces their assessment independently. This phase is identical to existing subagent patterns — no team features needed.

Output: N independent analyses, each containing specific claims with cited evidence.

### Phase 2: Examiner Produces Questions

The examiner (lead agent or dedicated teammate) reads ALL analyses and produces 2-3 targeted questions per analyst.

**Question Requirements:**

Each question MUST:
1. **Cite a SPECIFIC claim** from the analyst's output (quote the text)
2. **Identify the evidentiary gap or contradiction** — what's missing, what conflicts, or what assumption is unexamined
3. **Be falsifiable** — the analyst should be able to answer with evidence or concede

**Examiner Prompt Template:**

```
You have received independent analyses from [N] analysts on [TOPIC].

For each analyst, produce 2-3 targeted questions. Each question must:
- Quote a specific claim from their analysis
- Identify the evidentiary gap, contradiction, or unexamined assumption
- Be answerable with evidence (not opinion)

Do NOT ask vague questions like "can you elaborate?" or "what about X?"
Every question must target a specific claim and demand specific evidence.

ANALYST OUTPUTS:
[all_analyst_outputs]
```

### Phase 3: Analysts Respond (Parallel)

Each analyst receives their questions via SendMessage and must respond directly.

**Response Requirements:**

For each question, the analyst MUST either:
- **Defend with evidence**: Cite specific data, examples, or reasoning that addresses the gap
- **Concede**: Acknowledge the claim was overstated or unsupported, and revise their position

**Analyst Response Prompt:**

```
You previously produced an analysis on [TOPIC]. The examiner has
identified [N] questions about specific claims in your analysis.

For each question, you MUST either:
(a) DEFEND: Provide specific evidence that addresses the gap. Cite data,
    examples, or logical reasoning. "I believe" is not evidence.
(b) CONCEDE: Acknowledge the claim was overstated or unsupported. State
    how this changes your overall position.

Deflection — restating your position without new evidence — is not
acceptable. If you cannot provide new evidence, concede the point.

Conceding a weak point strengthens your remaining arguments. Defending
every point weakens all of them.

YOUR QUESTIONS:
[examiner_questions_for_this_analyst]

YOUR ORIGINAL ANALYSIS:
[this_analyst_original_output]
```

### Phase 4: Examiner Assessment

The examiner classifies each response and produces the cross-examination record.

**Classification per response:**

| Classification | Criteria |
|---------------|----------|
| **Defended** | New evidence provided that addresses the gap |
| **Conceded** | Analyst acknowledged weakness and revised position |
| **Deflected** | Restated position without new evidence (penalised) |

**Examiner Assessment Prompt:**

```
Review each analyst's responses to the cross-examination questions.

For each response, classify as:
- DEFENDED: Analyst provided new evidence that addresses the gap
- CONCEDED: Analyst acknowledged weakness and revised position
- DEFLECTED: Analyst restated position without providing new evidence

Deflection is the worst outcome — it means the analyst couldn't defend
the claim but wouldn't concede it. Weight deflected claims as weaker
than conceded claims in the final synthesis.

CROSS-EXAMINATION RECORD:
[all_questions_and_responses]
```

## Sycophancy Countermeasures

The primary risk is analysts defending every claim regardless of evidence quality. Countermeasures:

1. **Concession framing**: "Conceding a weak point strengthens your remaining arguments. Defending every point weakens all of them."
2. **Binary choice**: Must defend OR concede — no middle ground like "partially valid"
3. **Deflection penalty**: Examiner explicitly penalises deflection, creating incentive to concede rather than waffle
4. **Evidence standard**: "I believe" and "it seems" are not evidence — specific data or reasoning required

## Output Format

The cross-examination produces a structured Q&A transcript:

```markdown
### Cross-Examination

#### [Analyst Name]

**Q1**: [Examiner question — citing specific claim]
**A1**: [Analyst response]
**Assessment**: Defended / Conceded / Deflected

**Q2**: [Examiner question]
**A2**: [Analyst response]
**Assessment**: Defended / Conceded / Deflected

#### [Next Analyst]
...

### Cross-Examination Summary

| Analyst | Questions | Defended | Conceded | Deflected |
|---------|-----------|----------|----------|-----------|
| [name] | [N] | [N] | [N] | [N] |

**Claims surviving cross-examination** (defended with evidence):
- [claim 1]
- [claim 2]

**Claims revised** (conceded):
- [claim] → [revised position]

**Claims weakened** (deflected — treat with low confidence):
- [claim]
```

## Graceful Degradation

- If examiner fails to produce questions → skip cross-examination, proceed to synthesis with independent analyses only
- If one analyst fails to respond → proceed with available responses; note the gap
- If examiner assessment fails → present raw Q&A transcript without classification

## Skills Using This Pattern

- `/mbr --compete` — Cross-examination of Optimist/Skeptic positions after initial RAG debate
- `/review-rfc deep` — Cross-reference round where domain reviewers examine each other's findings
- `/war-game` — Analyst examines stakeholder positions for leverage points
