# Review RFC

Perform a comprehensive technical review of an RFC in Notion, providing structured feedback as comments.

## Core Patterns Used
- [Adversarial Debate](../patterns/adversarial-debate.md) - Competitive review mode
- [Team Lifecycle](../patterns/team-lifecycle.md) - Agent team setup, coordination, and cleanup
- [Cross-Examination](../patterns/cross-examination.md) - Cross-reference round for specialised reviewers
- [Dossier Context](../patterns/dossier-context.md) - Reviewer voice calibration from professional dossier

## Usage
- `/review-rfc [notion-url]` - standard review of the RFC
- `/review-rfc [notion-url] quick` - high-level structural feedback only
- `/review-rfc [notion-url] deep` - comprehensive review with specialised team (security + architecture + operations)
- `/review-rfc [notion-url] deep --adversarial` - deep review with advocate/challenger (force adversarial instead of specialised)
- `/review-rfc [rfc-title]` - search for and review an RFC by title
- `/review-rfc [notion-url] --compete` - force competitive mode (Advocate vs Challenger) at any depth
- `/review-rfc [notion-url] --single` - force single-agent mode (override auto-enable)
- `/review-rfc [notion-url] --resume` - resume from last completed step if previous run was interrupted

## Review Depth

| Depth | Focus | Time Equivalent |
|-------|-------|-----------------|
| **quick** | High-level structure, obvious concerns, key questions | ~15 min |
| **standard** | All evaluation areas, thorough but focused | ~45 min |
| **deep** | Comprehensive analysis, code examples, alternatives | ~2 hours |

**Note**: `deep` auto-enables competitive mode. Use `--single` to override. `standard --compete` is valid (competitive at standard depth).

---

## Competitive Review Mode

References: [Adversarial Debate](../patterns/adversarial-debate.md) pattern

### Activation

| Trigger | Mode |
|---------|------|
| `deep` (default) | Specialised team (3 domain reviewers) — if team prerequisites met |
| `deep --adversarial` | Force advocate/challenger for deep (adversarial debate, not specialised) |
| `deep` + team prerequisites fail | Falls back to advocate/challenger (adversarial debate) |
| `--compete` flag (non-deep) | Adversarial debate (advocate/challenger) |
| `--single` flag | No competition (override auto) |
| RFC tagged "architecture" or "infrastructure" | Auto-enable adversarial debate for standard depth |
| RFC author is senior/principal+ | Auto-enable adversarial debate for standard depth |
| Default (standard, no flags) | No competition (single-agent) |

### How It Works — Adversarial Debate (Advocate/Challenger)

Used for `--compete` flag, `deep --adversarial`, auto-triggers, or as fallback when team prerequisites fail.

**Phase 1: Context Gathering** (unchanged)
Steps 1-4 execute as normal — fetch RFC, architecture context, technical context, industry research. Data collected once, shared with both agents.

**Phase 2: Adversarial Debate**

Launch two parallel Task agents:

**Advocate Agent**: Reviews with a bias toward approval. Presents the strongest case the RFC is well-designed. Must flag genuine blockers but frames them as addressable. Uses the 7 evaluation areas and RFC-type framework.

**Challenger Agent** (sycophancy-hardened): Reviews with a bias toward revision. Identity: senior staff engineer, 50+ RFCs seen fail in production. Must produce exactly 5 concerns ranked by severity, each with:
- Specific RFC text cited
- Concrete production risk
- Specific suggested fix

No softening language. No "minor nitpick" hedging.

Both agents receive identical context: RFC content, architecture docs, related code, related RFCs, industry research.

**Phase 3: Judge Synthesis**

Sequential agent receives both outputs and:
1. Identifies which Advocate arguments survived the Challenger
2. Identifies which Challenger concerns the Advocate failed to address
3. Scores each concern 1-5 (genuine issue vs stretch)
4. Evaluates whether the Challenger pulled punches
5. Produces final review in standard output format
6. Marks agreement zones (high confidence) vs contested zones
7. Extracts 2-3 **key themes** — specific arguments that survived the debate and should be emphasised in the structured review (Blocking Concerns, Recommendations sections)

