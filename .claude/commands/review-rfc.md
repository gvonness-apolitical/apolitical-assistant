# Review RFC

Perform a comprehensive technical review of an RFC in Notion, providing structured feedback as comments.

## Core Patterns Used
- [Adversarial Debate](../patterns/adversarial-debate.md) - Competitive review mode

## Usage
- `/review-rfc [notion-url]` - standard review of the RFC
- `/review-rfc [notion-url] quick` - high-level structural feedback only
- `/review-rfc [notion-url] deep` - comprehensive review with code-level suggestions (auto-enables competitive mode)
- `/review-rfc [rfc-title]` - search for and review an RFC by title
- `/review-rfc [notion-url] --compete` - force competitive mode (Advocate vs Challenger)
- `/review-rfc [notion-url] --single` - force single-agent mode (override auto-enable)

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

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Yes |
| `--single` flag | No (override auto) |
| `deep` review depth | Auto-yes |
| RFC tagged "architecture" or "infrastructure" | Auto-yes |
| RFC author is senior/principal+ | Auto-yes |
| Default | No (single-agent) |

### How It Works

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

### 5. Evaluate (Single-Agent or Competitive)

**Check competitive mode activation** (see Competitive Review Mode section above):
- If `--compete` flag, `deep` depth, or auto-trigger matches → run Adversarial Debate
- If `--single` flag or no trigger → run single-agent evaluation

**Single-agent path**: Evaluate the RFC against all relevant areas from the Evaluation Framework below. Produce the review directly.

**Competitive path**: Follow the Adversarial Debate pattern:
1. Launch **Advocate** and **Challenger** Task agents in parallel, both receiving identical context from steps 1-4
2. Wait for both to complete
3. Launch **Judge** Task agent with both outputs
4. Format output with full debate transparency (see Competitive Review Mode output format)
5. Emit Causantic event

### 6. Structure Feedback

Using the evaluation output (from either single-agent or Judge synthesis), structure the feedback according to the Output Format below. If competitive mode was used, the Judge's **key themes** should guide which concerns lead the Blocking Concerns and Recommendations sections — these are the arguments that survived adversarial scrutiny and carry highest confidence.

### 7. Post to Notion

Post the structured review as a comment using `notion-create-comment`.

### 7b. Save Local Copy (Competitive Mode Only)

When competitive mode was active, save the full debate locally to `work/YYYY-MM-DD-rfc-review-[slug].md` for future reference (Causantic recall, revision tracking). The slug is derived from the RFC title (lowercase, hyphens, truncated to ~40 chars).

**Frontmatter:**
```yaml
---
type: work
subtype: rfc-review
date: YYYY-MM-DD
tags: [rfc-review, competitive]
related:
  - [notion URL of RFC]
status: final
---
```

**Content:** Standard review header, Advocate position, Challenger position, Judge synthesis with key themes, agreement/contested zones. This mirrors the Notion comment content but includes the full debate context.

This is in addition to the Notion comment — the local copy preserves the adversarial debate for future runs on related RFCs.

### 8. Provide Summary

Confirm the review was posted with a link, key concerns summary, recommended next steps, and offer to discuss.

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

### Comment Structure

Post to Notion using `notion-create-comment`:

```markdown
## Technical Review

**Depth**: [quick/standard/deep]
**RFC Type**: [api/data-model/infrastructure/feature]

### Summary
[2-3 sentence overall assessment - is this ready to proceed, needs work, or needs rethink?]

---

### Blocking Concerns
[Issues that must be addressed before approval]

**[Concern Title]**
- Issue: [What's wrong]
- Impact: [Why it matters]
- Suggestion: [How to address]

---

### Recommendations
[Significant improvements to consider]

**[Area]**
- [Recommendation and rationale]

---

### Questions
[Clarifications needed to complete review]

- [Question]?

---

### Minor Suggestions
- [Small improvements, style/convention items]

---

### What Works Well
- [Positive feedback - acknowledge good decisions]

---

### Industry Context
[Relevant patterns, trends, or learnings from research]

---

*Review based on: architecture principles (FP, clean architecture, DDD), established patterns, and industry research.*
```

### Post-Review Summary

After posting, provide:
- Confirmation with link to RFC
- Key concerns summary (1-2 sentences)
- Recommended next steps
- Offer to discuss any complex feedback

---

## Tone Guidelines

- **Constructive, not critical** - we're improving the design together
- **Explain the "why"** - rationale helps more than just "don't do X"
- **Offer alternatives** - when flagging issues, suggest solutions
- **Acknowledge trade-offs** - most decisions involve compromise
- **Respect effort** - the author has thought about this
- **Questions over statements** - "Have you considered X?" not "X is wrong"
- **Balance** - ensure positive feedback, not just criticism

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
