# Meeting Prep

Prepare for an upcoming meeting by gathering relevant context.

## Usage
- `/prep-meeting` - prep for next meeting on calendar
- `/prep-meeting [name]` - prep for meeting with specific person
- `/prep-meeting [meeting title]` - prep for specific meeting

## Gather Context

1. **Calendar**: Get meeting details (time, attendees, description, linked docs)
2. **Recent Slack**: Search for conversations with attendees (last 2 weeks)
3. **Linear**: Check for shared tickets or projects with attendees
4. **GitHub**: Recent PRs authored or reviewed by attendees (if engineering)
5. **Previous meetings**: Search for prior meeting notes in `meetings/output/`
6. **Notion**: Search for relevant docs or RFCs involving attendees

## Output

Create a meeting prep note with:

### Context
- What's this meeting about
- Who's attending and their roles
- Any relevant background

### Recent Activity
- What we've been discussing/working on together
- Any decisions or changes since last meeting

### Talking Points
- Suggested topics based on open items
- Questions to ask or clarify

### Action Items
- Outstanding items to follow up on
- Decisions needed

Save to `meetings/output/[meeting-type]/YYYY-MM-DD-[attendee-or-title]-prep.md`

Meeting types: `one-on-ones/`, `squad/`, `planning/`, `external/`, `general/`

## Notes
- For 1:1s, also check Humaans for any time off or role changes
- For engineering meetings, weight GitHub/Linear context higher
- Flag any incidents involving attendees' teams