---

### How It Works — Specialised Team (Deep Mode Default)

Used for `deep` mode when team prerequisites are met. Replaces the binary advocate/challenger with domain-specialised reviewers. Follow [Team Lifecycle](../patterns/team-lifecycle.md) and [Cross-Examination](../patterns/cross-examination.md) patterns.

**Prerequisites Check:**
```
1. Check env var CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
2. Read settings.json → agentTeams.enabled
3. Confirm not already in a team context
→ If ANY fails: fall back to adversarial debate (advocate/challenger)
```

**Team Structure:**
- **Lead**: Coordinator + final synthesis
- `security-reviewer`: Security, auth, data privacy, input validation, OWASP concerns
- `architecture-reviewer`: Design patterns, coupling, cohesion, scalability, FP/DDD alignment
- `operations-reviewer`: Deployment, monitoring, cost, incident response, operational complexity

**Round 1 — Independent Review (Parallel):**

Spawn all three reviewers as teammates:

```
Task (parallel):
  team_name: "review-rfc-{timestamp}"
  name: "security-reviewer"
  subagent_type: "general-purpose"
  prompt: |
    You are reviewing an RFC from a SECURITY perspective.

    Your domain checklist:
    - AuthN/AuthZ implications
    - Sensitive data handling and exposure
    - Input validation and injection risks
    - GDPR/data retention compliance
    - Secrets management
    - API security (rate limiting, CORS, token handling)

    RFC CONTENT: [rfc_content]
    ARCHITECTURE CONTEXT: [architecture_docs]
    RELATED RFCs: [related_rfcs]

    Produce 3-5 findings ranked by severity. For each:
    - Cite specific text from the RFC
    - Describe the concrete risk
    - Suggest a specific fix
    - Rate severity: Critical / High / Medium / Low

    Do NOT soften findings. An RFC with zero security concerns doesn't exist.
    If a concern is "probably fine", you are not looking hard enough.

Task (parallel):
  team_name: "review-rfc-{timestamp}"
  name: "architecture-reviewer"
  subagent_type: "general-purpose"
  prompt: |
    You are reviewing an RFC from an ARCHITECTURE perspective.

    Your domain checklist:
    - Follows established architectural patterns (FP, clean architecture)?
    - Appropriate scope and boundaries?
    - Coupling between services minimised?
    - Failure modes and edge cases handled?
    - Domain logic separated from infrastructure?
    - Schema evolution strategy?
    - Backwards compatibility?

    RFC CONTENT: [rfc_content]
    ARCHITECTURE CONTEXT: [architecture_docs]
    RELATED RFCs: [related_rfcs]

    Produce 3-5 findings ranked by severity. [same format as security]

Task (parallel):
  team_name: "review-rfc-{timestamp}"
  name: "operations-reviewer"
  subagent_type: "general-purpose"
  prompt: |
    You are reviewing an RFC from an OPERATIONS perspective.

    Your domain checklist:
    - Deployment strategy and rollback capability
    - Monitoring, alerting, and observability
    - Cost implications (compute, storage, network)
    - Incident response impact
    - Operational complexity (on-call burden)
    - Performance and scalability under load
    - Data migration and rollout plan

    RFC CONTENT: [rfc_content]
    ARCHITECTURE CONTEXT: [architecture_docs]
    RELATED RFCs: [related_rfcs]

    Produce 3-5 findings ranked by severity. [same format as security]
```

All three receive identical context. Sycophancy countermeasures applied to all.

**Round 2 — Cross-Reference (Parallel, NEW):**

Send each reviewer the other two reviewers' findings via SendMessage:

