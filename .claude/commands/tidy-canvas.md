# Tidy Canvas

Clean up and organize a Slack canvas to align with the standard schema, archive old items, and prepare for the next meeting.

## Usage

- `/tidy-canvas` - Tidy the canvas for next upcoming 1:1
- `/tidy-canvas [person]` - Tidy the canvas for a specific 1:1
- `/tidy-canvas [channel]` - Tidy a canvas in a specific channel
- `/tidy-canvas --all` - Tidy all configured canvases

## Workflow

### 1. Identify Canvas

1. **If person specified**:
   - Look up in `oneOnOnes` config by name or email
   - Get `canvasId` from config
2. **If channel specified**:
   - Look up in `channels` config
   - Use `slack_list_canvases` to find canvas in channel
3. **If no argument**:
   - Find next 1:1 on calendar
   - Look up canvas from config

### 2. Check for Standalone Canvases

Use `slack_list_canvases` to find all canvases in the channel/DM. Each canvas will be marked as either `channel_canvas` or `standalone`.

**If standalone canvases found:**

1. **List what was found**:
   ```
   Found canvases in DM with Joel Patrick:
   ─────────────────────────────────────────

   Channel Canvas: (none)

   Standalone Canvases:
     1. "121 Agenda Items" (F0ABC123) - last updated 2026-01-20
     2. "Meeting Notes" (F0DEF456) - last updated 2026-01-15

   Standalone canvases should be migrated to a channel canvas for consistency.
   ```

2. **Read each standalone canvas** using `slack_get_canvas`

3. **Merge content by section**:
   - Parse sections from each standalone canvas
   - Combine same-named sections (Agenda + Agenda, Notes + Notes, etc.)
   - Archive old/completed items as per normal rules
   - If sections conflict, show diff and ask user which to keep

4. **Create or update channel canvas**:
   - If no channel canvas exists: use `slack_create_canvas` with `channel_id` to create one
   - If channel canvas exists: merge standalone content into it

5. **Preview migration**:
   ```
   Migration Preview for 1:1 with Joel Patrick
   ─────────────────────────────────────────────

   Will create channel canvas with merged content from:
     - "121 Agenda Items" (standalone)
     - "Meeting Notes" (standalone)

   Merged sections:
     # Agenda: 4 items (2 from each canvas)
     # Action Items: 6 open, 3 completed → archive
     # Notes: Combined, older notes archived
     # Decisions: 2 decisions preserved

   After migration, delete standalone canvases? (Y/n)
   ```

6. **Delete standalone canvases** (only after user confirmation):
   - Use Slack API to delete each migrated standalone canvas
   - Report which were deleted

**If only channel canvas exists:**
- Skip migration, proceed to step 3

**If no canvases exist:**
- Create new channel canvas with template (see step 6)
- Proceed to step 9 (done)

### 3. Read Current Canvas

1. Use `slack_get_canvas` to fetch content
2. Parse existing sections using headers (`#`, `##`)
3. Identify content blocks:
   - Agenda items
   - Open action items (unchecked)
   - Completed action items (checked)
   - Notes content
   - Decisions made
   - Any unrecognized sections

### 4. Categorize Content

**Agenda Items**:
- Items under `# Agenda` section
- Determine if item was discussed (has notes/follow-up)
- Flag items that look stale (>2 meetings old)

**Action Items**:
- Parse checkbox patterns: `- [ ]`, `- [x]`, `☐`, `☑`
- Categorize as: open, completed, blocked
- Extract assignee if present (`@person`, `[Person]`)
- Extract due date if present
- Identify Linear ticket links (`→ [XXX-123]`)

**Notes**:
- Content under `# Notes` section
- Group by date if dates are present
- Identify decisions embedded in notes

**Decisions**:
- Content under `# Decisions` section
- Extract date if present

### 5. Archive Old Content

