# Deep Recall

Recall and expand knowledge on a topic by searching long-term memory, then using memory results to drive targeted searches across local encrypted files and all integrated systems — then feeding discoveries back into memory to surface additional context the initial search missed.

## Usage

- `/deep-recall [topic]` - Full memory-driven knowledge expansion
- `/deep-recall [topic] --quick` - Memory + local files only, skip MCP integrations
- `/deep-recall [topic] --sources slack,linear,notion` - Limit to specific integrations
- `/deep-recall [topic] --resume` - Resume from last completed step

## Core Patterns Used

- [Checkpointing](../patterns/checkpointing.md) - Progress tracking and resume capability
- [Local Context First](../patterns/local-context-first.md) - Check daily context before API calls
- [Person Resolution](../patterns/person-resolution.md) - Resolve people mentioned in memory
- [Error Handling](../patterns/error-handling.md) - Handle unavailable integrations
- [Daily Index Update](../patterns/daily-index-update.md) - Append results to daily context

## Checkpoint Discipline

**You MUST complete each step before moving to the next.**

After each step, output:

```
✓ CHECKPOINT: Step N complete - [step name]
  [Brief summary with metrics]

Proceeding to Step N+1: [next step name]
```

## Quick Mode

When `--quick` flag is provided:

1. Run Steps 1-3 only (Memory Search, Extract Leads, Search Local Files)
2. Skip Step 4 (MCP integration searches)
3. Still re-interrogate memory using local file findings (Step 5, scoped to local-only discoveries)
4. Synthesise and save findings (Steps 6-7)
5. Note in output: "Quick mode - memory + local files only. Run without --quick to expand across integrations."

## Source Filtering

When `--sources` flag is provided, only search the listed integrations in Step 4.

Valid source names: `slack`, `email`, `linear`, `github`, `notion`, `calendar`, `drive`, `figma`, `incidents`, `humaans`

## Resume Support

Supports `--resume` flag. State is tracked in `context/YYYY-MM-DD/deep-recall-state.json`.

On resume:
1. Load state file
2. Display previously completed steps
3. Continue from first incomplete step

## Process

### Step 1: Memory Search

Search Causantic memory using `search`, `recall`, and `predict` to build an initial picture.

**Run all three in parallel:**

1. **Semantic search**: Call `mcp__entropic-causal-memory__search` with the topic as query
2. **Narrative recall**: Call `mcp__entropic-causal-memory__recall` with the topic as query
3. **Predictive context**: Call `mcp__entropic-causal-memory__predict` with the topic as context

Collect all results. If memory returns nothing meaningful, note this — subsequent steps will fall back to keyword-based searching using the original topic.

```
✓ CHECKPOINT: Step 1 complete - Initial Memory Search
  Search: [N] chunks | Recall: [N] chunks | Predict: [N] chunks

Proceeding to Step 2: Extract Search Leads
```

### Step 2: Extract Search Leads

Analyse the memory results and extract structured search leads. These leads drive all subsequent searches.

Extract:

- **People**: Names, roles, or team references mentioned in memory
- **Projects**: Project names, squad names, initiative references
- **Channels**: Slack channels mentioned or implied
- **Tickets**: Linear ticket references (e.g., ENG-123, PLAT-456)
- **Documents**: Notion pages, RFCs, PRDs, Google Docs referenced
- **Repos/PRs**: GitHub repositories or PR references
- **Keywords**: Key terms, technical concepts, product names (for grep/search)
- **Time ranges**: Dates or periods mentioned (e.g., "last sprint", "Q4")
- **Decisions**: Past decisions, outcomes, or conclusions noted

**If memory returned nothing**: Use the original topic query to generate keyword leads.

**Resolve people**: For any people mentioned, look them up in `.claude/people.json` using the person resolution pattern. Cached identifiers (slackUserId, linearUserId, githubUsername) make subsequent searches much more targeted.

Output the extracted leads:

