# Schedule Meeting

Intelligently schedule a meeting by finding optimal times and booking rooms.

## Usage
- `/schedule-meeting [attendees] [topic]` - find time and schedule
- `/schedule-meeting [attendees] [topic] [duration]` - specify duration (default 30min)
- `/schedule-meeting [attendees] [topic] [duration] [in-office]` - book room if in-office

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve attendee names to emails
- [Error Handling](../patterns/error-handling.md) - Handle calendar API issues

## Process

### 1. Parse Requirements
- Attendees (names or emails)
- Meeting topic/purpose
- Duration (default: 30 minutes)
- Location preference (remote, in-office, hybrid)
- Urgency (this week, next 2 weeks, flexible)
- Time preferences if any (morning, afternoon, specific days)

### 2. Resolve Attendees

Use `.claude/people.json` to resolve attendee names to emails:

1. **For each attendee name**:
   - Check `indices.byAlias` with lowercase name
   - Get email from resolved person
2. **For external contacts**: Check `contacts` section
3. **If not found**: Assume the input is already an email, or prompt for clarification
4. **Get context**: Use cached `metadata.role` and `metadata.team` for scheduling notes

### 3. Gather Availability

**Get Calendar IDs**:
- Use `calendar_list_calendars` to find attendee calendars
- Identify meeting room calendars if in-office

**Check Freebusy**:
- Use `calendar_get_freebusy` for all attendees
- Check room availability if needed
- Look at next 2 weeks of availability

### 4. Find Optimal Slots

Score potential slots based on:
- All attendees available (required)
- Respects working hours (9am-6pm local)
- Avoids lunch hours (12-1pm) unless necessary
- Prefers mornings for important meetings
- Avoids back-to-back with other meetings when possible
- Considers travel time if in-office

### 5. Present Options

Show top 3-5 options with:
- Date and time
- Availability confidence (all clear vs some might conflict)
- Room availability (if in-office)
- Any considerations (e.g., "Day before Alice's holiday")

### 6. Create Event

Once time is selected, use `calendar_create_event` with:
- Title: Clear meeting name
- Attendees: All required participants
- Location: Room name or "Google Meet"
- Description: Meeting purpose and any prep needed
- Conference: Add Google Meet link for remote/hybrid

## Output Structure

### Meeting Request
- Topic: [topic]
- Duration: [X minutes]
- Attendees: [list]
- Location: [remote/in-office/hybrid]

### Availability Analysis
Summary of each attendee's calendar density

### Recommended Times
| Option | Date/Time | Room | Notes |
| 1 | Mon 10:00am | Available | All clear, good morning slot |
| 2 | Tue 2:00pm | Room A | Bob has meeting ending at 1:45 |
| 3 | Wed 11:00am | Available | Alice prefers mornings |

### Selected: [Option X]

### Event Created
- Link: [calendar link]
- Attendees notified: Yes/No

## Room Booking

When in-office is specified:
1. List available meeting rooms from calendar
2. Match room size to attendee count
3. Check room availability for proposed times
4. Book room as part of event creation

## Notes
- Always confirm before creating the event
- For large groups, may need to accept partial availability
- Consider time zones for distributed attendees
- Flag if someone has OOO during proposed times
- Suggest async alternatives if finding time is difficult
