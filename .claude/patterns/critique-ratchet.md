# Critique Ratchet Pattern

Draft → Critique → Revise pipeline that iteratively improves output through structured criticism. Invisible to the user — they just get a better output. Based on Stackelberg leader-follower game theory: the Critic's dominant strategy is to find real weaknesses (not nitpick), because the Reviser can dismiss weak critiques with justification.

## When to Use

- Outputs that benefit from revision but where the user doesn't need to choose between alternatives
- Synthesis-heavy outputs where framing, emphasis, or completeness can be improved through challenge
- Activated by `--compete` flag or skill-specific auto-triggers (see Cost Gating)

## Files Involved

- The skill's command file (e.g., `commands/prep-meeting.md`, `commands/executive-report.md`)
- This pattern file
- [Adversarial Debate](adversarial-debate.md) — shares sycophancy countermeasures
- Causantic MCP (for memory feedback)

## Algorithm

### Step 1: Context Gathering (Single Agent)

The skill gathers all context as normal. This data is collected **once** and passed through the pipeline.

### Step 2: Cost Gate Check

Determine whether competitive mode is active:

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Skill-specific auto-trigger (see skill docs) | Yes |
| Default (no flag, no auto-trigger) | No — single-agent |

If competitive mode is not active, return the draft from Step 3 directly and skip remaining steps.

### Step 3: Agent 1 — Draft

The skill produces its normal output. This is the draft that will be critiqued. No changes to the existing skill logic — the draft agent runs exactly as it would in single-agent mode.

### Step 4: Agent 2 — Critique (Sycophancy-Hardened)

Launch a Task agent that receives the draft and produces exactly 3 critiques. Sycophancy countermeasures from the [Adversarial Debate](adversarial-debate.md) pattern apply here.

**Critic Prompt Template:**

```
Review the following output and identify exactly 3 weaknesses. For each:
1. Cite specific text from the output
2. Explain why it's a weakness (missing context, wrong emphasis, unsupported claim, etc.)
3. Suggest a concrete fix

Do NOT list strengths. Do NOT soften with "this is mostly good but". Your only
job is to find the 3 biggest problems. If you cannot find 3 genuine problems,
you are not looking hard enough.

OUTPUT TO CRITIQUE:
[draft_output]
```

The structural forcing (exactly 3, with evidence) prevents the critic from producing vague or sycophantic feedback.

### Step 5: Agent 3 — Revise

Launch a Task agent that receives both the original draft and the 3 critiques, and produces a revised version.

**Reviser Prompt Template:**

```
Below is an output and 3 critiques of it. For each critique, either:
(a) Fix the issue in the revised output, OR
(b) Write a 1-sentence justification for why the original text should stand as-is

Then produce the complete revised output incorporating your fixes.

ORIGINAL OUTPUT:
[draft_output]

CRITIQUES:
[critic_output]
```

The Reviser has the authority to reject weak critiques — this creates the Stackelberg dynamic where the Critic must produce genuine issues to survive revision.

### Step 6: Return Revised Output

The user receives Agent 3's revised output as the final result. The critique/revision process is **invisible** — the user just gets a better output than the single-agent draft would have produced.

### Step 7: Emit Causantic Event

After completion, emit a structured summary:

```
[compete-ratchet: skill=SKILL_NAME, critiques_addressed=N, critiques_justified=N, context=BRIEF_DESCRIPTION]
```

This tracks how many critiques led to actual changes vs were rejected — over time revealing whether the Critic is producing valuable feedback.

## Sycophancy Countermeasures

The Critic role must be hardened against LLM defaults toward agreement:

1. **No strengths**: "Do NOT list strengths. Your only job is to find problems."
2. **Structural forcing**: "Exactly 3 weaknesses. Cite specific text. Suggest a fix."
3. **Anti-softening**: "Do NOT soften with 'mostly good but'. If it's a problem, state it directly."
4. **Accountability**: The Reviser can dismiss weak critiques — so the Critic must produce critiques that survive scrutiny.

See [Adversarial Debate](adversarial-debate.md) for the full sycophancy countermeasure framework.

## Cost Gating

The ratchet adds ~2x token cost (critique + revision on top of the draft). Auto-enable only when worth it:

| Trigger | Action |
|---------|--------|
| `--compete` flag | Always enable |
| `--single` flag | Always disable |
| Meeting with exec or board | Auto-enable for `prep-meeting` |
| Report covering >2 weeks | Auto-enable for `executive-report` |
| Team showing RED health indicators | Auto-enable for `team-status` |
| Default (no trigger) | Single-agent |

Skills define their own auto-trigger rules within their command files.

## Evaluation Metrics

Track critique quality to calibrate whether the ratchet is improving output:

- **Fix rate**: What fraction of critiques lead to actual changes (addressed) vs rejections (justified)? If the fix rate drops below 30% consistently, the Critic isn't finding real issues.
- **User edit distance**: How much does the user edit ratcheted output vs single-agent? Less editing = the ratchet is working.
- **Critique survival**: Do certain types of critique (missing context, wrong emphasis, unsupported claims) consistently survive revision? Track by category.

**Storage**: Emit structured Causantic events:

```
[compete-eval: skill=SKILL_NAME, pattern=ratchet, critiques_addressed=N, critiques_justified=N, edit_distance=low|medium|high]
```

**Threshold**: If the fix rate is below 30% for 5+ consecutive runs, the ratchet isn't adding value for that skill — flag for review or adjust the Critic prompt.

## Graceful Degradation

- If Agent 2 (Critic) fails → return Agent 1's draft (user gets single-agent quality)
- If Agent 3 (Reviser) fails → return Agent 1's draft with Agent 2's critiques appended as notes (user can manually address)
- If Causantic is unavailable → skip the memory event; everything else works

## Skills Using This Pattern

- `/prep-meeting` — Talking points and suggested questions pressure-tested through critique. Auto-triggers for exec/leadership meetings (title keyword match). Critique targets Talking Points section specifically — factual sections pass through unchanged.
- `/executive-report` — Synthesis framing (Highlights/Lowlights, Teams & Focus Areas, Outlook) pressure-tested through critique. Auto-triggers when report covers >2 weeks. Factual data (PR counts, ticket numbers) passes through unchanged.
- `/team-status` — Health assessment and recommendations challenged through critique. Auto-triggers when blocked ticket count >= 3 or burndown is "behind"/"at risk". Factual data tables pass through unchanged.
