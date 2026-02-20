# Draft Email Response

Help draft an email response with appropriate context.

## Usage
- `/draft-email [message-id]` - draft reply to specific email
- `/draft-email` - then describe the email/context
- `/draft-email [message-id] --compete` - Force competitive draft (two tone variants)
- `/draft-email [message-id] --single` - Force single-agent (override auto-triggers)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve recipient
- [Dossier Context](../patterns/dossier-context.md) - Load communication profile and playbook
- [Competitive Draft](../patterns/competitive-draft.md) - Parallel drafts with tone variants

## Process

1. **Get context**: If message ID provided, fetch the full email thread
2. **Understand intent**: What response is needed? (confirm, decline, provide info, escalate)
3. **Load dossier**: Resolve the recipient to an email, look up their dossier in `.claude/dossiers.json`. If found, use communication style, sensitivities, and playbook to inform the draft. If not found, proceed normally.
4. **Gather background**: Check for related Slack/Linear/GitHub context if relevant

### Competitive Draft Mode

Before drafting, determine whether to use competitive mode.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Dossier has non-empty `profile.sensitivities` | Auto-yes |
| Default (no flag, no auto-trigger) | No — single-agent |

**How it works:** Two parallel Task agents (subagent_type: `general-purpose`) each produce a draft from a different seed prompt — Directness vs Diplomacy (see [Competitive Draft](../patterns/competitive-draft.md) for seed text). Both agents receive identical pre-gathered context as prompt text: the full email thread, recipient dossier, and any supporting info from steps 1-4. Agents do NOT have MCP tool access — all context must be passed in the prompt.

The difference is how each agent applies the dossier:
- **Seed A (Direct)** uses the dossier to be precise and clear while respecting boundaries
- **Seed B (Diplomatic)** uses the dossier to maximise relationship preservation

After both drafts are returned, present them with a Key Differences comparison and use `AskUserQuestion` with options: **Draft A** / **Draft B** / **Merge**. If the user selects Merge, ask which elements to take from each draft before combining.

After selection, emit a Causantic event:
```
[compete-draft: skill=draft-email, seed_a=direct, seed_b=diplomatic, user_chose=a|b|merge, context=BRIEF_DESCRIPTION]
```

5. **Draft response**:
   - **If competitive mode is active**: Follow the Competitive Draft Mode steps above — launch two parallel agents, present both drafts, let the user select. Then continue to Output with the chosen/merged draft.
   - **If single-agent mode** (default): Match tone and formality of the sender, informed by dossier context.

## Output

### Single-Agent Output

Provide:
1. **Draft email** - ready to copy/paste
2. **Notes** - any context or caveats
3. **Suggested CC** - if others should be included

### Competitive Output

When competitive mode is active, present both drafts before the user selects:

```markdown
## Draft A — Direct
[Full email draft]

---

## Draft B — Diplomatic
[Full email draft]

---

### Key Differences
- **Tone**: Draft A is [X], Draft B is [Y]
- **Opening**: Draft A leads with [X], Draft B leads with [Y]
- **Dossier application**: Draft A uses [aspect], Draft B uses [aspect]
```

Use `AskUserQuestion` with options: **Draft A** / **Draft B** / **Merge**.

After selection, present the chosen or merged draft with Notes and Suggested CC as normal.

## Tone Guidelines

Default tone by audience (override with dossier context when available):

- **Internal (Apolitical)**: Friendly, direct, use first names
- **External (partners/vendors)**: Professional but warm
- **Exec team**: Concise, action-oriented
- **Engineering**: Technical detail welcome, be specific

**Dossier-informed tone**: If the recipient has a dossier, their `communicationStyle` and `playbook.effectiveFrames` take precedence over these defaults. For example, if the dossier says they prefer detailed reasoning over concise directives, adjust accordingly.

## Templates

**Declining a meeting:**
> Thanks for the invite. I won't be able to make this one - [reason if appropriate]. [Suggest alternative or delegate if relevant].

**Confirming action:**
> Thanks - I'll [action] by [timeframe]. Let me know if you need anything else.

**Escalating/delegating:**
> Looping in [name] who's better placed to help with this. [Brief context for them].

## Notes
- Never commit to deadlines without checking calendar
- Flag if response might have political sensitivity
- Offer to send or just provide draft for review
