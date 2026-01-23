# Create Linear Ticket

Create a well-structured Linear ticket that aligns with team norms and conventions.

## Usage
- `/create-ticket [description]` - Create a ticket from a description
- `/create-ticket` - Interactive ticket creation

## Arguments
- `$ARGUMENTS` - Brief description of the work needed (optional, will prompt if not provided)

## Process

### 1. Gather Information

If not provided in arguments, ask for:
- **What needs to be done?** - Brief description of the work
- **Which team?** - Platform, AI Learning, AI Tools, Enterprise, Data
- **Ticket type?** - Task, Spike, or Bug

### 2. Determine Ticket Type

**Task** - Well-understood work with clear deliverables
- Requires story point estimate (1, 2, 3, 5, 8)
- Use standard task template

**Spike** - Research or investigation needed before work can be estimated
- Requires timebox (e.g., "2 days", "1 sprint")
- Outcomes should be clear deliverables (RFC, decision, scoped tickets)
- Use spike template

**Bug** - Something is broken or not working as expected
- Requires severity assessment (1=Blocker, 2=Critical, 3=Major)
- Use bug template

### 3. Select Labels

Apply appropriate labels based on the work:

**Type Labels** (pick one):
| Label | When to use |
|-------|-------------|
| `type: spike 📌` | Research/investigation work |
| `type: enhancement 🎉` | Improving existing feature |
| `type: migration ➡️` | Migration work |
| `type: maintenance ⚙` | Keeping things running |
| `type: documentation 🖍` | Documentation work |

**Stack Labels** (pick relevant):
| Label | When to use |
|-------|-------------|
| `stack: frontend 🎨` | Frontend/React work |
| `stack: backend 🔧` | API/server work |
| `stack: infrastructure 🚝` | Database, hosting, devops |
| `stack: ui/ux 🎨` | Design/UX work |
| `stack: devops 🔄` | CI/CD, automation |
| `stack: security 🔑` | Security-related |
| `stack: full-stack 🔄` | Spans frontend and backend |

**System Labels** (if applicable):
| Label | When to use |
|-------|-------------|
| `system: courses 🦄` | Course-related |
| `system: academies 🎓` | Academy-related |
| `system: ci-cd 🦊` | CI/CD pipelines |
| `system: monitoring 👀` | Monitoring/observability |
| `system: onboarding ✨` | User onboarding |

**Bug Severity** (bugs only):
| Label | Definition |
|-------|------------|
| `bug severity: 1` | Blocker - broken feature, no workaround, blocks users |
| `bug severity: 2` | Critical - broken feature, complex workaround, hinders users |
| `bug severity: 3` | Major - broken feature, acceptable workaround |

### 4. Build Ticket Content

#### Task Template
```markdown
# Why? (background)

`As a` [role] `I want to` [goal] `so that` [benefit]

References (if any):
* [Link to relevant docs/specs]

# Where? (affected areas)

* [Service/component 1]
* [Service/component 2]

# What? (done when)

## Tasks

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

## Checklist

The feature has been:

- [ ] Assessed for data protection impact
- [ ] Tested & documented
- [ ] Code reviewed
- [ ] Deployed to staging and tested
- [ ] Merged and deployed to production
```

#### Spike Template
```markdown
# Why? (background)

[Context for why this investigation is needed]

**Timebox:** [X days/sprint]

# What? (done when)

## Outcomes

- [ ] [Deliverable 1 - e.g., RFC with recommendations]
- [ ] [Deliverable 2 - e.g., Decision on approach]
- [ ] [Deliverable 3 - e.g., Scoped follow-up tickets]
```

#### Bug Template
```markdown
# Why? (background)

[Brief context on the impact]

# Where? (step by step)

1. Navigate to [location]
2. Perform [action]
3. Observe [issue]

## Behaviour

[What currently happens - the bug]

## Expected

[What should happen instead]

# What? (done when)

- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Regression test added
```

### 5. Estimate (Tasks only)

Use Fibonacci story points:
| Points | Complexity |
|--------|------------|
| 1 | Trivial - simple change, well understood |
| 2 | Small - straightforward, minimal risk |
| 3 | Medium - typical task, some complexity |
| 5 | Large - significant work, multiple components |
| 8 | Very large - complex, consider breaking down |

**Note:** Spikes don't get story points - they have a timebox instead.

### 6. Create the Ticket

Use `mcp__linear__create_issue` with:
- `title` - Clear, concise title (prefix with [SPIKE] or [BUG] if applicable)
- `team` - Target team name
- `description` - Formatted using appropriate template
- `labels` - Array of applicable label names
- `estimate` - Story points (tasks only, omit for spikes/bugs)
- `project` - If known, link to relevant project
- `assignee` - If known, assign to specific person

### 7. Confirm with User

Before creating, show:
- Title
- Team
- Type and labels
- Description preview
- Estimate/timebox (if applicable)

Ask: "Create this ticket?" and wait for confirmation.

## Output

After creation, display:
- Ticket ID and URL
- Summary of what was created
- Suggested next steps (e.g., "Add to current cycle?", "Assign to someone?")

## Examples

### Example: Task
```
/create-ticket Add rate limiting to the search API
```

Creates:
- Title: "Add rate limiting to the search API"
- Team: Platform
- Labels: `type: enhancement 🎉`, `stack: backend 🔧`
- Estimate: 3 points

### Example: Spike
```
/create-ticket Investigate alternatives to Pinecone for vector storage
```

Creates:
- Title: "[SPIKE] Investigate alternatives to Pinecone"
- Team: Platform
- Labels: `type: spike 📌`, `stack: infrastructure 🚝`
- Timebox: 3 days

### Example: Bug
```
/create-ticket Users can't upload profile images - getting 500 error
```

Creates:
- Title: "[BUG] Profile image upload returns 500 error"
- Team: Platform
- Labels: `bug severity: 2`, `stack: backend 🔧`, `system: profiles 👩🏾`

## Notes

- Always confirm before creating
- Link related tickets if mentioned
- Suggest appropriate project if context is clear
- For urgent bugs, mention if it should be flagged to the team
