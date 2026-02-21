# Session Handoff

Create a temporary context document to pass state to the next session when ending mid-task.

## Usage
- `/session-handoff` - Create handoff document for next session

## Core Patterns Used

- [Frontmatter](../patterns/frontmatter.md) - YAML metadata for handoff file
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations

## When to Use

Use this when:
- Ending a session in the middle of a task
- MCP servers need restart and context would be lost
- Switching to a different machine/context
- Any situation where session continuity matters

## What to Capture

Ask the user what needs to be handed off, or infer from recent conversation:

### Immediate Task
- What was being worked on
- What's the next action to take on restart
- Any specific commands or tool calls needed

### Context Summary
- Key decisions made this session
- Documents/files referenced (with IDs/paths)
- People involved

### Work in Progress
- Files modified but not committed
- Draft content created
- Partial completions

## Output

Write to: `context/YYYY-MM-DD/session-handoff.md`

```yaml
---
type: context
subtype: session-handoff
date: YYYY-MM-DD
time: HH:MM
purpose: [brief description of why handoff needed]
---
```

### Document Structure

```markdown
# Session Handoff - DD Month YYYY HH:MM

## Immediate Task: [Title]

[Clear instruction of what to do on restart]

---

## Context Summary

### What We Were Working On
[Numbered list of items/tasks]

### Key Documents Referenced
| Document | ID/Location |
|----------|-------------|

### Key Decisions
- [Decision points made]

---

## On Restart: First Action

```
[Exact instruction or command to run]
```
```

## Consumption (On Session Start)

**IMPORTANT**: At the start of any new session in this directory:

1. Check if `context/YYYY-MM-DD/session-handoff.md` exists (today's date)
2. If exists:
   - Read the file
   - Note the immediate task and context
   - **Delete the file** after reading
   - Proceed with the handoff instructions
3. If not exists: proceed normally (run `/orient` if appropriate)

The handoff document is ephemeral - it exists only to bridge one session to the next.

## Notes
- Handoff documents are temporary and should be deleted after consumption
- Keep handoff focused - this isn't a full context dump, just what's needed to resume
- If the task is complete, don't create a handoff - use `/end-of-day` instead
- Multiple handoffs in a day overwrite each other (only latest matters)