Move to `# History` section (create if doesn't exist):

1. **Completed action items**:
   - All checked/completed items
   - Format: `- [x] Task description (completed YYYY-MM-DD)`
   - Preserve Linear ticket links

2. **Old agenda items**:
   - Items marked as discussed
   - Items older than configurable threshold (default: last meeting)
   - Format: `- ~~Agenda item~~ (discussed YYYY-MM-DD)`

3. **Old notes**:
   - Notes from previous meetings (if dated)
   - Collapse into summary if >500 chars per meeting

4. **Old decisions**:
   - Keep in Decisions section (decisions are permanent)
   - Add date prefix if not present

### 6. Reorganize Structure

Ensure canvas follows standard template structure:

```markdown
# Agenda
_Items to discuss next meeting_

[Current/upcoming agenda items]

# Action Items

## Open
[Unchecked items, sorted by assignee]

## Blocked
[Items marked as blocked]

# Notes
_Meeting notes and context_

[Recent notes, last 1-2 meetings]

# Decisions
_Decisions made and rationale_

[All decisions with dates]

# History
_Archived items from previous meetings_

## Completed Actions
[Checked items with completion dates]

## Previous Agendas
[Old agenda items]

## Previous Notes
[Collapsed older notes]
```

### 7. Apply Formatting Fixes

- **Normalize checkboxes**: Convert `☐`/`☑` to `- [ ]`/`- [x]`
- **Add missing dates**: Add today's date to undated items being archived
- **Fix broken links**: Validate and fix Linear ticket links
- **Remove duplicates**: Dedupe action items that appear multiple times
- **Sort action items**: Group by assignee, then by date
- **Trim whitespace**: Remove excessive blank lines
- **Fix heading levels**: Ensure consistent `#`/`##` usage

### 8. Preview Changes

Before updating, show diff:

```
Canvas Tidy Preview for 1:1 with Joel Patrick
─────────────────────────────────────────────

Moving to History:
  - [x] Set up new CI pipeline → [ENG-456]
  - [x] Review RFC for auth changes
  - ~~Discuss Q1 objectives~~ (discussed)

Keeping in Agenda:
  - Onboarding plan for new hire
  - Budget discussion for tooling

Open Action Items (reorganized):
  @Greg:
    - [ ] Draft job description
    - [ ] Review compensation bands
  @Joel:
    - [ ] Schedule team offsite

Formatting fixes:
  - Converted 3 unicode checkboxes to markdown
  - Added dates to 2 archived items
  - Removed 1 duplicate action item

Apply changes? (Y/n)
```

### 9. Update Canvas

1. Get user confirmation
2. Use `slack_update_canvas` to apply changes
3. Report success with summary

## Configuration

Uses settings from `.claude/meeting-config.json`:

```json
{
  "settings": {
    "canvasTemplate": "...",
    "archiveAfterDays": 14,
    "collapseNotesAfterMeetings": 2
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `archiveAfterDays` | 14 | Archive completed items older than this |
| `collapseNotesAfterMeetings` | 2 | Collapse notes older than N meetings |

## Section Detection Patterns

The skill recognizes these section headers (case-insensitive):

| Standard Name | Also Matches |
|---------------|--------------|
| `# Agenda` | `# Topics`, `# Discussion`, `# Items` |
| `# Action Items` | `# Actions`, `# Tasks`, `# TODOs`, `# Follow-ups` |
| `# Notes` | `# Meeting Notes`, `# Discussion Notes` |
| `# Decisions` | `# Agreed`, `# Outcomes` |
| `# History` | `# Archive`, `# Previous`, `# Past` |

## Edge Cases

### Canvas doesn't match template
- Create missing sections
- Move unrecognized content to Notes
- Prompt before major restructuring

### Empty canvas
- Initialize with template
- Add placeholder text

### Very long history
- Offer to truncate history older than 90 days
- Suggest exporting to a separate document

### Canvas has custom sections
- Preserve custom sections after standard ones
- Don't move custom section content

### Shared canvas with external person
- Note that changes will be visible to them
- Require explicit confirmation

## Output

After tidying:

```
Canvas tidied for 1:1 with Joel Patrick
───────────────────────────────────────

Archived:
  - 5 completed action items
  - 3 discussed agenda items
  - Notes from 2 previous meetings

Current state:
  - 2 agenda items for next meeting
  - 4 open action items (2 yours, 2 theirs)
  - 0 blocked items
  - 3 decisions recorded

Canvas URL: https://slack.com/docs/F0123456789
```

## Notes

- Always preview changes before applying
- Preserve Linear ticket links when archiving
- Don't archive items less than 24 hours old
- Keep last 2 meetings of notes visible by default
- Custom sections are preserved but moved to end
- Run automatically as part of `/prep-meeting` if canvas is messy