```
SendMessage:
  type: "message"
  recipient: "security-reviewer"
  content: |
    Two other domain reviewers have produced their findings:

    ARCHITECTURE REVIEW:
    [architecture_reviewer_output]

    OPERATIONS REVIEW:
    [operations_reviewer_output]

    Review their findings through your security lens:
    1. Does any finding from another domain change YOUR assessment?
       (e.g., an architecture decision that creates a security risk)
    2. Are there CROSS-CUTTING concerns that span multiple domains?
       (e.g., a deployment strategy that affects both security and ops)
    3. Do any of their findings interact with yours in ways that
       increase or decrease severity?

    Produce a revised assessment incorporating cross-domain insights.
    Note which findings are YOURS ALONE vs CROSS-CUTTING (2+ domains).
  summary: "Round 2: Cross-reference with other domain reviews"
```

Same message structure sent to all three reviewers (each receives the other two). Wait for all responses.

**Round 3 — Judge Synthesis:**

Spawn a **separate `judge` teammate** (not lead-as-judge — complex synthesis across 3 domains):

```
Task:
  team_name: "review-rfc-{timestamp}"
  name: "judge"
  subagent_type: "general-purpose"
  prompt: |
    Three domain-specialised reviewers have independently reviewed an RFC
    and then cross-referenced each other's findings:

    SECURITY — Initial: [security_r1] | Cross-Referenced: [security_r2]
    ARCHITECTURE — Initial: [architecture_r1] | Cross-Referenced: [architecture_r2]
    OPERATIONS — Initial: [operations_r1] | Cross-Referenced: [operations_r2]

    Produce the final review synthesis:

    1. CROSS-CUTTING CONCERNS (highest priority):
       Concerns flagged by 2+ reviewers. For each:
       - The concern
       - Which domains flagged it
       - Combined severity (higher when cross-cutting)
       - Interaction effects between domains

    2. DOMAIN-SPECIFIC FINDINGS:
       Findings from a single domain, organised by severity.
       Note if the cross-reference round changed any severity ratings.

    3. ARGUMENT QUALITY AUDIT:
       - Did any reviewer produce generic concerns vs RFC-specific ones?
       - Did the cross-reference round surface genuine interactions?
       - Rate each reviewer's contribution quality 1-5.

    4. FINAL ASSESSMENT:
       - Is this RFC ready to proceed, needs targeted fixes, or needs rethink?
       - Top 3 blocking concerns (if any)
       - Top 3 recommendations
       - Key questions for the RFC author
```

**Shutdown & Cleanup:**
```
try:
  [Rounds 1-3 above]
finally:
  SendMessage shutdown_request to security-reviewer, architecture-reviewer, operations-reviewer, judge
  TeamDelete "review-rfc-{timestamp}"
```

### Specialised Team Output Format

```markdown
[Standard review header and metadata]

**Review Mode**: Specialised team (security + architecture + operations)

### Cross-Cutting Concerns

| Concern | Flagged By | Severity | Interaction Effect |
|---------|-----------|----------|-------------------|
| [concern] | Security, Operations | High | [how domains interact] |

### Security Review
[Security reviewer findings — initial + cross-referenced]

### Architecture Review
[Architecture reviewer findings — initial + cross-referenced]

### Operations Review
[Operations reviewer findings — initial + cross-referenced]

### Judge Synthesis
[Assessment quality audit, final verdict, blocking concerns, recommendations]

**Agreement zones** (all reviewers align): ...
**Contested zones** (reviewers disagree on severity): ...

[Standard review sections continue: Questions, Minor Suggestions, What Works Well, Industry Context]
```

### Output Format (Competitive Mode)

When competitive mode is active, the output includes the full debate:

```markdown
[Standard review header and metadata]

#### Advocate Position
[Full advocate review]

#### Challenger Position
[Full challenger review — 5 ranked concerns]

#### Judge Synthesis
[Analysis of which arguments won]

**Key themes for review:**
1. [theme — e.g., "identity linking is a schema decision that must precede Phase 1"]
2. [theme]
3. [theme]

**Agreement zones** (high confidence): ...
**Contested zones** (flag for RFC author): ...

[Standard review sections continue: detailed feedback, anti-patterns, etc.]
```