```
Search Leads Extracted:
- People: [list with resolved IDs where available]
- Projects: [list]
- Keywords: [list]
- Tickets: [list]
- Documents: [list]
- Time context: [summary]
```

```
✓ CHECKPOINT: Step 2 complete - Search Leads Extracted
  [N] people | [N] keywords | [N] tickets | [N] documents

Proceeding to Step 3: Search Local Files
```

### Step 3: Search Local Encrypted Files

Search all local markdown files in the project's encrypted directories for content matching the extracted leads. This surfaces context from past briefings, meeting notes, investigations, EOD summaries, and other artifacts that may not be in Causantic memory.

**Directories to search:**

| Directory | Content |
|-----------|---------|
| `context/` | Daily context, session notes, EOD summaries, todos |
| `briefings/` | Daily briefings |
| `work/` | Ad-hoc work products |
| `reviews/` | Weekly, executive, and MBR reviews |
| `investigations/` | Research and analysis |
| `rubberduck/` | Thinking sessions |
| `meetings/` | Meeting prep and notes |
| `121/` | 1:1 meeting archives (if exists) |

**Search algorithm:**

1. **Build search terms** from the extracted leads:
   - All keywords from Step 2
   - People's display names
   - Ticket IDs
   - Project/squad names
   - Document titles

2. **Search each directory** using Grep with each search term against `*.md` files:
   - Use case-insensitive matching
   - Track which files match and which terms they match on
   - For each matching file, note the match count and matched terms

3. **Deduplicate and rank** results:
   - Files matching multiple search terms rank higher
   - More recent files rank higher (use filename date patterns YYYY-MM-DD)
   - Group results by directory/type

4. **Read key files**: For the top-ranked files (up to 10), read them to extract relevant context:
   - Focus on sections that contain the matched terms
   - Extract decisions, action items, outcomes, and key context
   - Note connections between files (e.g., a briefing references a meeting)

5. **Track per-directory progress**:

```
Local File Search:
- [x] context/ — 12 files matched (4 read)
- [x] briefings/ — 3 files matched (2 read)
- [x] meetings/ — 5 files matched (3 read)
- [x] investigations/ — 1 file matched (1 read)
- [x] reviews/ — 2 files matched (0 read — low relevance)
- [x] work/ — 0 files matched
- [x] rubberduck/ — 0 files matched
- [-] 121/ — directory not found
```

```
✓ CHECKPOINT: Step 3 complete - Local File Search
  [N] directories searched | [N] files matched | [N] files read
  Top matches: [list top 3 files with brief relevance note]

Proceeding to Step 4: Expand Across Integrations
```

If `--quick` flag: skip to Step 5.

### Step 4: Expand Across Integrations

Use the extracted leads to search across all available MCP integrations. Search each integration using the most relevant leads — not every lead applies to every system.

**Run searches in parallel where possible.** Group independent searches together.

Track per-source progress:

```
Integration Search Progress:
- [ ] Slack
- [ ] Email
- [ ] Linear
- [ ] GitHub
- [ ] Notion
- [ ] Google Drive
- [ ] Calendar
- [ ] Figma
- [ ] Incidents
- [ ] Humaans
```

#### 4a. Slack
Search for: keywords, people mentions, channel activity, ticket references
- Use `slack_search` with extracted keywords and people names
- If specific channels were mentioned in memory or local files, read recent messages
- Look for threads that expand on decisions or discussions found earlier

#### 4b. Email (Gmail)
Search for: people names, project names, key decisions
- Use `gmail_search` with relevant people and topic keywords
- Focus on threads that may contain decisions, approvals, or context not in Slack

#### 4c. Linear
Search for: ticket references, project names, people as assignees
- Use `list_issues` filtered by project or search terms
- Check issue comments for discussion context
- Look up specific tickets referenced in memory or local files

#### 4d. GitHub
Search for: repo names, PR references, code-related keywords
- Use `search_code` or `search_issues` with technical keywords
- Check PRs involving people mentioned in memory
- Look for related issues or discussions

