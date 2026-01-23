# Review RFC

Perform a comprehensive technical review of an RFC in Notion, providing structured feedback as comments.

## Usage
- `/review-rfc [notion-url]` - standard review of the RFC
- `/review-rfc [notion-url] quick` - high-level structural feedback only
- `/review-rfc [notion-url] deep` - comprehensive review with code-level suggestions
- `/review-rfc [rfc-title]` - search for and review an RFC by title

## Review Depth

| Depth | Focus | Time Equivalent |
|-------|-------|-----------------|
| **quick** | High-level structure, obvious concerns, key questions | ~15 min |
| **standard** | All evaluation areas, thorough but focused | ~45 min |
| **deep** | Comprehensive analysis, code examples, alternatives | ~2 hours |

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

**From Notion:**
- Search for related RFCs and architecture decision records
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
