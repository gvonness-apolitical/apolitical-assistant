# Draft Email Response

Help draft an email response with appropriate context.

## Usage
- `/draft-email [message-id]` - draft reply to specific email
- `/draft-email` - then describe the email/context

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve recipient
- [Dossier Context](../patterns/dossier-context.md) - Load communication profile and playbook

## Process

1. **Get context**: If message ID provided, fetch the full email thread
2. **Understand intent**: What response is needed? (confirm, decline, provide info, escalate)
3. **Load dossier**: Resolve the recipient to an email, look up their dossier in `.claude/dossiers.json`. If found, use communication style, sensitivities, and playbook to inform the draft. If not found, proceed normally.
4. **Gather background**: Check for related Slack/Linear/GitHub context if relevant
5. **Draft response**: Match tone and formality of the sender, informed by dossier context

## Output

Provide:
1. **Draft email** - ready to copy/paste
2. **Notes** - any context or caveats
3. **Suggested CC** - if others should be included

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
