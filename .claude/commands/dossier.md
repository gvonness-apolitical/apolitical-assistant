# Dossier

View, update, and manage professional dossiers — structured profiles capturing communication style, sensitivities, motivations, playbook, and coaching context for key people.

## Usage

- `/dossier [person]` - View dossier for a person
- `/dossier [person] --update` - Add notes or update profile fields
- `/dossier --populate` - Initial population pass (interactive, seed from artifacts then guided)
- `/dossier --review` - Review and refresh stale dossiers (>30 days since last update)

## Core Patterns Used

- [Person Resolution](../patterns/person-resolution.md) - Resolve names to email keys
- [Dossier Context](../patterns/dossier-context.md) - Load and format dossier data

## Data Store

Dossiers are stored in `.claude/dossiers.json`, keyed by email (same as people.json). The file is encrypted via git-crypt.

### Schema

```json
{
  "version": 1,
  "lastUpdated": "2026-02-19",
  "dossiers": {
    "person@apolitical.co": {
      "displayName": "Person Name",
      "relationship": "direct-report | peer | manager | exec | external",
      "profile": {
        "communicationStyle": "Free text",
        "decisionMaking": "Free text",
        "motivations": "Free text",
        "sensitivities": "Free text",
        "strengths": "Free text",
        "growthAreas": "Free text",
        "workingRelationship": "Free text"
      },
      "playbook": {
        "effectiveFrames": ["Framing strategies that land well"],
        "avoidPatterns": ["Approaches that trigger defensiveness"],
        "knownTriggers": ["Topics requiring careful handling"]
      },
      "dynamics": [
        {
          "with": "other.person@apolitical.co",
          "note": "Relationship dynamic between these two"
        }
      ],
      "coaching": {
        "currentThemes": ["Active development areas"],
        "feedbackLog": [
          {
            "date": "2026-02-19",
            "topic": "Theme name",
            "note": "What was discussed, agreed, how it landed"
          }
        ]
      },
      "notes": [
        {
          "date": "2026-02-19",
          "context": "e.g. '1:1', 'slack exchange', 'incident response'",
          "note": "Observation or insight"
        }
      ],
      "lastUpdated": "2026-02-19"
    }
  }
}
```

## Commands

### View: `/dossier [person]`

1. Resolve person to email using person-resolution pattern
2. Load `.claude/dossiers.json`
3. Look up dossier by email
4. **If found**: Display profile, playbook, dynamics, coaching (if DR), and last 5 notes
5. **If not found**: Report "No dossier for [person]. Create one with `/dossier [person] --update`"

**Output format:**

```markdown
# Dossier: [Display Name]

**Relationship:** [relationship] | **Last updated:** [date]

## Profile
- **Communication style:** [text]
- **Decision making:** [text]
- **Motivations:** [text]
- **Sensitivities:** [text]
- **Strengths:** [text]
- **Growth areas:** [text]
- **Working relationship:** [text]

## Playbook
**Effective frames:**
- [frame]

**Avoid:**
- [pattern]

**Known triggers:**
- [trigger]

## Dynamics
- ↔ [Person B]: [note]

## Coaching (direct reports only)
**Current themes:** [themes]
**Recent feedback:**
- [date] [topic]: [note]

## Recent Notes
- [date] ([context]): [note]
```

### Update: `/dossier [person] --update`

Interactive update flow:

1. Resolve person to email
2. Load existing dossier (or create new entry)
3. Ask what to update:

```
What would you like to update for [person]?

[1] Add a note (observation from recent interaction)
[2] Update profile field (communication style, sensitivities, etc.)
[3] Update playbook (effective frames, avoid patterns, triggers)
[4] Add/update dynamics (relationship with another person)
[5] Update coaching themes or add feedback log entry (DRs only)
```

4. For each selection, prompt for the content
5. Write updated dossier to `.claude/dossiers.json`
6. Update `lastUpdated` on both the entry and the file
7. Emit Causantic summary: `[Dossier updated: Person Name — [brief description of change]]`

**Creating a new dossier:**

If no dossier exists for the person:

1. Get `displayName` from people.json
2. Ask for `relationship` type
3. Create skeleton entry with empty fields
4. Proceed with the selected update type

