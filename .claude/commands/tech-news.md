# Tech News

Scan tech news sources for headlines relevant to the Director of Engineering role — security vulnerabilities, AI developments, compliance/privacy changes, GovTech, open source, and cloud infrastructure.

## Usage

- `/tech-news` - Full scan with headlines and descriptions
- `/tech-news --quick` - Headlines only, no descriptions
- `/tech-news --security` - P0 security items only

## Core Patterns Used

- [Daily Index Update](../patterns/daily-index-update.md) - Update daily context index
- [Error Handling](../patterns/error-handling.md) - Handle unavailable sources

## MANDATORY: Required Tool Calls

| Step | Required Tools | Cannot Skip Unless |
|------|---------------|-------------------|
| 1. Fetch | WebFetch ×4 (parallel) | Individual source failures noted and skipped |
| 2. Classify & merge | (no tools — classification logic) | Never |
| 3. Output & save | Write ×1, Read/Edit ×1 (daily index) | Never |

## Priority Tiers

Items are classified into priority tiers based on category tags:

| Tier | Category | Signal Keywords |
|------|----------|----------------|
| P0 | Security | CVEs, breaches, zero-days, ransomware, supply chain attacks, patches, vulnerabilities, exploits |
| P1 | AI/ML | LLMs, model releases, AI regulation, generative AI, AI safety, foundation models |
| P2 | Compliance & Privacy | GDPR, SOC2, ISO, DORA, NIS2, data protection, privacy law, audit |
| P3 | GovTech | government tech, civic tech, public sector, digital government, gov procurement |
| P4 | Open Source | major releases, license changes, SBOM, OSS security, package vulnerabilities |
| P5 | Cloud / Infra | AWS/GCP/Azure changes, outages, Kubernetes, serverless, platform updates |

## Workflow Steps

### Step 1: Fetch Sources

Fetch all 4 sources **in parallel** using WebFetch. Each call includes a relevance-filtering prompt so only matching items are returned.

**Sources and prompts:**

1. **Hacker News** — `https://news.ycombinator.com/`
   > Extract headlines from the front page. For each item, return: headline, URL, and a 1-sentence description. Only include items matching these categories: security/cybersecurity, AI/ML, compliance/privacy/regulation, government technology, open source (major releases or license changes), cloud infrastructure (AWS/GCP/Azure/Kubernetes). Tag each item with one category: security, ai, compliance, govtech, opensource, cloud. Return as a structured list. If nothing matches, say "No relevant items."

2. **Ars Technica** — `https://arstechnica.com/`
   > Extract article headlines from the page. For each, return: headline, URL, and a 1-sentence description. Only include articles about: security/cybersecurity, AI/ML, compliance/privacy/regulation, government technology, open source, cloud infrastructure. Tag each with one category: security, ai, compliance, govtech, opensource, cloud. Return as a structured list. If nothing matches, say "No relevant items."

3. **Slashdot** — `https://slashdot.org/`
   > Extract story headlines from the page. For each, return: headline, URL, and a 1-sentence description. Only include stories about: security/cybersecurity, AI/ML, compliance/privacy/regulation, government technology, open source (major releases or license changes), cloud infrastructure. Tag each with one category: security, ai, compliance, govtech, opensource, cloud. Return as a structured list. If nothing matches, say "No relevant items."

4. **Gizmodo** — `https://gizmodo.com/`
   > Extract article headlines from the page. For each, return: headline, URL, and a 1-sentence description. Only include articles about: security/cybersecurity, AI/ML, compliance/privacy/regulation, government technology, open source, cloud infrastructure. Tag each with one category: security, ai, compliance, govtech, opensource, cloud. Return as a structured list. If nothing matches, say "No relevant items."

**Error handling**: If a source fails (timeout, 403, etc.), log it and continue with remaining sources. Note failed sources in the output.

```
✓ CHECKPOINT: Step 1 complete - Fetch Sources
  Tools: WebFetch ×4 (N succeeded, M failed)
  Items found: X total across N sources
  Failed sources: [list or "none"]

Proceeding to Step 2: Classify & Merge
```

### Step 2: Classify & Merge

Process the raw results into a deduplicated, prioritised list:

1. **Map categories to tiers**: Use the Priority Tiers table above
2. **Deduplicate**: If the same story appears from multiple sources, keep one entry and note "via Source1, Source2"
3. **Sort**: P0 first, then P1, P2, etc. Within a tier, order by apparent recency or prominence
4. **Mode filtering**:
   - `--security`: Keep only P0 items. If none found, say "No security items today."
   - `--quick`: Strip descriptions, keep headlines + URLs + category tags only
   - Default: Keep full headlines + descriptions + URLs

```
✓ CHECKPOINT: Step 2 complete - Classify & Merge
  Deduplicated: X items → Y unique
  By tier: P0: A, P1: B, P2: C, P3: D, P4: E, P5: F

Proceeding to Step 3: Output & Save
```

### Step 3: Output & Save

#### Display Format

```markdown
# Tech News Scan - YYYY-MM-DD HH:MM

Sources: Hacker News ✓, Ars Technica ✓, Slashdot ✓, Gizmodo ✓
Items: X relevant (Y sources scanned)

---

## P0 — Security
- **[Headline](url)** — Description. *(via Source)*
- **[Headline](url)** — Description. *(via Source)*

## P1 — AI/ML
- **[Headline](url)** — Description. *(via Source)*

## P2 — Compliance & Privacy
*(No items today)*

## P3 — GovTech
- **[Headline](url)** — Description. *(via Source)*

## P4 — Open Source
- **[Headline](url)** — Description. *(via Source)*

## P5 — Cloud / Infra
*(No items today)*
```

For `--quick` mode, omit descriptions:
```markdown
## P0 — Security
- [Headline](url) `security` *(HN)*
```

For `--security` mode, only show the P0 section.

#### Save Artifact

Save to `context/YYYY-MM-DD/tech-news-HHMM.md` with frontmatter:

```yaml
---
type: context
date: YYYY-MM-DD
tags: [tech-news, security, ai, compliance, govtech, opensource, cloud]
---
```

#### Update Daily Index

Append to `context/YYYY-MM-DD/index.md`:

```markdown
## Tech News (HH:MM)
- **Sources scanned**: N/4 succeeded
- **Items found**: X relevant
- **P0 Security**: Y items [or "None"]
- **Top headline**: [Brief description of most significant item]
```

Create the day directory and index file if they don't exist (use [Daily Index Update](../patterns/daily-index-update.md) pattern).

```
✓ CHECKPOINT: Step 3 complete - Output & Save
  Tools: Write ×1, Read ×1, Edit ×1
  Saved to: context/YYYY-MM-DD/tech-news-HHMM.md
  Daily index: updated
```

## Notes

- Security items (P0) are always shown first — they are the highest priority for an engineering leader
- The skill is designed to be fast: 4 parallel fetches, simple classification, minimal processing
- When run inside `/begin-day`, use `--quick` mode for speed (headlines only)
- Failed sources are noted but never block the skill — partial results are better than none
- Deduplication is best-effort (headline similarity) since the same story may have different titles across sources
- If Ars Technica blocks WebFetch (returns 403/timeout), The Register (`https://www.theregister.com/`) can be used as an alternative source with the same prompt format
