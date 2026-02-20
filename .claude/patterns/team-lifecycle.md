# Team Lifecycle Pattern

Standard protocol for creating, coordinating, and cleaning up Claude Code agent teams within skills. Every team-using skill references this pattern for consistent setup, round orchestration, shutdown, and cleanup.

## When to Use

- Skills that require inter-agent communication (agents responding to each other's output)
- Multi-round debates, rebuttals, cross-examinations, or dialectics
- NOT for single-shot parallel execution — use standard Task agents for that

## Files Involved

- `.claude/settings.json` — `agentTeams` configuration block
- The skill's command file (e.g., `commands/evaluate.md`)
- This pattern file

## Prerequisites Check

All three conditions must be met before creating a team:

1. **Environment variable**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` must be set
2. **Settings flag**: `.claude/settings.json > agentTeams.enabled` must be `true`
3. **No nesting**: The current session must not already be inside a team (teams cannot nest)

```
Check prerequisites:
1. Verify env var CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
2. Read settings.json → agentTeams.enabled
3. Confirm not already in a team context

If ANY prerequisite fails → fall back to subagent execution (existing patterns)
Log which prerequisite failed for debugging
```

**Double-gate rationale**: The env var gates the Claude Code feature itself; the settings flag gates the skill's use of it. Both required so that teams can be disabled at either level.

## Team Creation

Create teams with a skill-derived name and timestamp to avoid collisions:

```
TeamCreate:
  team_name: "{skill}-{timestamp}"
  description: "Agent team for {skill} execution"

Example: "evaluate-1708423200"
```

## Spawning Teammates

Spawn teammates using the Task tool with `team_name` and `name` parameters:

```
Task:
  team_name: "{skill}-{timestamp}"
  name: "{role}"                    # e.g., "advocate-a", "judge"
  subagent_type: "general-purpose"
  prompt: "{role-specific prompt}"
```

- All teammates use `subagent_type: "general-purpose"` (needs read/write/tool access)
- Names should be descriptive: `advocate-a`, `advocate-b`, `judge`, `steelman`, `devils-advocate`, `security-reviewer`, etc.
- Spawn agents that work in parallel simultaneously; spawn sequential agents after dependencies complete

## Round Orchestration

Teams enable multi-round interaction — the key capability subagents lack.

### Pattern: Round-Based Execution

```
Round 1 (parallel):
  - Spawn agent-a and agent-b with initial prompts
  - Wait for both to complete (TaskList monitoring)
  - Collect outputs

Round 2 (parallel or sequential):
  - Send agent-a's output to agent-b via SendMessage
  - Send agent-b's output to agent-a via SendMessage
  - Wait for responses

Round N:
  - Continue as needed (up to maxRoundsDefault from settings)
  - Each round delivers previous round's output to the relevant agent

Final Round:
  - Spawn judge/synthesiser with all accumulated outputs
  - OR lead synthesises directly (for lighter synthesis needs)
```

### Delivering Round Output

Use `SendMessage` with `type: "message"` to deliver opponent output between rounds:

```
SendMessage:
  type: "message"
  recipient: "advocate-a"
  content: "Here is your opponent's opening argument. [opponent_output]. Your task: [rebuttal instructions]"
  summary: "Round 2 rebuttal prompt"
```

### Lead-as-Judge vs Separate Judge

| Approach | When to Use | Skills |
|----------|------------|--------|
| Separate judge teammate | Complex synthesis requiring clean context | `/evaluate`, `/review-rfc` |
| Lead-as-judge (coordinator synthesises) | Lighter synthesis, fewer competing positions | `/rubberduck`, `/mbr` |

## Graceful Shutdown

After all rounds complete, shut down teammates before cleanup:

```
For each teammate:
  SendMessage:
    type: "shutdown_request"
    recipient: "{agent-name}"
    content: "All rounds complete, shutting down team"

  Wait for shutdown_response (up to shutdownTimeoutMs from settings)
  If timeout → proceed anyway (agent will be cleaned up with TeamDelete)
```

## Cleanup

**TeamDelete MUST happen even on failure.** Structure team usage as try/finally:

```
try:
  1. TeamCreate
  2. Spawn teammates
  3. Execute rounds
  4. Collect results
  5. Shutdown teammates
finally:
  TeamDelete  # Always runs — prevents orphaned teams
```

If cleanup fails (e.g., TeamDelete errors), log the failure but don't block the skill output.

## Fallback Chain

Every team-using skill must implement this fallback chain:

```
1. Attempt team-based execution
   ↓ (team prerequisites fail)
2. Fall back to subagent execution (existing patterns)
   ↓ (subagent execution fails)
3. Fall back to single-agent execution
```

Specific failure scenarios:

| Failure | Action |
|---------|--------|
| Prerequisites check fails | → Subagent path |
| TeamCreate fails | → Subagent path |
| One teammate fails mid-round | → Shut down team, use subagent path |
| Round delivery (SendMessage) fails | → Degrade within team: proceed to judge with available output |
| Judge/synthesis fails | → Present raw agent outputs side-by-side |
| TeamDelete fails | → Log error, proceed with skill output |

## Configuration

Settings in `.claude/settings.json`:

```json
"agentTeams": {
  "enabled": false,
  "maxRoundsDefault": 3,
  "shutdownTimeoutMs": 30000
}
```

- `enabled`: Master switch for team-based execution in skills
- `maxRoundsDefault`: Maximum rounds before forcing synthesis (skills can override)
- `shutdownTimeoutMs`: How long to wait for teammate shutdown responses

## Anti-Patterns

- **Don't create teams for single-shot parallel execution** — standard Task agents are simpler and cheaper
- **Don't nest teams** — one team per session; if a skill needs sub-teams, restructure as sequential phases
- **Don't leave teams running** — always TeamDelete in a finally block
- **Don't use broadcast for round-specific messages** — use targeted SendMessage to the specific agent
- **Don't send structured JSON status messages** — use TaskUpdate to mark tasks completed; the system handles idle notifications
- **Don't create teams when `--single` is specified** — `--single` always bypasses both team AND subagent modes

## Skills Using This Pattern

- `/evaluate` — 3-round comparative debate (opening → rebuttal → judge)
- `/rubberduck --challenge` — 4-round dialectic (steelman → challenges → defense → assessment)
- `/mbr --compete` — Cross-examination after initial positions
- `/review-rfc deep` — Specialised review team with cross-reference round
- `/war-game` — Multi-stakeholder scenario planning (always uses team)