### Populate: `/dossier --populate`

Guided initial population, run in two phases.

#### Phase 1: Seed from Existing Artifacts

Before asking for any manual input, scan existing files for stakeholder observations:

1. **Scan `rubberduck/` files**:
   - Read YAML frontmatter for `stakeholders` field
   - For each file with stakeholders, extract relevant observations
   - Look for patterns: behaviour analysis, communication observations, dynamic descriptions

2. **Scan `investigations/` files**:
   - Same frontmatter scan
   - Extract analysis relevant to named people

3. **Scan `work/` files** (e.g. talking points, meeting prep):
   - Look for files with person names in the filename or stakeholders in frontmatter
   - Extract framing insights, playbook-style observations

4. **Present extracted observations grouped by person**:
   ```
   ## Found observations for Joel Patrick

   ### From rubberduck/2026-02-19-structural-ceiling.md:
   > [extracted observation about communication style]
   > [extracted observation about defensive patterns]

   ### From work/2026-02-19-joel-121-talking-points.md:
   > [extracted framing insight]

   Accept these into Joel's dossier? [Edit / Accept / Reject]
   ```

5. For accepted observations, map to appropriate dossier fields:
   - Communication observations → `profile.communicationStyle`
   - Defensive patterns → `profile.sensitivities`, `playbook.avoidPatterns`
   - Framing insights → `playbook.effectiveFrames`
   - Behaviour analysis → `notes` entries
   - Relationship observations → `dynamics`

6. Save confirmed observations

#### Phase 2: Priority People (Manual, Guided)

For remaining priority people without dossiers:

1. **Direct reports** (~11 people from people.json where `isDirectReport: true`):
   - Most coaching value
   - Include coaching themes
   - Ask for: communication style, motivations, strengths, growth areas, current coaching themes

2. **Manager** (Joel):
   - Most strategic value
   - Focus on playbook
   - Ask for: communication style, decision making, sensitivities, effective frames, avoid patterns

3. **Key peers** (frequent interaction):
   - Focus on dynamics
   - Ask for: communication style, working relationship, dynamics with others

4. **Execs**:
   - High-stakes comms
   - Focus on communication style
   - Ask for: communication style, decision making, effective frames

For each person:
```
## [Person Name] — [role] ([team])

No dossier exists. Would you like to create one?

Relationship type: [direct-report / peer / manager / exec / external]

Key fields to populate:
1. Communication style — how do they prefer to communicate?
2. Sensitivities — what requires careful handling?
3. [Additional fields based on relationship type]

Provide observations (or 'skip' for now):
```

Save entries as they're confirmed. The user can stop at any time and resume later.

### Review: `/dossier --review`

Review and refresh stale dossiers:

1. Load `.claude/dossiers.json`
2. Find all dossiers where `lastUpdated` is >30 days ago
3. Sort by staleness (oldest first)
4. For each stale dossier:
   ```
   ## [Person Name] — last updated [date] ([N] days ago)

   Current profile summary:
   - Communication style: [text]
   - Key notes: [last 3 notes]

   Options:
   [1] Add a fresh note
   [2] Update profile fields
   [3] Mark as current (no changes needed)
   [4] Skip for now
   ```
5. Update `lastUpdated` for entries marked current or updated

## Causantic Integration

All dossier updates emit a brief summary for Causantic hooks to capture:

```
[Dossier updated: Joel Patrick — added note about deflection pattern in budget discussion]
[Dossier updated: Byron Chen — updated coaching themes: ownership, technical depth]
[Dossier created: Robyn Scott — exec relationship, communication style captured]
```

This enables:
- `/causantic-search person dynamics Joel` — surface historical observations
- Cross-session recall of evolving understanding
- Pattern detection across dossier updates

## Notes

- Dossiers are sensitive — file is git-crypt encrypted
- All updates require human confirmation — never auto-populate
- Missing dossiers never block other skills
- `coaching` section is only relevant for direct reports — omit for others
- `dynamics` tracks Person↔Person relationships, not just Greg↔Person
- `notes` is append-only — observations build a timeline
- No retention/pruning on notes — these are evergreen observations
