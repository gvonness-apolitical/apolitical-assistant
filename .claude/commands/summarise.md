# Summarise

Summarise a thread, document, or conversation.

## Usage
- `/summarise [url]` - summarise a Slack thread, GitHub PR, Linear ticket, or Notion doc
- `/summarise [topic]` - search for and summarise relevant context on a topic
- `/summarise [url/topic] --compete` - Force competitive summary (two summary styles)
- `/summarise [url/topic] --single` - Force single-agent (override auto-triggers)

## Core Patterns Used

- [Competitive Draft](../patterns/competitive-draft.md) - Parallel summaries with different depth/brevity seeds

## Competitive Draft Mode

Before summarising, determine whether to use competitive mode. Two agents summarise the same content from different lenses — one prioritising executive brevity, the other preserving comprehensive detail — and the user selects or merges.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Default (no flag) | No — single-agent |

No auto-triggers — summary style is always user preference. Use `--compete` to see both options.

**How it works:** Two parallel Task agents (subagent_type: `general-purpose`) each summarise the same content from a different seed prompt — Executive Brevity vs Comprehensive Detail (see [Competitive Draft](../patterns/competitive-draft.md) for seed text). Both agents receive identical pre-gathered context as prompt text: the full source content and any additional context. Agents do NOT have MCP tool access — all context must be passed in the prompt.

The difference is what each agent prioritises:
- **Seed A (Executive Brevity)** produces 3-5 bullet points covering decisions and actions only — ruthlessly concise
- **Seed B (Comprehensive Detail)** preserves nuance, captures reasoning, includes context — thorough but structured

After both summaries are returned, present them with a Key Differences comparison and use `AskUserQuestion` with options: **Summary A** / **Summary B** / **Merge**. If the user selects Merge, ask which elements to take from each summary before combining.

After selection, emit a Causantic event:
```
[compete-draft: skill=summarise, seed_a=executive-brevity, seed_b=comprehensive-detail, user_chose=a|b|merge, context=BRIEF_DESCRIPTION]
```

### Competitive Output Format

```markdown
## Summary A — Executive Brevity
[3-5 bullet points, decisions and actions only]

---

## Summary B — Comprehensive Detail
[Full structured summary preserving nuance]

---

### Key Differences
- **Length**: Summary A is ~N words, Summary B is ~N words
- **Coverage**: Summary A covers [X], Summary B also includes [Y]
- **Nuance**: Summary A omits [context], Summary B preserves [reasoning]

Which summary do you prefer? I can also merge elements from both.
```

---

## Supported Sources

- **Slack threads**: Fetch thread and summarise discussion + decisions
- **GitHub PRs**: Summarise changes, review comments, status
- **Linear tickets**: Summarise issue, comments, related work
- **Notion docs**: Summarise content and key points
- **Google Docs**: Summarise document content
- **Email threads**: Summarise conversation and action items

## Output Structure

**If competitive mode is active**: Follow the Competitive Draft Mode steps above — launch two parallel agents with the source content, present both summaries, let the user select. Then present the chosen/merged summary in the standard format below.

**If single-agent mode** (default): Produce the summary directly using the format below.

### TL;DR
2-3 sentence summary of the key point

### Context
- What is this about
- Who's involved
- Timeline/status

### Key Points
- Main discussion points or decisions
- Any disagreements or open questions

### Action Items
- What needs to happen next
- Who owns what

### Related
- Links to related tickets, PRs, docs if found

## Notes
- For long threads, focus on decisions and outcomes over play-by-play
- Flag if there are unresolved disagreements
- Note if context seems incomplete (e.g., references to offline conversations)
