# Summarise

Summarise a thread, document, or conversation.

## Usage
- `/summarise [url]` - summarise a Slack thread, GitHub PR, Linear ticket, or Notion doc
- `/summarise [topic]` - search for and summarise relevant context on a topic

## Supported Sources

- **Slack threads**: Fetch thread and summarise discussion + decisions
- **GitHub PRs**: Summarise changes, review comments, status
- **Linear tickets**: Summarise issue, comments, related work
- **Notion docs**: Summarise content and key points
- **Google Docs**: Summarise document content
- **Email threads**: Summarise conversation and action items

## Output Structure

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
