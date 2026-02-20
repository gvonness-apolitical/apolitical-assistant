# Respond To

Draft a response to an email, Slack message, PR comment, or Linear ticket.

## Usage
- `/respond-to [email message ID]` - draft email reply
- `/respond-to [slack thread URL]` - draft Slack response
- `/respond-to [PR URL]` - draft PR review or comment
- `/respond-to [Linear ticket ID]` - draft ticket comment
- `/respond-to [url/id] --compete` - Force competitive draft (two tone variants)
- `/respond-to [url/id] --single` - Force single-agent (override auto-triggers)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve message author
- [Dossier Context](../patterns/dossier-context.md) - Load communication profile and playbook
- [Competitive Draft](../patterns/competitive-draft.md) - Parallel drafts with tone variants

## Process

### 1. Gather Context
- Fetch the full thread/conversation
- Identify participants and their roles
- **Load dossier** for the primary recipient (see Dossier Context below)
- Check for related items (linked tickets, docs, previous discussions)
- Review recent interactions with the person

### Dossier Context

Before drafting, load the recipient's dossier using the [Dossier Context](../patterns/dossier-context.md) pattern:

1. Resolve the recipient to an email via person-resolution
2. Look up their dossier in `.claude/dossiers.json`
3. If found, use when drafting:
   - **Communication style** — match their preferred tone and approach
   - **Sensitivities** — avoid triggering defensive patterns
   - **Effective frames** — use framing strategies that land well with this person
   - **Avoid patterns** — steer clear of approaches that cause disengagement
   - **Recent notes** — incorporate recent context about the relationship
4. If no dossier exists, proceed normally without dossier context

### 2. Understand the Ask
- What is being asked or discussed?
- What's the urgency level?
- What decision or action is needed?
- Is there subtext or politics to navigate?

### 3. Gather Supporting Info
If needed, search for:
- Technical details from code/docs
- Historical context from previous discussions
- Related tickets or PRs
- Company policies or guidelines

### Competitive Draft Mode

Before drafting, determine whether to use competitive mode. This applies to **email and Slack responses only** — PR comments and Linear ticket responses are technical and don't benefit from tone variation.

**Activation:**

| Trigger | Competition? |
|---------|-------------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Dossier has non-empty `profile.sensitivities` | Auto-yes |
| Item is a PR comment or Linear ticket | Always no (not applicable) |
| Default (no flag, no auto-trigger) | No — single-agent |

**How it works:** Two parallel Task agents (subagent_type: `general-purpose`) each produce a draft from a different seed prompt — Directness vs Diplomacy (see [Competitive Draft](../patterns/competitive-draft.md) for seed text). Both agents receive identical pre-gathered context as prompt text: the full thread/conversation, recipient dossier, and any supporting info from Steps 1-3. Agents do NOT have MCP tool access — all context must be passed in the prompt.

The difference is how each agent applies the dossier:
- **Seed A (Direct)** uses the dossier to be precise and clear while respecting boundaries
- **Seed B (Diplomatic)** uses the dossier to maximise relationship preservation

After both drafts are returned, present them with a Key Differences comparison and use `AskUserQuestion` with options: **Draft A** / **Draft B** / **Merge**. If the user selects Merge, ask which elements to take from each draft before combining.

After selection, emit a Causantic event:
```
[compete-draft: skill=respond-to, seed_a=direct, seed_b=diplomatic, user_chose=a|b|merge, context=BRIEF_DESCRIPTION]
```

### 4. Draft Response

**If competitive mode is active** (email/Slack only): Follow the Competitive Draft Mode steps above — launch two parallel agents, present both drafts, let the user select. Then continue to the Output section with the chosen/merged draft.

**If single-agent mode** (default, or PR/Linear): Draft a single response using the guidance below.

**Dossier-informed drafting**: If dossier context was loaded, frame the response accordingly. For example:
- If the person responds well to data-driven arguments, lead with evidence
- If the person is sensitive about autonomy, frame suggestions as options rather than directives
- If the person prefers direct communication, skip preamble and get to the point

**For Email**:
- Match the formality level of the sender
- Be concise but complete
- Include next steps if applicable
- Draft using gmail_create_draft if requested

**For Slack**:
- Keep it conversational
- Use threads appropriately
- Consider emoji reactions where suitable

**For PR Comments**:
- Be constructive and specific
- Reference code locations
- Distinguish blocking vs non-blocking feedback

**For Linear**:
- Update ticket status if appropriate
- Tag relevant people
- Link related items

## Output

### Single-Agent Output

#### Summary
Brief summary of what's being responded to

#### Key Points to Address
- List of items that need response

#### Draft Response
The actual draft text

#### Tone Check
Assessment of tone (too formal, too casual, appropriate)

#### Alternative Approaches
Other ways to respond if the situation is delicate

#### Before Sending
- [ ] Addressed all points raised
- [ ] Tone is appropriate
- [ ] No sensitive info disclosed
- [ ] Right people included/excluded

### Competitive Output

When competitive mode is active, present both drafts before the user selects:

```markdown
## Draft A — Direct
[Full draft]

---

## Draft B — Diplomatic
[Full draft]

---

### Key Differences
- **Tone**: Draft A is [X], Draft B is [Y]
- **Opening**: Draft A leads with [X], Draft B leads with [Y]
- **Dossier application**: Draft A uses [aspect], Draft B uses [aspect]
```

Use `AskUserQuestion` with options: **Draft A** / **Draft B** / **Merge**.

After selection, present the chosen or merged draft with the standard Before Sending checklist above.

## Notes
- Always show the draft before sending
- For sensitive topics, suggest reviewing with relevant parties first
- Flag if response might benefit from sleeping on it
- Consider whether response is even needed (sometimes silence is appropriate)
