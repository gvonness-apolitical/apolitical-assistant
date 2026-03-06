# Delegate

Delegate a task or action item to a team member via Slack DM, with communication style adaptation and follow-up tracking.

## Usage

- `/delegate [task description] to [person]` - Delegate with DM
- `/delegate [task-id] to [person]` - Delegate an existing task by ID

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve delegate target
- [Dossier Context](../patterns/dossier-context.md) - Adapt communication style
- [Checkpointing](../patterns/checkpointing.md) - Track progress

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary]

Proceeding to Step N+1: [next step name]
```

## Process

### Step 1: Parse & Resolve

1. **Parse input**: Extract task description and target person
2. **Resolve person** using `.claude/people.json`:
   - Look up by name/alias in `indices.byAlias`
   - Get `slackUserId` for DM sending
   - Get `displayName` for message
3. **Check OOO**: Call `humaans_list_time_off` to verify the person is available
   - If OOO: warn and suggest alternative delegate or deferral
   - If available: continue
4. **If task-id provided**: Load the task details from TaskGet

```
✓ CHECKPOINT: Step 1 complete - Parse & Resolve
  Tools: Read ×1 (people.json), humaans_list_time_off ×1
  Person: [name] | Available: [yes/OOO until date] | Slack ID: [id]

Proceeding to Step 2: Draft Message
```

### Step 2: Draft Message

1. **Load dossier**: Check `.claude/dossiers.json` for the person
   - If dossier exists: adapt tone to their communication style preferences
   - If no dossier: use professional, direct tone
2. **Draft the DM**:
   - Include: what needs to be done, context/background, deadline if any, offer to help
   - Match the person's preferred communication style from dossier
   - Keep concise — Slack DMs should be scannable
3. **Show preview and confirm**:
   ```
   Draft DM to [person]:

   > [message preview]

   Send this? [Send / Edit / Cancel]
   ```
4. **If Edit**: Let user modify, then re-preview
5. **If Cancel**: Abort skill

```
✓ CHECKPOINT: Step 2 complete - Draft Message
  Tools: Read ×1 (dossiers.json)
  Draft: [brief summary] | Style: [adapted/default]

Proceeding to Step 3: Send & Track
```

### Step 3: Send & Track

1. **Send DM**: Use `slack_send_dm` with the person's `slackUserId`
2. **Create follow-up task**: TaskCreate with:
   - Subject: `P2.N: Follow up on delegation to [person] — [task summary]`
   - Description: includes what was delegated, when sent, expected completion
3. **If delegating an existing task**: Update the original task description to note delegation

```
✓ CHECKPOINT: Step 3 complete - Send & Track
  Tools: slack_send_dm ×1, TaskCreate ×1
  DM sent: [timestamp] | Follow-up task: #[id]

Proceeding to Step 4: Record Completion
```

### Step 4: Record Completion

1. **If delegating an existing task**: Record in `.claude/task-completions.json`:
   - `status`: "completed"
   - `completedVia`: "claude"
   - `reason`: "Delegated to [person] via Slack DM"
   - Include sourceId if available
2. **Update the original task** via TaskUpdate: mark as completed

```
✓ CHECKPOINT: Step 4 complete - Record Completion
  Tools: Read ×1, Write ×1 (task-completions.json), TaskUpdate ×1
  Original task: [completed/n/a] | Delegation recorded: yes
```

## Final Summary

```
# Delegation Complete

**Task**: [description]
**Delegated to**: [person]
**DM sent**: [timestamp]
**Follow-up task**: #[id] — check back in [timeframe]

---
Delegation complete.
```

## Error Handling

- **Person not found**: Suggest alternatives or ask for clarification
- **Person OOO**: Show return date, suggest waiting or alternative delegate
- **DM send fails**: Save draft message, suggest manual send
- **Dossier missing**: Use default professional tone (never blocks the skill)

## Notes

- Always show the DM preview before sending — never auto-send
- Dossier integration is additive — missing dossiers don't block execution
- Follow-up task ensures delegated work doesn't fall through the cracks
- Works with both new descriptions and existing task IDs
