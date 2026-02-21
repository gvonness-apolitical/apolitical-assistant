# Meeting Prep

Prepare for an upcoming meeting by gathering relevant context from all systems including mapped Slack channels and canvases.

## Usage

- `/prep-meeting` - prep for next meeting on calendar
- `/prep-meeting [name]` - prep for meeting with specific person
- `/prep-meeting [meeting title]` - prep for specific meeting
- `/prep-meeting --resume` - Resume from last completed step if previous run was interrupted
- `/prep-meeting [name] --compete` - Force critique ratchet (pressure-test talking points)
- `/prep-meeting [name] --single` - Force single-agent (override auto-triggers)

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output a checkpoint marker:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary of what was done]

Proceeding to Step N+1: [next step name]
```

**Progress tracking:** Append to `context/YYYY-MM-DD/index.md`
**Resume with:** `/prep-meeting --resume`

## MANDATORY: Required Tools Per Step

| Step | Required Tools | Can Skip |
|------|---------------|----------|
| 1. Identify Meeting | calendar_list_events, Read (people.json) | Never |
| 2. Check Daily Context | Read ×N (context files) | Never |
| 3. Gather Attendee Context | slack_read_dm, slack_read_channel, gmail_search, linear list_issues | Per source on failure |
| 4. Check Notion | notion-search (RFCs, PRDs) | If no Notion context |
| 5. Check Canvas | slack_get_canvas (if 1:1 with canvas) | If no canvas configured |
| 6. Generate Prep | Write (meeting prep file) | Never |
| 7. Update Config | Write (meeting-config.json: set lastPrepDate) | Never |

Each checkpoint must include `Tools:` line with actual tools called and counts.

**lastPrepDate enforcement:** After generating the prep document, update `lastPrepDate` in `.claude/meeting-config.json` for the relevant channel or 1:1 entry. Verify `lastPrepDate` is non-null in the final checkpoint. If still null, the step is incomplete.

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume
- [Person Resolution](../patterns/person-resolution.md) - Resolve attendees to identifiers
- [Local Context First](../patterns/local-context-first.md) - Check caches before API calls
- [Dossier Context](../patterns/dossier-context.md) - Load attendee profiles, playbooks, and dynamics
- [Figma Extraction](../patterns/figma-extraction.md) - Extract Figma links from channels
- [Daily Index Update](../patterns/daily-index-update.md) - Log meeting prep activity
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations
- [Critique Ratchet](../patterns/critique-ratchet.md) - Pressure-test talking points through Draft → Critique → Revise

## Process

### Step 1: Identify Meeting & Attendees

## Attendee Resolution

When preparing for a meeting, resolve attendees using `.claude/people.json`:

1. **Load people.json** and get your identity from `me.slackUserId` for @mention detection
2. **For each attendee**:
   - If email provided → direct lookup in `people[email]`
   - If name only → check `indices.byAlias` (lowercase)
   - Use cached `slackDmChannelId` for DM history
   - Use cached `slackUserId` for Slack searches
   - Use cached metadata (team, role, isDirectReport) for context

3. **Fallback**: If attendee not in cache, search by email in meeting-config.json `oneOnOnes`

```
✓ CHECKPOINT: Step 1 complete - Identify Meeting & Attendees
  Meeting: [name] at [time] | Attendees: [N] | Type: [1:1/group/external]

