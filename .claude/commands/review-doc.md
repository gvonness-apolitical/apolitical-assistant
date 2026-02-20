# Review Document

Review a Google Doc or Slides presentation, providing feedback through comments. Designed for non-technical stakeholders seeking engineering input.

## Usage
- `/review-doc [google-doc-url]` - review a Google Doc
- `/review-doc [google-slides-url]` - review a Google Slides presentation
- `/review-doc [title]` - search Drive for a document by title
- `/review-doc [url/title] --compete` - Force competitive review (two review lenses)
- `/review-doc [url/title] --single` - Force single-agent (override auto-triggers)

## Review Focus

### Technical Accuracy
- Validate technical claims and feasibility
- Flag misunderstandings about systems, timelines, or complexity
- Suggest corrections with clear explanations
- Reference architecture context where relevant

### Communication Clarity
- Identify ambiguous or unclear sections
- Suggest more precise language
- Recommend restructuring if flow is confusing
- Highlight jargon that may confuse the audience

### Analogies & Explanations
- Suggest analogies to make technical concepts accessible
- Offer simpler explanations for complex ideas
- Help bridge technical and non-technical understanding

### Conciseness
- Flag redundant content
- Suggest tighter phrasing
- Identify sections that could be summarised or cut

## Core Patterns Used

- [Competitive Draft](../patterns/competitive-draft.md) - Parallel reviews with different lenses

## Competitive Draft Mode

Before reviewing, determine whether to use competitive mode. Two agents review the same document through different lenses — one prioritising technical depth, the other prioritising accessibility — and the user selects or merges.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Default (no flag) | No — single-agent |

**How it works:** Two parallel Task agents (subagent_type: `general-purpose`) each review the document from a different seed prompt — Technical Depth vs Accessibility (see [Competitive Draft](../patterns/competitive-draft.md) for seed text). Both agents receive identical pre-gathered context as prompt text: the full document content, technical architecture context, and any additional context from Steps 1-4. Agents do NOT have MCP tool access — all context must be passed in the prompt.

The difference is what each agent prioritises:
- **Seed A (Technical Depth)** flags precision issues, structural gaps, logical inconsistencies, and incorrect technical claims
- **Seed B (Accessibility)** flags jargon, unclear value propositions, missing audience context, and opportunities for better analogies

After both reviews are returned, present them with a Key Differences comparison and use `AskUserQuestion` with options: **Review A** / **Review B** / **Merge**. If the user selects Merge, ask which elements to take from each review before combining.

After selection, emit a Causantic event:
```
[compete-draft: skill=review-doc, seed_a=technical-depth, seed_b=accessibility, user_chose=a|b|merge, context=BRIEF_DESCRIPTION]
```

---

## Process

### 1. Fetch the Document
- Use `drive_search` to find by title if needed
- Use `docs_get_content` for Google Docs
- Use `slides_get_presentation` for Google Slides
- Note the document owner and any existing comments

### 2. Load Technical Context
- Read `tech-notes/architecture.md` for:
  - Tech stack details
  - Established patterns
  - Architectural principles
  - Service inventory

### 3. Review the Content

**If competitive mode is active**: Follow the Competitive Draft Mode steps above — launch two parallel agents with the document content and technical context, present both reviews, let the user select. Then continue to the Feedback Approach and Output sections with the chosen/merged review.

**If single-agent mode** (default): Review using the guidance below.

**For Google Docs:**
- Read through section by section
- Note areas needing feedback
- Consider the intended audience

**For Google Slides:**
- Review slide by slide
- Check narrative flow
- Assess visual clarity of technical concepts

### 4. Gather Additional Context (if needed)
- Search Notion for related documentation
- Check GitHub for relevant code/systems mentioned
- Look up any referenced projects in Linear

---

## Feedback Approach

### Comment Style
Feedback is provided as comments, not direct edits (unless specifically requested).

