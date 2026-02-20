# Competitive Draft Pattern

Two agents produce the same output from different seed prompts; user selects the better draft or merges elements from both. Based on tournament selection from evolutionary algorithms — sampling twice from the output distribution and selecting the better sample improves expected quality. Different seed prompts explore different regions of the quality space.

## When to Use

- Creative or strategic output where tone, framing, or emphasis vary legitimately
- Situations where the user benefits from seeing alternatives before committing
- Activated by `--compete` flag or skill-specific auto-triggers (see Cost Gating)

## Files Involved

- The skill's command file (e.g., `commands/respond-to.md`, `commands/draft-email.md`)
- This pattern file
- Causantic MCP (for memory feedback)

## Algorithm

### Step 1: Context Gathering (Single Agent)

The skill gathers all context as normal — recipient dossier, thread history, related documents. This data is collected **once** and shared with both agents.

### Step 2: Cost Gate Check

Determine whether competitive mode is active:

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Skill-specific auto-trigger (see skill docs) | Yes |
| Default (no flag, no auto-trigger) | No — single-agent |

If competitive mode is not active, fall back to single-agent execution and skip remaining steps.

### Step 3: Launch Agent A with Seed 1 (Parallel)

Launch a Task agent with the gathered context plus Seed 1 framing. The seed biases the agent toward a particular tone, emphasis, or strategic approach.

### Step 4: Launch Agent B with Seed 2 (Parallel)

Launch a Task agent with the gathered context plus Seed 2 framing. The seed explores a different region of the output space.

Steps 3 and 4 run as **parallel** Task agents.

### Step 5: Present Both Outputs

Show both drafts to the user with a brief comparison note highlighting key differences:

**Output Format:**

```markdown
## Draft A — [Seed 1 Label]
[Full draft]

---

## Draft B — [Seed 2 Label]
[Full draft]

---

### Key Differences
- **Tone**: Draft A is [X], Draft B is [Y]
- **Emphasis**: Draft A leads with [X], Draft B leads with [Y]
- **Length**: Draft A is [shorter/longer] by ~N words

Which draft do you prefer? I can also merge elements from both.
```

### Step 6: User Selection

The user selects one draft, requests a merge, or asks for a new seed. If merging, produce a combined draft incorporating the user's specified elements from each.

### Step 7: Emit Causantic Event

After selection, emit a structured summary:

```
[compete-draft: skill=SKILL_NAME, seed_a=SEED_LABEL, seed_b=SEED_LABEL, user_chose=a|b|merge, context=BRIEF_DESCRIPTION]
```

## Seed Strategy

Each skill defines its own seed pairs that explore meaningfully different output regions. Seeds should represent legitimate strategic alternatives, not trivial variations.

### Skill-Specific Seeds

**`/respond-to`** and **`/draft-email`**:
| Seed A | Seed B |
|--------|--------|
| "Prioritise directness and clarity — get to the point, be explicit about asks" | "Prioritise diplomacy and relationship — soften edges, acknowledge their perspective first" |

**`/review-doc`**:
| Seed A | Seed B |
|--------|--------|
| "Prioritise technical depth — flag precision issues, structural gaps, logical inconsistencies" | "Prioritise accessibility — flag jargon, unclear value propositions, missing audience context" |

**`/summarise`**:
| Seed A | Seed B |
|--------|--------|
| "Executive brevity — 3-5 bullet points, decisions and actions only" | "Comprehensive detail — preserve nuance, capture reasoning, include context" |

### Designing Good Seeds

Seeds should:
- Represent **genuinely different strategic choices**, not minor phrasing variations
- Be **equally valid** — neither seed should be obviously inferior
- Map to **user-recognisable trade-offs** (directness vs diplomacy, brevity vs depth)
- Be **short and clear** — the seed is a framing instruction, not a full prompt

## Cost Gating

Competition doubles token cost. Auto-enable only when worth it:

| Trigger | Action |
|---------|--------|
| `--compete` flag | Always enable |
| `--single` flag | Always disable |
| Email/response to exec or manager | Auto-enable for `respond-to`/`draft-email` |
| Document from senior stakeholder | Auto-enable for `review-doc` |
| Default (no trigger) | Single-agent |

Skills define their own auto-trigger rules within their command files.

## Evaluation Metrics

Track which seeds users consistently prefer to calibrate seed quality:

- **Seed preference**: Over N runs, which seed does the user pick more often? If one seed wins >80% of the time, it's dominant — drop the losing seed and try a new one.
- **Merge frequency**: How often does the user merge instead of picking one? High merge rate suggests the seeds are exploring useful different dimensions.
- **Edit distance**: How much does the user edit the chosen draft? Low editing = the seed was well-calibrated.

**Storage**: Emit structured Causantic events:

```
[compete-eval: skill=SKILL_NAME, seed_a=LABEL, seed_b=LABEL, chose=a|b|merge, edit_distance=low|medium|high]
```

## Graceful Degradation

- If one agent fails → present the surviving draft as a single-agent output (no choice needed)
- If both agents fail → fall back to standard single-agent execution
- If Causantic is unavailable → skip the memory event; everything else works

## Skills Using This Pattern

- `/respond-to` — Directness vs diplomacy seeds for email/Slack response drafting. Auto-triggers when dossier has non-empty `profile.sensitivities`. Scoped to email and Slack only (PR/Linear responses use single-agent). Dossier context informs both seeds.
- `/draft-email` — Directness vs diplomacy seeds for email drafting. Auto-triggers when dossier has non-empty `profile.sensitivities`. Dossier context informs both seeds.
- `/review-doc` — Technical depth vs accessibility seeds for document review. No auto-triggers — user opts in with `--compete`. Both agents receive document content and architecture context.
- `/summarise` — Executive brevity vs comprehensive detail seeds for summaries. No auto-triggers — user opts in with `--compete`. Both agents receive source content as pre-gathered context.