### Causantic Memory

After each competitive review, emit:

```
[compete-result: skill=review-rfc, artifact=RFC_TITLE, disagreements=N, resolution=SUMMARY, sided_with=challenger:N/advocate:N]
```

---

## Checkpointing

References: [Checkpointing](../patterns/checkpointing.md) pattern

This skill uses **3 checkpoints** at natural transitions. Progress is tracked in `context/YYYY-MM-DD/index.md`. Resume with `--resume`.

| Checkpoint | After Step | What's Saved |
|-----------|-----------|--------------|
| Step 4: Context Gathered | 4. Research Industry Context | RFC content, architecture docs, related RFCs, industry sources |
| Step 6: Feedback Structured | 6. Structure Feedback | Planned inline comments with targets and categories |
| Step 7: Comments Posted | 7. Post Inline Comments | Posted/edited/skipped counts |

**CP at Step 6 is the most valuable** — it preserves the full analysis so posting can restart without re-evaluation.

### Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Fetch RFC | notion-fetch | Never |
| 2. Architecture Context | Read (tech-notes/architecture.md) | If file missing |
| 3. Technical Context | GitHub search, notion-search | Per source on failure |
| 4. Industry Research | WebSearch/WebFetch | --quick |
| 5. Evaluate | Task agents (competitive) or inline (single) | Never |
| 6. Structure Feedback | Read (dossiers.json) | Never |
| 7. Post Inline Comments | notion-create-comment ×N (interactive) | Never |
| 7b. Post Summary Comment | notion-create-comment ×1 | Never |
| 7c. Save Local Copy | Write | Never |
| 8. Provide Summary | — (output only) | Never |

---

## Process

### 1. Fetch & Understand the RFC
- Use `notion-fetch` to get the full RFC content
- Identify RFC type: API design, data model, infrastructure, feature, process
- Note author, status, and any existing comments
- Read any linked documents or references

### 2. Load Architecture Context

**Reference Document**: Read `tech-notes/architecture.md` for:
- Core architectural principles and philosophy
- Established patterns and conventions
- Anti-patterns to flag
- Tech stack context

### 3. Gather Technical Context

**From GitHub:**
- Search for related code in affected repositories
- Understand existing patterns and conventions in the codebase
- Check recent PRs in affected areas
- Review related issues or technical debt

**From Notion** (load `.claude/notion-sources.json` for priority sources):
- **RFCs database**: Search for related RFCs and architecture decision records
  - Page ID: `090aa88ff28d43cb9d1ddeeb91ce0cc6`
  - Check for RFCs with similar scope, referenced systems, or by same author
- **PRDs**: Related product specs that inform requirements
- Find existing documentation on affected systems
- Check for relevant technical guidelines

### 4. Research Industry Context

Search these sources for relevant patterns and perspectives:
- **Hacker News**: `site:news.ycombinator.com [relevant terms]`
- **TechCrunch**: `site:techcrunch.com [relevant terms]`
- **Slashdot**: `site:slashdot.org [relevant terms]`
- **Web search**: General search for case studies, best practices, cautionary tales

Focus on:
- How others have solved similar problems
- Emerging patterns or technologies worth considering
- Known pitfalls or anti-patterns to avoid
- Industry direction and future-proofing considerations

```
✓ CHECKPOINT: Step 4 complete - Context Gathered
  RFC: [title] by [author] | Status: [status] | Type: [type]
  Architecture docs: [loaded/not found] | Related RFCs: [N] | Industry sources: [N]
  Tools: notion-fetch ×1, Read ×1, notion-search ×[N], github_search_code ×[N], WebSearch ×[N]

Proceeding to Step 5: Evaluate
```

### 5. Evaluate (Single-Agent, Adversarial, or Specialised Team)