#### 4e. Notion
Search for: document titles, RFC names, PRD references, project pages
- **Check priority sources first** (load from `.claude/notion-sources.json`):
  - RFCs for technical topics
  - PRDs for product/feature topics
  - Roadmap for planning/priority topics
- Use `notion-search` for broader document discovery
- Fetch key pages found for full context

#### 4f. Google Drive
Search for: document titles, presentation names, shared files
- Use `drive_search` with topic keywords and document names from memory or local files

#### 4g. Calendar
Search for: meetings with mentioned people, topic-related meetings
- Use `calendar_list_events` to find relevant past or upcoming meetings
- Check for recurring meetings on the topic

#### 4h. Figma
Search for: design files related to the topic
- Check `.claude/figma-sources.json` for matching files by name/category
- If design-related topic, fetch screenshots for visual context

#### 4i. Incidents (incident.io)
Search for: related incidents, postmortems, follow-ups
- Use `incidentio_list_incidents` if topic involves reliability, outages, or system issues
- Check for related follow-up actions

#### 4j. Humaans
Search for: people context (role, team, manager, time off)
- Only if people were mentioned and their org context is relevant
- Use cached identifiers from `people.json` where available

**Update progress after each source completes:**

```
Integration Search Progress:
- [x] Slack — 8 relevant messages across 3 channels
- [x] Email — 2 threads found
- [x] Linear — 4 related tickets (2 open, 2 closed)
- [x] GitHub — 1 PR found
- [x] Notion — 1 RFC, 2 PRDs
- [x] Google Drive — 0 results
- [x] Calendar — 3 meetings found
- [x] Figma — 0 related design files
- [x] Incidents — 0 incidents
- [-] Humaans — skipped (no people context needed)
```

```
✓ CHECKPOINT: Step 4 complete - Integration Searches
  [N]/[M] sources searched | [summary of key finds]

Proceeding to Step 5: Re-interrogate Memory
```

### Step 5: Re-interrogate Memory

Use discoveries from local files (Step 3) and integrations (Step 4) to run targeted follow-up memory searches. This surfaces memory that the initial broad search missed — context connected to the topic through people, decisions, or events that only became visible after expanding outward.

#### 5a. Identify New Leads

Compare what was found in Steps 3-4 against the original memory results from Step 1. Extract **net-new** information not present in the initial memory results:

- **New people** discovered in Slack threads, email chains, or meeting notes who weren't in the original memory results
- **New project names or initiatives** referenced in Linear tickets, Notion docs, or local files
- **New technical terms or concepts** surfaced from code searches, RFCs, or PRDs
- **Specific decisions or events** found in meeting notes or email threads that memory didn't mention
- **Related topics** that emerged — adjacent areas connected to the original topic
- **Ticket IDs or document titles** discovered that might have their own memory trail

If no meaningful new leads were found, skip the rest of this step:

```
⊘ CHECKPOINT: Step 5 skipped - Re-interrogate Memory (no new leads from Steps 3-4)

Proceeding to Step 6: Synthesise
```

#### 5b. Build Targeted Memory Queries

Construct specific, targeted queries from the new leads. Each query should focus on a distinct angle that the initial search didn't cover.

**Query strategies:**

| New Lead Type | Memory Call | Example Query |
|---------------|------------|---------------|
| New person | `recall` | "work with [person] on [topic]" |
| New project connection | `search` | "[related project] [original topic]" |
| Specific decision | `recall` | "decision about [specific thing] [date context]" |
| Technical concept | `search` | "[new term] implementation" |
| Related topic | `search` | "[adjacent topic]" |
| Event or incident | `recall` | "[event description] [time period]" |

**Aim for 3-6 targeted queries.** More than that risks diminishing returns.

#### 5c. Execute Follow-up Memory Searches

Run the targeted queries. Use the appropriate memory tool for each:

- **`search`** for discovery — "what else do I know about [new lead]?"
- **`recall`** for narrative — "how did [new person/event] connect to [topic]?"

