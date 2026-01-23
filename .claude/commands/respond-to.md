# Respond To

Draft a response to an email, Slack message, PR comment, or Linear ticket.

## Usage
- `/respond-to [email message ID]` - draft email reply
- `/respond-to [slack thread URL]` - draft Slack response
- `/respond-to [PR URL]` - draft PR review or comment
- `/respond-to [Linear ticket ID]` - draft ticket comment

## Process

### 1. Gather Context
- Fetch the full thread/conversation
- Identify participants and their roles
- Check for related items (linked tickets, docs, previous discussions)
- Review recent interactions with the person

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