**Check mode activation** (see Competitive Review Mode section above):
- If `deep` depth + team prerequisites met (and not `--adversarial`) → run Specialised Team
- If `deep` depth + `--adversarial` flag → run Adversarial Debate
- If `deep` depth + team prerequisites fail → fall back to Adversarial Debate
- If `--compete` flag or auto-trigger matches → run Adversarial Debate
- If `--single` flag or no trigger → run single-agent evaluation

**Single-agent path**: Evaluate the RFC against all relevant areas from the Evaluation Framework below. Produce the review directly.

**Adversarial path**: Follow the Adversarial Debate pattern:
1. Launch **Advocate** and **Challenger** Task agents in parallel, both receiving identical context from steps 1-4
2. Wait for both to complete
3. Launch **Judge** Task agent with both outputs
4. Format output with full debate transparency (see Competitive Review Mode output format)
5. Emit Causantic event

**Specialised team path**: Follow the Specialised Team protocol:
1. Prerequisites check → TeamCreate
2. Round 1: Spawn security, architecture, operations reviewers (parallel)
3. Round 2: Cross-reference — each reviewer receives others' findings (parallel)
4. Round 3: Separate judge teammate synthesises with cross-cutting priority
5. Shutdown + TeamDelete
6. Format output with specialised team output format
7. Emit Causantic event

Fallback chain: specialised team → adversarial debate → single-agent.

### 6. Structure Feedback

Using the evaluation output (from either single-agent or Judge synthesis), structure the feedback into two tiers:

1. **Inline comments** — targeted feedback anchored to specific RFC content
2. **Summary comment** — page-level overview tying the review together

If competitive mode was used, the Judge's **key themes** should guide which concerns lead the Blocking Concerns and Recommendations sections — these are the arguments that survived adversarial scrutiny and carry highest confidence.

#### Inline Comment Planning

For each concern, recommendation, or question, identify the specific RFC text it relates to. Map each piece of feedback to a `selection_with_ellipsis` target:

```
Feedback Item → RFC Section/Text → selection_with_ellipsis
"OpenAI vs Vertex" → "sends it all to OpenAI for analysis" → "sends it all...for analysis"
"Log sanitisation" → "kubectl logs <failing-pod>" → "kubectl logs...all-containers"
```

**Rules for inline comments:**
- Each inline comment should be self-contained — a reader should understand the concern without needing the summary
- Use the format: **[Category]**: [Feedback]. Categories: `Blocking`, `Recommendation`, `Question`, `Suggestion`, `Positive`
- Keep inline comments concise (1-3 sentences + suggestion if applicable)
- Group related feedback into a single inline comment if they target the same text
- If the `selection_with_ellipsis` target isn't unique enough, expand the snippet to include more context

```
✓ CHECKPOINT: Step 6 complete - Feedback Structured
  Planned comments: [N] (Blocking: [N], Recommendation: [N], Question: [N], Suggestion: [N], Positive: [N])
  Mode: [single-agent / adversarial / specialised team]
  Tools: Read ×1 (dossiers.json)

Proceeding to Step 7: Post Inline Comments
```

### 7. Post Inline Comments to Notion (Interactive)

Present each inline comment to the user **one at a time** for approval before posting. This ensures the reviewer controls exactly what goes on the RFC.

**Ordering**: Present blocking concerns first, then recommendations, then questions, then suggestions, then positive feedback.

For each comment, display:

```
Comment [N/total] — [Category]

Target: "[selection_with_ellipsis snippet]"

> [Category]: [feedback text]

[Send] [Edit] [Skip]
```

- **Send**: Post as-is via `notion-create-comment`
- **Edit**: User provides revised text, then post the edited version
- **Skip**: Do not post this comment (still include in local copy)

```
On Send or Edit:
  notion-create-comment(
    page_id: RFC_PAGE_ID,
    selection_with_ellipsis: "start of text...end of text",
    rich_text: [{ text: { content: "[Category]: feedback text" } }]
  )
```

