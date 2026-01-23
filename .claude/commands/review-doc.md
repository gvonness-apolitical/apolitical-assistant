# Review Document

Review a Google Doc or Slides presentation, providing feedback through comments. Designed for non-technical stakeholders seeking engineering input.

## Usage
- `/review-doc [google-doc-url]` - review a Google Doc
- `/review-doc [google-slides-url]` - review a Google Slides presentation
- `/review-doc [title]` - search Drive for a document by title

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
