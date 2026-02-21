# Skill Structure Pattern

Defines three tiers of skill maturity based on complexity and risk. Each tier has specific structural requirements.

## Tiers

| Tier | Criteria | Examples |
|------|----------|---------|
| **Heavy** | 5+ steps, API-intensive, task creation, destructive ops | begin-day, triage-inbox, slack-read, update-todos, catchup, prep-meeting |
| **Medium** | 3-4 steps, multiple API calls, no destructive ops | orient, morning-briefing, end-of-day, team-status, find-context, whats-blocking |
| **Light** | 1-2 steps, interactive/responsive | respond-to, draft-email, summarise, evaluate, rubberduck, dossier, session-handoff |

## Required Structure by Tier

### Heavy Tier

- Full checkpoint discipline (`### Step N: Name` format with `✓ CHECKPOINT` markers)
- `## MANDATORY: Required Tools Per Step` table with per-step tool requirements and "Can Skip" column
- `## Context Window Management` section (batch sizes, compaction rules)
- `## Error Handling` section with resume capability (`--resume` flag)
- `## Core Patterns Used` section
- Tool audit in every checkpoint: `Tools: [tool] ×[N], ...`
- Progress tracking appended to `context/YYYY-MM-DD/index.md`

### Medium Tier

- `## MANDATORY: Required Tool Calls` table listing required API calls per section
- `## Core Patterns Used` section
- Tool audit at completion: `Tools: [tool] ×[N], ...`
- Quick mode support (`--quick` skips APIs, uses cached data)
- `## Error Handling` section (reference `patterns/error-handling.md`)

### Light Tier

- `## Core Patterns Used` section
- `## Error Handling` reference (at minimum)
- Document expected tool calls in process description
- No checkpoints needed

## Common Sections (All Tiers)

Every skill should have:

1. **Usage** — command syntax and flags
2. **Core Patterns Used** — links to referenced patterns
3. **Process** — what the skill does
4. **Output** — what gets produced
5. **Notes** — edge cases and tips

## Anti-Patterns

- Skill claims to execute API calls but has no MANDATORY table → will silently skip
- Checkpoint without `Tools:` audit → didn't actually execute the step
- Heavy skill without context window management → will fail on large datasets
- Medium skill without quick mode → no fallback when MCP servers are down
