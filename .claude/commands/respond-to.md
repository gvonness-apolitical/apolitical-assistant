# Respond To

Draft a response to an email, Slack message, PR comment, or Linear ticket.

## Usage
- `/respond-to [email message ID]` - draft email reply
- `/respond-to [slack thread URL]` - draft Slack response
- `/respond-to [PR URL]` - draft PR review or comment
- `/respond-to [Linear ticket ID]` - draft ticket comment

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve message author
- [Dossier Context](../patterns/dossier-context.md) - Load communication profile and playbook

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

### 4. Draft Response

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

### Summary
Brief summary of what's being responded to

### Key Points to Address
- List of items that need response

### Draft Response
The actual draft text

### Tone Check
Assessment of tone (too formal, too casual, appropriate)

### Alternative Approaches
Other ways to respond if the situation is delicate

### Before Sending
- [ ] Addressed all points raised
- [ ] Tone is appropriate
- [ ] No sensitive info disclosed
- [ ] Right people included/excluded

## Notes
- Always show the draft before sending
- For sensitive topics, suggest reviewing with relevant parties first
- Flag if response might benefit from sleeping on it
- Consider whether response is even needed (sometimes silence is appropriate)
