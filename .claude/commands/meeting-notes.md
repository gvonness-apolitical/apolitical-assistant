# Meeting Notes

Create structured meeting notes with technical context.

## Usage
- `/meeting-notes [gemini-doc-id]` - process Gemini auto-notes into structured format
- `/meeting-notes [meeting-name]` - create notes for a meeting (will search for Gemini notes)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve attendee names
- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for notes file
- [Error Handling](../patterns/error-handling.md) - Handle API issues

## Process

1. **Get raw notes**: Fetch Gemini meeting notes from Google Docs
2. **Identify topics**: Extract key discussion points
3. **Add technical context**: For each technical topic mentioned:
   - Link to relevant Linear tickets
   - Link to relevant PRs
   - Link to Notion docs/RFCs
   - Add brief technical background
4. **Extract action items**: Who, what, when
5. **Structure output**: Clean markdown format

## Output Structure

```markdown
# Meeting: [Title]
**Date:** YYYY-MM-DD HH:MM
**Attendees:** [list]

---

## Summary
[2-3 sentence overview]

---

## Key Points

### [Topic 1]
- Discussion points
- Decisions made
- **Technical context:** [relevant links and background]

### [Topic 2]
...

---

## Action Items

### For [Person]
- [ ] Action item with context

### For [Other Person]
...

---

## Related Links
| Resource | Link |
|----------|------|
| Linear ticket | url |
| PR | url |
| Doc | url |
```

Save to `meetings/output/[meeting-type]/YYYY-MM-DD-[attendee-or-title].md`

## Meeting Types
- `one-on-ones/` - 1:1 meetings
- `squad/` - Squad meetings
- `planning/` - Planning sessions
- `external/` - External calls
- `general/` - Everything else

## Notes
- For 1:1s, maintain consistent format for tracking over time
- Link to previous meeting notes if pattern of recurring meetings
- Flag action items that are overdue from previous meetings
