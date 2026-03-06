# Quick Status

Get a rapid status check of high-priority items with targeted API calls. Designed for mid-day check-ins when you need to know "is anything on fire?" without a full orient.

## Usage

- `/quick-status` - Quick status check (~60 seconds)

## How This Differs from /orient

| | `/orient` | `/orient --quick` | `/quick-status` |
|---|---|---|---|
| API calls | All systems | None (cache only) | Targeted (5 calls) |
| Output | Full snapshot | Cached snapshot | One-screen summary |
| Context files | Writes orient file | Reads cache only | No file output |
| Tasks created | No | No | No |
| Checkpoints | No | No | No |
| Time | 2-5 min | <2 sec | <60 sec |

## Process

Run these 5 checks and present results in a single compact view:

### 1. Active Incidents (excl. SLO)

Call `incidentio_list_incidents` with status filter for active/investigating.
- Exclude titles containing "SLO burn", "burn rate", or "SLO" (case-insensitive)
- Show: severity, title, duration

### 2. VIP Unread Emails

Call `gmail_search` with query: `is:unread in:inbox`
- Cross-reference senders against `senderTiers.exec` and `senderTiers.directReports` from `.claude/email-rules.json`
- Show: count of VIP emails, sender names

### 3. Priority DMs

Load `.claude/people.json` for boss and direct report IDs.
Call `slack_list_dms` with `types: 'im'`, then `slack_read_dm` for boss + direct reports only (skip if no unread).
- Show: unread DM count from priority people, brief preview

### 4. Calendar — Next 2 Hours

Call `calendar_list_events` with timeMin=now, timeMax=now+2h.
- Show: upcoming meetings with time and attendees

### 5. One-Liner Recommendation

Based on the above:
- If active incident: "Active incident — check #incidents"
- If VIP email waiting >4h: "Respond to [person]'s email"
- If meeting in <15min: "Prep for [meeting] starting soon"
- If clear: "All clear — deep work time"

## Output Format

```
# Status Check - HH:MM

Incidents: [N active / clear]  |  VIP Email: [N unread / clear]  |  Priority DMs: [N / clear]

## Next 2h
- 14:00 Samuel 1:1
- 15:30 Platform Standup

## Action
[One-liner recommendation]
```

## Notes

- No context file output — this is ephemeral
- No tasks created — use /orient or /begin-day for that
- No checkpoints — single-pass execution
- Load people.json and email-rules.json at start for sender resolution
- If any API call fails, show "unavailable" for that section and continue
