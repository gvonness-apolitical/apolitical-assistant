# Draft Email Response

Help draft an email response with appropriate context.

## Usage
- `/draft-email [message-id]` - draft reply to specific email
- `/draft-email` - then describe the email/context

## Process

1. **Get context**: If message ID provided, fetch the full email thread
2. **Understand intent**: What response is needed? (confirm, decline, provide info, escalate)
3. **Gather background**: Check for related Slack/Linear/GitHub context if relevant
4. **Draft response**: Match tone and formality of the sender

## Output

Provide:
1. **Draft email** - ready to copy/paste
2. **Notes** - any context or caveats
3. **Suggested CC** - if others should be included

## Tone Guidelines

- **Internal (Apolitical)**: Friendly, direct, use first names
- **External (partners/vendors)**: Professional but warm
- **Exec team**: Concise, action-oriented
- **Engineering**: Technical detail welcome, be specific

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
