# Late Reconciliation Pattern

## Purpose

Handle action items surfaced by agents that complete after task-creating steps (e.g., Step 7 in begin-day) have already run. Ensures no action items are lost due to timing gaps in parallel agent execution.

## When to Apply

- Parallel agents (Steps 4-6) complete after Step 7 (Update Todos) has finished
- A resumed or duplicate agent returns additional findings
- Any async process surfaces action items after the task list has been finalized

## Algorithm

1. **Extract action items** from the late-arriving agent output
2. **Dedup against existing tasks**: Call `TaskList` and compare subjects/keywords
3. **Dedup against completions**: Check `.claude/task-completions.json` for already-completed items
4. **Create tasks** for genuinely new items using `TaskCreate` with `P{n}.{m}:` format
5. **Update briefing** if one has been generated — add new items to the appropriate P-level section
6. **Update daily context index** — append a reconciliation entry to the session log:
   ```
   | HH:MM | Reconciliation | N new tasks from late-arriving [agent name] |
   ```
7. **Log**: Output a reconciliation marker:
   ```
   ⟳ RECONCILIATION: [agent name] late arrival
     New tasks: N (list task IDs)
     Already tracked: N (list matches)
     Completed/dismissed: N (list matches)
   ```

## Rules

- Reconciliation MUST create tasks via TaskCreate — adding items to the briefing FYI section is not sufficient
- Always check both TaskList and task-completions.json before creating — avoid duplicates
- Use the same P-numbering scheme as the current task list (check highest existing P-number and increment)
- If the briefing has already been generated, edit it in-place rather than regenerating

## Integration

Referenced by:
- `skills/begin-day.md` — after Steps 4-6 parallel agents and after Step 7
- Any skill that launches background agents which may return after task creation
