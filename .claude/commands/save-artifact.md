# Save Artifact

Save conversation output to the appropriate location with proper formatting.

## Usage

- `/save-artifact` - Interactive mode, prompts for type and title
- `/save-artifact investigation "API Analysis"` - Direct mode with type and title
- `/save-artifact work "CV Review Summary"` - Save as work product
- `/save-artifact rubberduck "Auth Strategy"` - Save as thinking session
- `/save-artifact reference "API Endpoints"` - Save as reference doc

## Purpose

Provide a consistent way to save conversation outputs as artifacts, using the appropriate template and location for each type.

## Artifact Types

| Type | Directory | Use Case |
|------|-----------|----------|
| `investigation` | `investigations/` | Research, analysis, deep dives |
| `work` | `work/` | Deliverables, drafts, external outputs |
| `rubberduck` | `rubberduck/` | Thinking sessions, strategy exploration |
| `reference` | `reference/` | Evergreen documentation |
| `session` | `context/YYYY-MM-DD/` | Session notes (internal) |

## Process

### Interactive Mode

When invoked without arguments:

```
What type of artifact is this?

[1] Investigation - Research, analysis, findings
[2] Work Product - Deliverable for external use
[3] Rubberduck - Thinking/strategy session
[4] Reference - Evergreen documentation
[5] Session Notes - Internal context

Choice:
```

Then prompt for title:
```
Title (will be slugified for filename):
>
```

### Direct Mode

Parse arguments: `/save-artifact <type> "<title>"`

Valid types: `investigation`, `work`, `rubberduck`, `reference`, `session`

### Content Selection

Ask what to save:
```
What content should be saved?

[1] Last response - Save my previous response
[2] Full conversation - Save entire conversation summary
[3] Custom - I'll specify what to include

Choice:
```

For "Custom":
```
Describe what content to include, or paste/reference specific outputs:
>
```

### Generate Artifact

1. **Load Template**: Read from `.claude/templates/[type].md`

2. **Populate Fields**:
   - `{{DATE}}` → Current date (YYYY-MM-DD)
   - `{{TITLE}}` → User-provided title
   - Other placeholders filled from content

3. **Generate Filename**:
   - Slugify title: lowercase, replace spaces with hyphens, remove special chars
   - Pattern: `YYYY-MM-DD-[slug].md` (except reference: `[slug].md`)
   - Example: "API Analysis" → `2026-01-27-api-analysis.md`

4. **Prompt for Metadata**:
   ```
   Optional metadata (press Enter to skip each):

   Tags (comma-separated): api, integration, humaans
   Related files: investigations/2026-01-25-similar-topic.md
   Status [draft/final]: final
   Stakeholders: Joel, Byron
   ```

5. **Preview**:
   ```
   Ready to save:

   File: investigations/2026-01-27-api-analysis.md
   Type: investigation
   Title: API Analysis
   Tags: api, integration, humaans

   Preview:
   ---
   type: investigation
   date: 2026-01-27
   tags: [api, integration, humaans]
   related: [investigations/2026-01-25-similar-topic.md]
   status: final
   ---

   # API Analysis

   ## Context
   ...

   [Save] [Edit title] [Change type] [Cancel]
   ```

6. **Write File**:
   - Create file at appropriate location
   - Confirm success
   - Offer to open in editor

### Output

```
Artifact saved: investigations/2026-01-27-api-analysis.md

Type: investigation
Tags: api, integration, humaans
Status: final

Open in editor? [y/n]
```

## Templates

Templates are loaded from `.claude/templates/`:

- `investigation.md` - Research and analysis
- `work-product.md` - Deliverables
- `rubberduck.md` - Thinking sessions
- `briefing.md` - Daily briefings (for reference)
- `weekly-review.md` - Weekly reviews (for reference)
- `meeting-prep.md` - Meeting prep (for reference)
- `context-index.md` - Daily context index (for reference)

Each template includes YAML frontmatter with placeholders.

## Filename Generation

```
Input: "Humaans API Integration Analysis"
Output: humaans-api-integration-analysis

Rules:
- Lowercase all characters
- Replace spaces with hyphens
- Remove special characters except hyphens
- Collapse multiple hyphens
- Trim leading/trailing hyphens
- Max length: 50 characters (truncate at word boundary)
```

## Edge Cases

### File Already Exists

```
File already exists: investigations/2026-01-27-api-analysis.md

[1] Overwrite
[2] Append timestamp (api-analysis-1430.md)
[3] Edit title
[4] Cancel
```

### Reference Files (No Date Prefix)

Reference files don't include date in filename:
- `reference/api-endpoints.md` (not `2026-01-27-api-endpoints.md`)

If reference file exists:
```
Reference file already exists: reference/api-endpoints.md

[1] Update existing (merge/replace content)
[2] Create new with date suffix
[3] Cancel
```

### Empty Content

If selected content is empty or minimal:
```
Warning: Content appears to be empty or very short.
Are you sure you want to create this artifact? [y/n]
```

### Session Context (Special Handling)

Session notes go into day directories:
- Create `context/YYYY-MM-DD/` if doesn't exist
- Write to `context/YYYY-MM-DD/session.md`
- If session.md exists, append with timestamp separator

## Proactive Suggestions

When substantial content is generated during a conversation, suggest saving:

**Trigger Conditions**:
- Response contains >500 words of structured analysis
- Response includes pros/cons or recommendations
- Response synthesizes information from multiple sources
- Response creates a work product (draft, summary, etc.)

**Suggestion Format**:
```
---
I've completed [description]. Would you like me to save this?

Suggested: work/2026-01-27-data-lead-cv-review.md

[Save] [Save elsewhere] [Don't save]
```

**When NOT to Suggest**:
- Simple Q&A responses
- Status checks or lookups
- Content already being saved by a skill
- User explicitly declined saving earlier in session

## Notes

- All artifacts include YAML frontmatter for searchability
- Templates ensure consistent structure across artifact types
- Slugified filenames enable easy navigation and linking
- Metadata makes artifacts discoverable and relatable