After all comments are reviewed, show a summary: `Posted: N | Edited: N | Skipped: N`

**Error handling**: If a `selection_with_ellipsis` fails to match (content changed, or snippet not unique), fall back to a page-level comment for that item and note the intended target in the comment text.

```
✓ CHECKPOINT: Step 7 complete - Comments Posted
  Posted: [N] | Edited: [N] | Skipped: [N] | Fallback (page-level): [N]
  Tools: notion-create-comment ×[N]

Proceeding to Step 7b: Post Summary Comment
```

### 7b. Post Summary Comment to Notion

After all inline comments are posted, post a single **page-level summary comment** that ties the review together.

**NOTE**: Notion inline comments (with `selection_with_ellipsis`) render as plain text only. However, page-level summary comments DO support `rich_text` annotations (bold, italic, etc.).

**Template** — use `rich_text` segments with `annotations: { bold: true }` for section headers and labels:

```json
[
  { "text": { "content": "Technical Review Summary\n\n" }, "annotations": { "bold": true } },
  { "text": { "content": "Outcome: " }, "annotations": { "bold": true } },
  { "text": { "content": "[Accept | Accept with Changes | Revise and Resubmit | Reject]\n" } },
  { "text": { "content": "Depth: " }, "annotations": { "bold": true } },
  { "text": { "content": "[quick/standard/deep] | " } },
  { "text": { "content": "Type: " }, "annotations": { "bold": true } },
  { "text": { "content": "[infrastructure/api/etc.] | " } },
  { "text": { "content": "Inline comments: " }, "annotations": { "bold": true } },
  { "text": { "content": "[N]\n\n" } },
  { "text": { "content": "Overall Assessment\n" }, "annotations": { "bold": true } },
  { "text": { "content": "[2-3 sentence assessment]\n\n" } },
  { "text": { "content": "Blocking Concerns ([N])\n" }, "annotations": { "bold": true } },
  { "text": { "content": "1. [Concern title] — see inline comment on \"[section]\"\n\n" } },
  { "text": { "content": "Recommendations ([N])\n" }, "annotations": { "bold": true } },
  { "text": { "content": "1. [Recommendation title] — see inline comment on \"[section]\"\n\n" } },
  { "text": { "content": "Questions ([N])\n" }, "annotations": { "bold": true } },
  { "text": { "content": "1. [Question] — see inline comment on \"[section]\"\n\n" } },
  { "text": { "content": "What Works Well\n" }, "annotations": { "bold": true } },
  { "text": { "content": "- [Brief positive feedback]\n\n" } },
  { "text": { "content": "Industry Context\n" }, "annotations": { "bold": true } },
  { "text": { "content": "[Relevant patterns or tools from research]" } }
]
```

**Implementation**: Build the `rich_text` array with multiple segments. Use `annotations: { bold: true }` for section headers and labels. Keep content in each segment under 2000 chars.

The summary is intentionally lighter than the inline comments — it serves as an index, not a repeat. The inline comments are the primary record.

### 7c. Save Local Copy

Save the full review locally to `work/YYYY-MM-DD-rfc-review-[slug].md` for future reference (Causantic recall, revision tracking). The slug is derived from the RFC title (lowercase, hyphens, truncated to ~40 chars).

**Frontmatter:**
```yaml
---
type: work
subtype: rfc-review
date: YYYY-MM-DD
tags: [rfc-review]
related:
  - [notion URL of RFC]
status: final
---
```

**Content includes:**
- Standard review header and metadata
- All inline comments with their targets (for local reference)
- Summary comment content
- If competitive mode was active: full Advocate position, Challenger position, Judge synthesis with key themes, agreement/contested zones

The local copy preserves the complete review context including the adversarial debate (if applicable) for future runs on related RFCs.

### 8. Provide Summary