Proceeding to Step 2: Check Daily Context
```

### Step 2: Check Daily Context

Before making API calls, check local context files:

1. **Today's daily context**: `context/YYYY-MM-DD/index.md`
   - Slack summaries with attendee mentions
   - Email threads with attendees
   - Action items involving attendees
2. **Session context**: `context/YYYY-MM-DD/session.md`
   - Notes about this person/meeting from earlier today
   - Salary/HR information (for 1:1s)
3. **Yesterday's EOD**: `context/eod-YYYY-MM-DD.md`
   - Follow-ups related to attendees
4. **Previous meeting prep**: `meetings/output/*/YYYY-MM-DD-*-prep.md`
5. **MBR (for MBR/MT meetings)**: If the meeting title contains "MBR", "Monthly Business Review", or "Management Team", check `reviews/mbr/` for a generated MBR matching the meeting's month:
   - If found, include summary: "MBR already generated — RAG: [status], key themes: [...]"
   - Link to the Google Doc URL from the MBR frontmatter (`google_doc_url`)
   - Include exception register items as talking points
   - If not found, suggest running `/mbr [month]` before the meeting

Use local context to reduce API calls and provide richer context.

```
✓ CHECKPOINT: Step 2 complete - Check Daily Context
  Local context found: [yes/no] | MBR found: [yes/no/n/a]

Proceeding to Step 3: Gather External Context
```

### Step 3: Gather External Context

### Dossier Context

Before gathering external context, load dossiers for all attendees:

1. **Load dossiers**: Read `.claude/dossiers.json`
2. **For each attendee** (resolved in Step 1):
   - Look up dossier by email
   - If found, extract profile, playbook, and relevant dynamics
3. **For multi-person meetings**: Check `dynamics` entries between pairs of attendees — surface any relevant interpersonal dynamics
4. **For 1:1 meetings (detected in Step 1)**:
   - **Pre-1:1 prompt**: Before showing dossier context, ask: "Any observations to add from your last interaction with [person]? [Add note / Skip]"
   - If the user provides an observation, save it as a new `notes` entry in the attendee's dossier
   - For **direct report** 1:1s: surface `coaching.currentThemes` and recent `coaching.feedbackLog` entries
5. **Include in prep output**: Add an "Attendee Dossier Context" section (see Output below)

If no dossiers exist for attendees, skip silently — dossier context is additive, never blocking.

### Standard Context (All Meetings)

1. **Calendar**: Get meeting details (time, attendees, description, linked docs)
2. **Recent Slack**: Search for conversations with attendees (last 2 weeks)
3. **Linear**: Check for shared tickets or projects with attendees
4. **GitHub**: Recent PRs authored or reviewed by attendees (if engineering)
5. **Previous meetings**: Search for prior meeting notes in `meetings/output/`
6. **Notion Priority Sources** (load from `.claude/notion-sources.json`):
   - **RFCs**: If meeting involves technical topics or engineering decisions
   - **PRDs**: If meeting involves product/feature discussions
   - **Product Roadmap**: If meeting is about planning or priorities
7. **Notion General**: Other docs involving attendees
8. **Asana** (load from `.claude/asana-sources.json`):
   - Tasks shared with or assigned to attendees
   - Relevant Asana projects or goals involving attendees
   - Use `asanaUserId` from people.json for lookups
   - Frame as "cross-functional work" — distinct from Linear engineering tasks

```
✓ CHECKPOINT: Step 3 complete - Gather External Context
  Calendar: ✓ | Slack: [N] msgs | Linear: [N] tickets | GitHub: [N] PRs | Notion: [N] docs

Proceeding to Step 4: Channel/Canvas Context
```

### Step 4: Channel/Canvas Context

#### Channel Context (Named Meetings with Mapping)

If the meeting has a configured channel in `.claude/meeting-config.json`:

1. **Load mapping**: Read `.claude/meeting-config.json` and find channel config
2. **Determine time window**:
   - If `lastPrepDate` exists, use messages since that date
   - Otherwise, find last occurrence of this meeting in calendar
   - Fallback: last 30 days
3. **Gather channel content**:
   - Use `slack_read_channel` for recent messages (up to 100)
   - Use `slack_get_bookmarks` for pinned resources
4. **Read canvas content** (if `canvasId` is configured):
   - Use `slack_get_canvas` with the configured `canvasId`
   - Parse sections: Agenda, Action Items, Notes, Decisions
   - Extract action items assigned to you (use `me.slackUserId` from people.json, or your name)
   - Include current agenda and open action items in prep output
5. **Apply filters** (if configured):
   - Filter by `includeUsers` (if non-empty, only show these users)
   - Exclude messages from `excludeUsers` (e.g., bots)
   - If `excludeThreads` is true, skip thread replies
   - Highlight messages containing `highlightKeywords`
6. **Extract action items** using patterns:
   - `- [ ]` / `- [x]` - Markdown checkboxes
   - `☐` / `☑` - Unicode checkboxes
   - `TODO:` / `ACTION:` keywords
   - `@person will...` patterns
7. **Summarize if needed**:
   - If >50 messages, group by theme and summarize key points
   - Highlight decisions, questions, and blockers
   - **Bold messages containing highlight keywords**
8. **Include in output**:
   - Recent discussion summary (full if <20 messages)
   - Outstanding action items (unchecked)
   - Recently completed items (for reference)
   - Bookmarked resources
   - **Highlighted messages** (containing keywords)
   - **Canvas agenda and action items** (if canvas configured)
9. **Update config**: Set `lastPrepDate` to current time

### Canvas Context (1:1 Meetings with Canvas)

If this is a 1:1 with a configured canvas in `oneOnOnes`:

1. **Load mapping**: Check `oneOnOnes` in meeting config by attendee email
2. **Check attendance**:
   - Note calendar response status (accepted/declined/tentative)
   - Flag any recent reschedules
3. **Read canvas content** (if `canvasId` is configured):
   - Use `slack_get_canvas` with the configured `canvasId`
   - Parse sections: Agenda, Action Items (Open/Completed), Notes, Decisions
4. **Extract my items**:
   - Find action items assigned to me or tagged with my name
   - Categorize as: open, completed, blocked
5. **Interactive prompts**:
   - Show current agenda items from canvas
   - Ask: "Any new agenda items to add?"
   - Show my open tasks from previous meetings
   - Ask: "Any of these tasks completed?"
   - For significant action items, offer to create Linear tickets
6. **Update canvas**:
   - Add new agenda items to Agenda section
   - Mark completed tasks (move to Completed section or strikethrough)
7. **If no canvas configured**:
   - Offer to create one using the template
   - Use `settings.canvasTemplate` or `customTemplate` if set
   - If accepted, use `slack_create_canvas` and update config
8. **Update config**: Set `lastPrepDate` to current time

```
✓ CHECKPOINT: Step 4 complete - Channel/Canvas Context
  Channel msgs: [N] | Canvas items: [N] | Action items: [N]

Proceeding to Step 5: Generate Prep Document
```

### Critique Ratchet Mode

Before generating the prep document, determine whether to use the [Critique Ratchet](../patterns/critique-ratchet.md) pipeline. When active, the Talking Points and suggested questions go through Draft → Critique → Revise to pressure-test them. The ratchet is **invisible** — the user just gets a better prep document.

**Activation:**

| Trigger | Ratchet? |
|---------|---------|
| `--compete` flag | Always yes |
| `--single` flag | Always no (overrides auto) |
| Meeting title contains exec/leadership keywords | Auto-yes |
| Default (no flag, no keyword match) | No — single-agent |

**Exec/leadership keywords** (case-insensitive): "exec", "board", "leadership", "management team", "MT meeting", "SLT"

**How it works:** The ratchet targets the **Talking Points** and **suggested questions** sections specifically — factual sections (Context, Channel Activity, Canvas Status) are data and don't benefit from critique.

1. **Draft** (subagent_type: `general-purpose`): Generate the full prep document as normal (Step 5 output). This is the draft.
2. **Critique** (subagent_type: `general-purpose`, sycophancy-hardened per [Adversarial Debate](../patterns/adversarial-debate.md)):
   ```
   Review the Talking Points and suggested questions from this meeting prep.
   Identify exactly 3 weaknesses. For each:
   1. Cite the specific talking point or question
   2. Explain why it's weak (wrong framing for this audience, missing a more
      important topic, bad sequencing, unsupported assumption, etc.)
   3. Suggest a concrete replacement or improvement

   Do NOT list strengths. Do NOT soften. Your only job is to find the 3
   biggest problems with the talking points.

   MEETING CONTEXT:
   [meeting type, attendees, dossier summaries]

   TALKING POINTS TO CRITIQUE:
   [draft talking points and questions]
   ```
3. **Revise** (subagent_type: `general-purpose`):
   ```
   Below are meeting talking points and 3 critiques. For each critique:
   (a) Fix the issue in the revised talking points, OR
   (b) Write a 1-sentence justification for why the original should stand

   Then produce the complete revised Talking Points and suggested questions.

   ORIGINAL TALKING POINTS:
   [draft talking points]

   CRITIQUES:
   [critic output]
   ```

All agents receive context as prompt text — they do NOT have MCP tool access.

The revised talking points replace the draft in the final prep document. After completion, emit a Causantic event:
```
[compete-ratchet: skill=prep-meeting, meeting=MEETING_NAME, critiques_addressed=N, critiques_justified=N]
```

### Step 5: Generate Prep Document

**If critique ratchet is active**: Generate the full prep document first (draft), then run the Talking Points through the Critique → Revise pipeline above. The revised talking points replace the draft in the saved document.

**If single-agent mode** (default): Generate the prep document as normal.

## Message Filtering

When a channel has filters configured:

### Include Users Filter
```json
"includeUsers": ["alice@company.com", "bob@company.com"]
```
- Only messages from these users are shown
- Empty array = show all users

### Exclude Users Filter
```json
"excludeUsers": ["slackbot@company.com", "github-bot@company.com"]
```
- Messages from these users are hidden
- Useful for filtering out noisy bots

### Highlight Keywords
```json
"highlightKeywords": ["decision", "blocker", "urgent", "TODO", "IMPORTANT"]
```
- Messages containing these keywords are highlighted in output
- Shown in a separate "Highlighted Messages" section
- Case-insensitive matching

### Exclude Threads
```json
"excludeThreads": true
```
- Only show top-level messages
- Skip all thread replies
- Useful for high-volume channels

## Action Item Patterns

When extracting action items from messages or canvas content:

```
Unchecked patterns:
- [ ] Task description
☐ Task description
TODO: Task description
ACTION: Task description
@person will do something

Checked patterns:
- [x] Task description
☑ Task description
DONE: Task description
```

## Linear Integration

For significant action items discovered:

1. **Detect ticket-worthy items**:
   - Multi-step work mentioned
   - Assigned to specific person
   - Has deadline or urgency
   - Relates to existing project

2. **Determine project**:
   - Use `linearProject` from 1:1 config if set
   - Fall back to `settings.linearProject` if set
   - Otherwise, prompt for project selection

3. **Offer creation**:
   ```
   Found action item that might warrant a Linear ticket:
   "Build out the new onboarding flow for contractors"
   Create Linear ticket? (y/N)
   Project: [eng-team]
   ```

4. **If creating**:
   - Create ticket with title, description, and assignee
   - Link source (Slack message or canvas)
   - **Automatically update canvas** with ticket link:
     ```
     - [ ] Build out onboarding flow → [ENG-123](https://linear.app/...)
     ```

5. **Track created tickets**:
   - Include in meeting prep output
   - Show in "Linear Tickets Created" section

### Automatic Canvas Linking

When a Linear ticket is created from a canvas action item:

1. **Find the action item** in the canvas content
2. **Append the ticket link** to the action item line:
   ```markdown
   Before: - [ ] Build onboarding flow for contractors
   After:  - [ ] Build onboarding flow for contractors → [ENG-123](https://linear.app/team/issue/ENG-123)
   ```
3. **Use `slack_update_canvas`** to apply the change
4. **Confirm update** in output:
   ```
   ✓ Created ENG-123: Build onboarding flow for contractors
   ✓ Updated canvas with ticket link
   ```

## Output

Create a meeting prep note with:

### Context
- What's this meeting about
- Who's attending and their roles
- Any relevant background

### Attendee Dossier Context (if dossiers exist)
For each attendee with a dossier:
- **Communication style**: How they prefer to communicate
- **Key sensitivities**: Topics to handle carefully
- **Effective frames**: What works with this person
- **Avoid**: Approaches that trigger defensiveness
- **Dynamics** (multi-person meetings): Notable dynamics between attendees
- **Coaching themes** (DR 1:1s): Current development areas and recent feedback

### Channel Activity (if mapped)
- Summary of discussions since last meeting
- Key decisions made
- Questions raised
- Bookmarked resources
- **Highlighted messages** (if keywords configured)

### Canvas Status (if canvas configured)
- Current agenda items from canvas
- Open action items (mine highlighted using `me.slackUserId` from people.json)
- Recently completed items
- Blocked items to discuss
- **Linked Linear tickets**
- Works for both 1:1s (`oneOnOnes.canvasId`) and channel meetings (`channels.canvasId`)

### Recent Activity
- What we've been discussing/working on together
- Any decisions or changes since last meeting

### Talking Points
- Suggested topics based on open items
- Questions to ask or clarify
- Blocked items needing discussion

### Action Items
- Outstanding items to follow up on
- Decisions needed
- **Linear tickets created this session** (with links)

Save to `meetings/output/[meeting-type]/YYYY-MM-DD-[attendee-or-title]-prep.md`

Meeting types: `one-on-ones/`, `squad/`, `planning/`, `external/`, `general/`

```
✓ CHECKPOINT: Step 5 complete - Generate Prep Document
  Saved to: meetings/output/[type]/YYYY-MM-DD-[name]-prep.md
```

## Final Summary

After ALL 5 steps complete, display:

```
# Meeting Prep Complete - YYYY-MM-DD

## Steps Completed
✓ 1. Identify Meeting    ✓ 2. Check Local Context    ✓ 3. Gather External
✓ 4. Channel/Canvas      ✓ 5. Generate Prep

## Key Results
- **Meeting**: [name] at [time]
- **Attendees**: [N]
- **Action items found**: [N] (mine: [N])
- **Talking points generated**: [N]
- **Linear tickets created**: [N]

## Saved to
meetings/output/[type]/YYYY-MM-DD-[name]-prep.md

---
Meeting prep complete.
```

## Error Handling

If any step fails:
1. Log the error and step number
2. **Save progress** to daily context
3. Continue with remaining steps if possible
4. Note the failure in the final summary
5. Suggest: "Resume with: /prep-meeting --resume"

### Resume Behavior

When `/prep-meeting --resume` is run:
1. Check daily context for incomplete meeting prep
2. Skip completed steps
3. Resume from first incomplete step
4. Continue through remaining steps

## Figma Link Extraction

While reading channel content and canvases, extract and persist any Figma links to `.claude/figma-sources.json`.

### When to Extract

- Reading channel messages for meeting context
- Reading canvas content
- Processing DM history with attendees

### Extraction Process

Same as `/slack-read`:

1. **Detect Figma URLs** in message/canvas content:
   - `figma.com/design/[fileKey]/...`
   - `figma.com/board/[fileKey]/...`
   - `figma.com/file/[fileKey]/...`

2. **Parse and capture**:
   - fileKey, type, name, nodeId
   - Owner (message author)
   - Channel/canvas source
   - Date shared

3. **Update figma-sources.json**:
   - Add new entries or update existing
   - Cross-reference with people.json for owner email
   - Infer category from channel context

### Meeting Context

For meeting-related Figma files:
- Tag with meeting name in description
- Note if file is actively discussed (multiple shares)
- Include in meeting prep output under "Related Resources"

### Output

Include in meeting prep:

```markdown
## Related Figma Files

| File | Last Shared | By |
|------|-------------|-----|
| [Design spec](url) | 2026-01-28 | Tri |
| [User flow](url) | 2026-01-25 | Lowell |
```

## Notes

- For 1:1s, also check Humaans for any time off or role changes
- For engineering meetings, weight GitHub/Linear context higher
- Flag any incidents involving attendees' teams
- If meeting has no channel mapping, suggest running `/setup-meeting-channels`
- Always update `lastPrepDate` after successful prep
- Canvas updates require confirmation before writing
- Linear ticket links are automatically added to canvas action items
- **Figma links are automatically extracted and persisted to figma-sources.json**

## Configuration File

Expects `.claude/meeting-config.json`:

```json
{
  "settings": {
    "canvasTemplate": "# Agenda\\n...",
    "autoRefreshDays": 30,
    "linearProject": "default-project"
  },
  "channels": {
    "Platform Retro": {
      "channelId": "C0123456789",
      "channelName": "#platform-retro",
      "canvasId": "F0123456789",
      "canvasName": "Agenda",
      "lastPrepDate": "2026-01-15T10:00:00Z",
      "filters": {
        "includeUsers": [],
        "excludeUsers": ["bot@company.com"],
        "highlightKeywords": ["decision", "blocker"],
        "excludeThreads": false
      }
    }
  },
  "oneOnOnes": {
    "joel.patrick@apolitical.co": {
      "displayName": "Joel Patrick",
      "dmChannelId": "D0123456789",
      "canvasId": "F0123456789",
      "canvasName": "121 Agenda Items",
      "lastPrepDate": "2026-01-22T15:30:00Z",
      "linearProject": "eng-team",
      "customTemplate": null
    }
  }
}
```

Run `/setup-meeting-channels` to configure mappings.
Run `/setup-meeting-channels --refresh` to detect new recurring meetings.
Run `/setup-meeting-channels --template` to customize the canvas template.