Run independent queries in parallel where possible.

#### 5d. Assess New Memory Results

For each follow-up query, assess whether it returned **genuinely new context** not already covered:

- **New**: Context that adds to the picture — include in synthesis
- **Overlapping**: Context that confirms what we already know — note as corroboration
- **Irrelevant**: Context that doesn't connect to the topic — discard

```
Memory Re-interrogation Results:
- "work with Sarah on embeddings" → NEW: Found 3 chunks about embedding pipeline decisions
- "PLAT-892 migration" → NEW: Found recall chain about data migration blockers
- "search API redesign" → OVERLAPPING: Confirms RFC findings from Notion
- "Q4 performance review" → IRRELEVANT: Different context, discarded
```

```
✓ CHECKPOINT: Step 5 complete - Memory Re-interrogation
  [N] follow-up queries | [N] returned new context | [N] new chunks incorporated
  Key new finds: [brief summary of what the re-interrogation surfaced]

Proceeding to Step 6: Synthesise
```

### Step 6: Synthesise

Combine all sources — initial memory, local files, integration results, and re-interrogated memory — into a structured knowledge summary.

**Synthesis priorities:**
- Connections between sources (memory mentions a decision → local file has the detail → Slack has the discussion → re-interrogation surfaces the follow-up)
- Chronological narrative where possible
- Highlight where re-interrogation added depth that the initial search missed
- Note contradictions or gaps between sources
- Surface things found in integrations that memory didn't know about

#### Output Format

```markdown
# Deep Recall: [Topic]

## What Memory Knows
Summary of key points from Causantic memory — both initial search and re-interrogation.
Note where follow-up queries surfaced additional context.

### Initial Memory
[Key points from Step 1]

### Surfaced by Re-interrogation
[Key points from Step 5 that the initial search missed, and what triggered their discovery]

## Local File Context
Key findings from encrypted project files — past briefings, meeting notes,
investigations, and artifacts that reference this topic.

### Key Files
- `[filepath]` — [relevance and key content]
- `[filepath]` — [relevance and key content]

## Expanded Context (from integrations)

### People Involved
- **[Name]** — [role/relevance] — [what they contributed or their involvement]

### Key Decisions & Outcomes
- [Decision 1]: [context, date if known, outcome, source]
- [Decision 2]: [context, date if known, outcome, source]

### Active Work
- [Open tickets, in-progress PRs, draft documents]

### Timeline
- [Chronological summary of key events, across all sources]

### Documents & References
- [RFC/PRD/Doc title](link) — [brief relevance note]
- [Ticket ID](link) — [status, relevance]

### Gaps & Open Questions
- Things referenced in one source but not found in others
- Incomplete information or contradictions between sources
- Areas that might need further investigation

## Sources Checked
| Source | Status | Results | Key Finds |
|--------|--------|---------|-----------|
| Memory (initial) | ✓ | [N] chunks | [summary] |
| Memory (re-interrogation) | ✓/⊘ | [N] new chunks | [summary] |
| Local: context/ | ✓/⊘ | [N] files | [summary] |
| Local: briefings/ | ✓/⊘ | [N] files | [summary] |
| Local: meetings/ | ✓/⊘ | [N] files | [summary] |
| Local: investigations/ | ✓/⊘ | [N] files | [summary] |
| Local: reviews/ | ✓/⊘ | [N] files | [summary] |
| Local: work/ | ✓/⊘ | [N] files | [summary] |
| Local: rubberduck/ | ✓/⊘ | [N] files | [summary] |
| Slack | ✓/⊘ | [summary] | [summary] |
| Email | ✓/⊘ | [summary] | [summary] |
| Linear | ✓/⊘ | [summary] | [summary] |
| GitHub | ✓/⊘ | [summary] | [summary] |
| Notion | ✓/⊘ | [summary] | [summary] |
| Google Drive | ✓/⊘ | [summary] | [summary] |
| Calendar | ✓/⊘ | [summary] | [summary] |
| Figma | ✓/⊘ | [summary] | [summary] |
| Incidents | ✓/⊘ | [summary] | [summary] |
| Humaans | ✓/⊘ | [summary] | [summary] |
```