```
# RFC Review Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Fetch RFC        ✓ 2. Architecture    ✓ 3. Technical Context
✓ 4. Industry Research ✓ 5. Evaluate        ✓ 6. Structure Feedback
✓ 7. Post Comments     ✓ 7b. Summary        ✓ 7c. Local Copy
✓ 8. Summary

## Key Results
- **RFC**: [title] by [author]
- **Outcome**: [Accept / Accept with Changes / Revise and Resubmit / Reject]
- **Comments**: Posted [N] | Edited [N] | Skipped [N]
- **Blocking concerns**: [N]
- **Mode**: [single-agent / adversarial / specialised team]

## Saved to
work/YYYY-MM-DD-rfc-review-[slug].md

---
RFC review complete.
```

Display to the user:
- Link to RFC
- Key concerns summary (1-2 sentences)
- Recommended next steps
- Offer to discuss any complex feedback

---

## Evaluation Framework

### By RFC Type

**API Design RFC**
- Contract clarity and completeness
- Versioning and backwards compatibility
- Error handling and status codes
- Authentication/authorization
- Rate limiting and quotas
- Documentation quality

**Data Model RFC**
- Normalisation appropriateness
- Type precision (avoiding primitive obsession)
- Schema evolution strategy
- Referential integrity
- Query patterns and indexing
- Privacy and data retention

**Infrastructure RFC**
- Operational complexity
- Cost implications
- Security posture
- Monitoring and observability
- Disaster recovery
- Blast radius of failures

**Feature RFC**
- User impact and value
- Testing strategy
- Rollout plan (feature flags, gradual rollout)
- Rollback capability
- Analytics and success metrics

---

### Core Evaluation Areas

#### 1. Architecture & Design
- [ ] Follows established architectural patterns?
- [ ] Appropriate scope (not too big, not fragmented)?
- [ ] Clear boundaries and interfaces?
- [ ] Failure modes and edge cases handled?
- [ ] Backwards compatible where needed?

**FP & Clean Architecture Lens:**
- Is domain logic separated from infrastructure?
- Are side effects pushed to the edges?
- Can components be composed and tested independently?
- Are dependencies explicit and pointing inward?

#### 2. Microservice Considerations
- [ ] Minimises coupling between services?
- [ ] Maximises cohesion within the service?
- [ ] Avoids distributed monolith patterns?
- [ ] Clear bounded context ownership?

**Questions to ask:**
- Could this service be deployed independently?
- What would break if this service was down?
- Is there a synchronous call chain that could be async?

#### 3. Communication Patterns
- [ ] Appropriate sync vs async choices?
- [ ] Eventual consistency handled correctly?
- [ ] Idempotency designed in?
- [ ] Causal ordering considered where needed?

**Deep dive areas (your expertise):**
- Event-driven architecture patterns
- Saga/compensation patterns for distributed transactions
- Outbox pattern for reliable publishing
- Consistency guarantees documented

#### 4. Data Modelling & Types
- [ ] Well-normalised and consistent model?
- [ ] Types are precise and meaningful?
- [ ] Validation at boundaries?
- [ ] Schema evolution strategy?
- [ ] No primitive obsession?

**Type system questions:**
- Are domain concepts represented as distinct types (not strings/ints)?
- Are illegal states representable?
- Is nullability explicit and intentional?

#### 5. Code Quality Signals
- [ ] Solution favours readability?
- [ ] Single responsibility maintained?
- [ ] Appropriately simple (YAGNI)?
- [ ] Easily testable?
- [ ] Debuggable in production?

#### 6. Operational Concerns
- [ ] Monitoring and alerting considered?
- [ ] Deployment strategy clear?
- [ ] Incident response impact?
- [ ] Rollback options?
- [ ] Cost implications understood?

#### 7. Security & Privacy
- [ ] AuthN/AuthZ implications addressed?
- [ ] Sensitive data handling appropriate?
- [ ] Input validation sufficient?
- [ ] GDPR/data retention considered?

---

### Anti-Pattern Detection

Flag if you see signs of:

