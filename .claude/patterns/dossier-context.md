# Dossier Context Pattern

Lightweight pattern for skills to load professional dossier context for a person. Provides communication style, sensitivities, playbook, and coaching context to inform drafting, meeting prep, and strategic thinking.

## When to Use

- Drafting responses to someone (email, Slack, PR comment)
- Preparing for meetings with someone
- Thinking sessions involving specific stakeholders
- Any interaction where understanding the person's communication preferences and sensitivities matters

## Files Involved

- `.claude/dossiers.json` - Dossier data store
- `.claude/people.json` - Person resolution (to get email key)

## Algorithm

### Step 1: Resolve Person to Email

Use the [Person Resolution](person-resolution.md) pattern to resolve the person's name/ID to their email address. The email is the key into dossiers.json.

### Step 2: Load Dossier

```
1. Read .claude/dossiers.json
2. Look up dossiers[email]
3. If not found → return null (skill proceeds without dossier context)
4. If found → return dossier entry
```

### Step 3: Extract Relevant Context

Depending on the skill's needs, extract different sections:

**For drafting responses** (`/respond-to`, `/draft-email`):
- Load the **self dossier** (relationship: "self") — use `profile.communicationStyle` to match Greg's voice and tone when drafting
- Load the **recipient's dossier** — use their `profile.communicationStyle`, `profile.sensitivities`, `playbook.effectiveFrames`, and `playbook.avoidPatterns` to tailor the message to how they receive information
- Last 3 entries from recipient's `notes` for recent context
- When both dossiers exist, the draft should sound like Greg (self) while being framed for the recipient

**For meeting prep** (`/prep-meeting`):
- Full `profile` section
- `playbook` (all fields)
- `dynamics` entries involving other attendees
- `coaching.currentThemes` and recent `coaching.feedbackLog` (for DR 1:1s)
- Last 5 entries from `notes`

**For thinking sessions** (`/rubberduck`):
- Full `profile` section
- `playbook` (all fields)
- `dynamics` entries for all mentioned stakeholders
- Full `notes` history (for pattern analysis)

### Step 4: Format for Injection

Present dossier context as a structured block that the skill can use:

```markdown
### Dossier: [Display Name] ([relationship])

**Communication style:** [communicationStyle]
**Decision making:** [decisionMaking]
**Sensitivities:** [sensitivities]

**Effective frames:**
- [frame 1]
- [frame 2]

**Avoid:**
- [pattern 1]
- [pattern 2]

**Recent notes:**
- [date]: [note]
- [date]: [note]
```

For DR 1:1s, append:

```markdown
**Coaching themes:** [currentThemes]
**Recent feedback:**
- [date] [topic]: [note]
```

For multi-person meetings, append:

```markdown
**Dynamics:**
- [Person A] ↔ [Person B]: [dynamic note]
```

## Graceful Degradation

- If `dossiers.json` doesn't exist → skip silently, skill proceeds normally
- If person has no dossier → skip silently, skill proceeds normally
- If dossier exists but specific fields are empty → omit those fields from output
- Missing dossiers never block a skill's execution

## Causantic Integration

When a dossier is updated (new note, profile change, coaching entry), the updating skill should emit a brief summary to the conversation so Causantic hooks capture it:

```
[Dossier updated: Person Name — added note about communication pattern in 1:1]
```

This enables cross-session recall of how understanding of a person has evolved.

## Skills Using This Pattern

- `/respond-to` - Communication style and playbook for drafting
- `/draft-email` - Communication style and playbook for drafting
- `/prep-meeting` - Full profile, dynamics, coaching for meeting prep
- `/rubberduck` - Full profile and dynamics for strategic thinking
- `/slack-read` - Dossier update prompts after notable DM exchanges
- `/begin-day` - Stale dossier check for today's meeting attendees
- `/dossier` - Direct dossier management