**Structure each comment:**
1. **What**: Identify the specific issue or suggestion
2. **Why**: Explain the reasoning
3. **How**: Offer a concrete improvement or alternative

**Tone:**
- Collaborative, not critical
- Assume good intent
- Offer suggestions, not demands
- Use "Consider..." or "You might..." phrasing

### Types of Feedback

| Type | When to Use | Example |
|------|-------------|---------|
| **Clarification** | Meaning is unclear | "This could be read two ways - did you mean X or Y?" |
| **Technical correction** | Factual inaccuracy | "The API actually uses OAuth, not API keys" |
| **Simplification** | Overly complex | "Consider: 'The system stores data' instead of 'The system persists data artifacts to the storage layer'" |
| **Analogy suggestion** | Concept needs grounding | "You could compare this to a library card catalogue - it helps find things but doesn't store the books" |
| **Structure** | Flow issues | "Consider moving this section before X - it provides context needed there" |
| **Audience fit** | Wrong level of detail | "This may be too technical for the exec audience - consider a higher-level summary" |

---

## Output Format

### Competitive Output

When competitive mode is active, present both reviews before the user selects:

```markdown
## Review A — Technical Depth
[Full review focused on precision, logic, structural gaps]

---

## Review B — Accessibility
[Full review focused on jargon, audience fit, analogies, clarity]

---

### Key Differences
- **Focus**: Review A targets [X], Review B targets [Y]
- **Strongest feedback**: Review A catches [X], Review B catches [Y]
- **Overlap**: Both flag [shared concerns]
```

Use `AskUserQuestion` with options: **Review A** / **Review B** / **Merge**.

After selection, present the chosen or merged review in the standard Comment Summary format below.

### Comment Summary
After reviewing, provide a summary to the user:

```markdown
## Document Review: [Title]

**Document Type**: Google Doc / Google Slides
**Author**: [Name]
**Audience**: [Inferred or stated audience]

### Summary
[1-2 sentence overall assessment]

### Key Feedback

**Technical Accuracy**
- [Major technical issues, if any]

**Clarity & Communication**
- [Main clarity suggestions]

**Suggested Analogies**
- [Analogies offered to explain concepts]

### Comments Added
[Number] comments added to the document covering:
- [Brief list of topics addressed]

### Next Steps
- [Recommended actions for the author]
```

### If Unable to Comment Directly
If the MCP server doesn't support adding comments, provide feedback in a structured format the user can copy:

```markdown
## Feedback for [Title]

### Section: [Section name or slide number]
**Quote**: "[relevant text]"
**Feedback**: [Your comment]

---
[Repeat for each piece of feedback]
```

---

## Analogy Bank

When explaining technical concepts, draw from relatable analogies:

| Concept | Analogy |
|---------|---------|
| API | A waiter taking orders between you and the kitchen |
| Database | A filing cabinet with organised folders |
| Cache | A sticky note on your desk vs. looking up the file |
| Load balancer | A restaurant host seating guests across sections |
| Microservices | Specialists vs. one person doing everything |
| Authentication | Checking ID at the door |
| Authorization | VIP list - you're in, but can you access the VIP area? |
| Queue | A to-do list that processes items in order |
| Async processing | Ordering coffee and getting a buzzer |
| Technical debt | Clutter that slows you down until you tidy up |
| CI/CD | Assembly line with quality checks at each station |
| Feature flag | A light switch for features |

---

## Guidelines

### Do
- Be specific with feedback
- Provide alternatives, not just criticism
- Acknowledge what works well
- Consider the author's expertise level
- Use the author's terminology where possible

### Don't
- Rewrite entire sections (unless asked)
- Be condescending about technical gaps
- Overwhelm with too many comments
- Nitpick minor style preferences
- Assume malice for mistakes

---

## Notes

- For extensive restructuring suggestions, offer to discuss synchronously
- If the document is fundamentally misaligned, flag early rather than detailed feedback
- Remember: the goal is to help the author succeed, not demonstrate technical knowledge