| Anti-Pattern | Warning Signs |
|--------------|---------------|
| **Over-engineering** | Abstractions without current need, "future-proof" complexity |
| **Premature optimisation** | Performance claims without benchmarks, complex caching upfront |
| **Impractical design** | Requires perfect conditions, no failure handling |
| **Large unknowns** | Novel tech without POC, hand-wavy estimates |
| **Bleeding edge deps** | New libraries (<1yr), few contributors, limited adoption |
| **Distributed monolith** | Sync chains, shared DBs, coordinated deploys |

---

## Output Format

### Inline Comment Format

Each inline comment posted via `notion-create-comment` with `selection_with_ellipsis`:

```
[Category]: [Concise feedback]. [Suggestion if applicable].
```

**Categories and formatting:**

| Category | When to Use | Example |
|----------|-------------|---------|
| **Blocking** | Must fix before approval | `Blocking: Pod logs may contain secrets leaked on startup. These are sent to OpenAI without sanitisation. Add a log scrubbing step or document the risk.` |
| **Recommendation** | Significant improvement | `Recommendation: Consider using Vertex/Gemini instead of OpenAI for consistency with existing AI moderation infrastructure.` |
| **Question** | Clarification needed | `Question: What happens if the watcher hangs? Is there a kill timeout to prevent CI runner resource exhaustion?` |
| **Suggestion** | Minor improvement | `Suggestion: The "Immediate Next Steps" section is blank — add tasks, owners, and timeline before moving to Accepted.` |
| **Positive** | Good decision to acknowledge | `Positive: Smart design keeping --atomic untouched. The watcher being purely observational means zero risk to existing deploy behaviour.` |

### Summary Comment Format

Page-level comment posted after all inline comments (see Step 7b for full template). The summary serves as an **index** to the inline comments — it should not repeat feedback verbatim but instead reference the inline comments by section.

### Post-Review Output

After posting, display to the user:
- Confirmation with link to RFC
- Count of inline comments posted by category
- Key concerns summary (1-2 sentences)
- Recommended next steps
- Offer to discuss any complex feedback

---

## Tone Guidelines

### Voice Calibration

Before drafting comments, load the reviewer's dossier from `.claude/dossiers.json` (key: `greg.vonness@apolitical.co`) and align comment voice to their communication style:

- **Acknowledge before pivoting** — lead with what works, then pivot to the concern. "Smart design keeping --atomic untouched. One thing to watch: ..."
- **Name structural problems precisely** — not "this could be better" but "this creates a sync call chain that could cascade"
- **Always pair criticism with a counter-proposal** — never flag an issue without suggesting a fix
- **Em dashes, semicolons, bold for emphasis** — match the reviewer's natural writing style
- **Concise and direct** — no filler, no hedging. If it's blocking, say so plainly
- **Questions as genuine exploration** — "Have you considered X?" when genuinely curious, not as a softened criticism

### General Principles

- **Constructive, not critical** — we're improving the design together
- **Explain the "why"** — rationale helps more than just "don't do X"
- **Offer alternatives** — when flagging issues, suggest solutions
- **Acknowledge trade-offs** — most decisions involve compromise
- **Respect effort** — the author has thought about this
- **Balance** — ensure positive feedback, not just criticism

---

## Review Checklist

Before finalising:

- [ ] Read entire RFC including linked documents
- [ ] Loaded architecture context from `tech-notes/architecture.md`
- [ ] Checked GitHub for related code/patterns
- [ ] Searched Notion for related docs/RFCs
- [ ] Researched industry context (HN, TechCrunch, web)
- [ ] Evaluated against all relevant areas for RFC type
- [ ] Checked for anti-patterns
- [ ] Structured feedback constructively
- [ ] Included positive feedback
- [ ] Adjusted depth to requested level

---

## Notes

- For large RFCs, focus on highest-impact feedback first
- If RFC references systems you lack context on, note this explicitly
- Flag if you need more information before giving complete review
- Offer to discuss complex feedback synchronously
- Consider the author's experience level when calibrating feedback depth