```
✓ CHECKPOINT: Step 6 complete - Synthesis
  [Key insight or connection discovered]

Proceeding to Step 7: Save & Index
```

### Step 7: Save & Index

1. **Save artifact**: Write to `investigations/YYYY-MM-DD-deep-recall-[slug].md` with frontmatter:
   ```yaml
   ---
   type: investigation
   date: YYYY-MM-DD
   tags: [deep-recall, topic-keywords]
   status: final
   stakeholders: [people involved, if any]
   ---
   ```

2. **Update daily context index**: Append summary to `context/YYYY-MM-DD/index.md`:
   ```markdown
   | HH:MM | Deep Recall | [topic] — [1-line summary of key findings] |
   ```

3. **Clean up state file**: Delete `context/YYYY-MM-DD/deep-recall-state.json` if it exists.

```
✓ CHECKPOINT: Step 7 complete - Saved & Indexed
  Saved to: investigations/YYYY-MM-DD-deep-recall-[slug].md
```

## Final Summary

```
# Deep Recall Complete - [Topic]

## Steps Completed
✓ 1. Initial Memory    ✓ 2. Extract Leads     ✓ 3. Local Files
✓ 4. Integrations      ✓ 5. Re-interrogate    ✓ 6. Synthesise
✓ 7. Save & Index

## Key Results
- Memory:            [N] chunks (initial) + [N] chunks (re-interrogation)
- Local files:       [N] files matched, [N] read
- Integrations:      [N]/[M] sources searched
- Re-interrogation:  [N] follow-up queries, [N] surfaced new context
- Key finding:       [Most important insight or connection discovered]

## Saved To
investigations/YYYY-MM-DD-deep-recall-[slug].md

---
Deep recall complete.
```

## Mode Reference

| Flag | Steps Run | Steps Skipped | Use Case |
|------|-----------|---------------|----------|
| (none) | All (1-7) | None | Full knowledge expansion |
| `--quick` | 1, 2, 3, 5, 6, 7 | 4 | Memory + local files only |
| `--sources X` | All, but 4 filtered | Unlisted sources | Targeted integrations |
| `--resume` | Remaining | Completed | Recovery from interruption |

### Step Summary by Mode

| Step | Default | --quick | --resume |
|------|:-------:|:-------:|:--------:|
| 1. Initial Memory | ✓ | ✓ | from last |
| 2. Extract Leads | ✓ | ✓ | from last |
| 3. Local Files | ✓ | ✓ | from last |
| 4. Integrations | ✓ | ⊘ | from last |
| 5. Re-interrogate Memory | ✓ | ✓ (local leads only) | from last |
| 6. Synthesise | ✓ | ✓ | from last |
| 7. Save & Index | ✓ | ✓ | from last |

## Notes

- Memory results drive everything — the leads extracted in Step 2 shape both the local file search and integration searches
- The re-interrogation step (Step 5) is where the real depth comes from — discoveries in local files and integrations often reveal angles that the initial broad memory search missed
- If memory returns nothing initially, fall back to keyword-based searching using the original topic across local files and integrations, then use any findings to interrogate memory in Step 5
- Resolve people mentioned in memory using `people.json` before searching — cached identifiers make searches much more targeted
- Local file search (Step 3) is valuable because it surfaces past artifacts that may predate Causantic memory or contain detail that wasn't captured in memory chunks
- If a specific integration is unavailable, note it in the sources table and continue with others
- The core value of this skill is in **connections** — linking what memory knows with local artifacts and live system data, then feeding that back into memory for a complete picture
- If the topic is very broad, suggest the user narrow it down after seeing initial memory results
- Aim for 3-6 re-interrogation queries in Step 5 — more risks diminishing returns and context bloat
- **Update people.json** when discovering new identifiers during integration searches
