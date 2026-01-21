# Profile Maintenance Guide

This guide explains how to keep team member profiles current and accurate, with best practices for using them in performance reviews.

---

## Performance Review Cycles & Best Practices

### Industry Standard: Continuous Feedback Model

Modern performance management moves away from annual reviews toward continuous feedback. These profiles support that model:

| Cycle | Frequency | Purpose | Profile Actions |
|-------|-----------|---------|-----------------|
| **Weekly** | Every week | 1:1 check-ins | Add observations to Evidence Log, update 1:1 Notes |
| **Monthly** | Monthly | Data refresh | Run `update_profiles.py --all --force --collect` |
| **Quarterly** | Every 3 months | Development review | Full profile review, update ratings, set goals |
| **Annual** | Yearly | Formal review | Comprehensive assessment, reset goals, archive year |

### When to Initialize Profiles

Use `--init` to create profiles from scratch. This automatically sets the "Profile Created" date to each employee's start date from Humaans:

```bash
# Initialize all profiles (uses each person's start date from Humaans)
python update_profiles.py --init --all --force

# Or with a custom date (e.g., aligning with review cycle start)
python update_profiles.py --init --all --force --created-date 2025-01-01
```

**When to re-initialize:**
- When someone changes roles significantly (new role = new baseline)
- At the start of a new annual review cycle (to reset the tracking period)
- When the template structure changes significantly (`--regenerate` preserves nothing)

### What Gets Preserved vs. Reset

| Section Type | On Regular Update | On `--init` or `--regenerate` |
|--------------|-------------------|-------------------------------|
| **AUTO-UPDATED** (1-4) | Refreshed from data | Refreshed from data |
| **MANUAL** (5-10) | **Preserved** | **Reset to empty** |
| **APPEND-ONLY** (11-12) | **Preserved** | **Reset to empty** |
| **Metrics History** | New snapshot added | Starts fresh |
| **Update History** | New entry prepended | Starts fresh |

### Recommended Update Workflow

#### Weekly: After 1:1s
1. Open the team member's profile
2. Add notes to **Section 11: 1:1 Notes**
3. Add achievements to **Section 12: Evidence Log**
4. No script needed - direct edits preserved

#### Monthly: Data Refresh
```bash
cd hr/team-profiles/scripts

# Collect fresh data and update auto sections
python update_profiles.py --all --collect --force
```

#### Quarterly: Development Review
1. Run monthly update first
2. Review and update **Section 5: Leadership Values**
3. Review and update **Section 6: Engineering Values**
4. Update **Section 8: Strengths & Development**
5. Set/review goals in **Section 9: Goals & Aspirations**
6. Generate team summary for calibration:
   ```bash
   python generate_summary.py --all
   ```

#### Annual: Formal Review Cycle
1. Run full update with all data sources
2. Complete comprehensive assessment of all sections
3. Archive the year's data (optional):
   ```bash
   mkdir -p ../archive/2025
   cp ../profiles/*.md ../archive/2025/
   ```
4. Consider re-initializing for new cycle (resets manual content):
   ```bash
   python update_profiles.py --init --all --force --created-date 2026-01-01
   ```

### Key Best Practices

1. **Capture evidence in real-time** - Don't wait for reviews to add observations
2. **Use the Evidence Log liberally** - Specific examples > vague impressions
3. **Review metrics in context** - Lines of code ≠ value; use for trends, not judgments
4. **Update ratings incrementally** - Quarterly updates prevent recency bias
5. **Keep 1:1 notes brief but dated** - Future you will thank present you
6. **Never share profiles without consent** - These are management tools, not shared docs

---

## Update Cadence Summary

| Update Type | Frequency | Trigger |
|-------------|-----------|---------|
| **Metrics Refresh** | Monthly | After dev-analytics monthly reports |
| **Slack Analysis** | Monthly | First Monday of the month |
| **RFC Engagement** | Monthly | Via Claude Code with MCP |
| **Email Analysis** | Monthly | Via Claude Code with MCP |
| **Meeting Analysis** | Monthly | Via Claude Code with MCP |
| **Full Profile Review** | Quarterly | Before performance conversations |
| **Manual Observations** | As needed | After notable events, 1:1s |

---

## Quick Start

### Initialize Profiles (First Time)

```bash
cd hr/team-profiles/scripts

# Initialize all profiles - uses each person's start date from Humaans
python update_profiles.py --init --all --force

# Or fetch fresh Humaans data first, then initialize
python update_profiles.py --init --all --force --collect
```

### Regular Update (Recommended)

```bash
# Update with fresh data collection
python update_profiles.py --all --collect --force

# Generate team summary
python generate_summary.py --all
```

### Dry Run (Preview)

See what would be updated without making changes:

```bash
python update_profiles.py --all --dry-run
```

### Update Single Person

```bash
python update_profiles.py --person "Samuel Balogun" --collect --force
```

### Data Collection Only (No Profile Updates)

```bash
# Fetch Humaans HR data
python update_profiles.py --humaans-only

# Slack analysis
python slack_analyzer.py --all

# Import analytics
python import_analytics.py
```

### Generate Team Summary

```bash
python generate_summary.py --all
```

---

## Step-by-Step: Manual Update Process

If you prefer to run each step manually:

### 1. Run Dev Analytics First

Before updating profiles, ensure the dev-analytics repo has fresh data:

```bash
cd ~/Dev/apolitical-dev-analytics
make monthly
```

### 2. Collect Automated Data

```bash
cd ~/Dev/Apolitical/apolitical-assistant/hr/team-profiles/scripts

# Run all automated data collectors
python slack_analyzer.py --all
python import_analytics.py
python update_profiles.py --humaans-only
```

### 3. Refresh MCP Data (Manual via Claude Code)

Open Claude Code and refresh these data sources:
- RFC engagement from Notion (see [Refreshing RFC Data](#refreshing-rfc-data))
- Email communication from Gmail (see [Refreshing Email Data](#refreshing-email-data))
- Meeting engagement from Gemini notes (see [Refreshing Meeting Data](#refreshing-meeting-data))

### 4. Update Profiles

```bash
python update_profiles.py --all --force
```

### 5. Generate Summary

```bash
python generate_summary.py --all
```

### 6. Review Changes

Review the updated profiles and summaries:
- Check for anomalies in metrics
- Note any significant changes
- Flag items needing discussion in 1:1s

The summary report is saved to `reports/update_summary_YYYY-MM-DD.md`.

## Manual Updates

Some sections require manual input. These should be updated after:

### After 1:1 Meetings

Update these sections in the individual's profile:

1. **Management Notes** → 1:1 Discussion Highlights
2. **Goals & Aspirations** (if discussed)
3. **Development Areas & Growth Plan** (progress updates)

### After Performance Conversations

1. **Leadership Values Assessment** (ratings and evidence)
2. **Engineering Values Assessment**
3. **Strengths Summary**
4. **Development Areas & Growth Plan**

### After Notable Achievements

1. **Evidence Log** → Notable Achievements
2. **Strengths Summary** (if relevant)

## Data Sources

### Notion RFC Data (`data/notion/`)

RFC engagement data fetched from the Notion Proposals (RFCs) database:
- `rfc_engagement.json` - Structured RFC data per team member
- `rfc_engagement_summary.md` - Human-readable summary

**What's captured:**
- RFCs authored (Owner field)
- RFCs contributed to (Contributors field)
- RFC titles, status, and URLs

**Note:** RFC data requires manual refresh using Claude Code with MCP, as the Notion integration uses OAuth rather than API tokens. See [Refreshing RFC Data](#refreshing-rfc-data) below.

### Humaans Data (`data/humaans/`)

Employee data fetched directly from the Humaans HR API:
- `{email}_humaans.json` - Individual employee data

**What's captured:**
- Job title (actual HR role: "Senior Software Engineer", "Tech Lead", etc.)
- Start date (employment start date)
- Tenure (automatically calculated)
- Department
- Manager status (whether they have direct reports)
- Reporting structure

**Note:** Engineering levels (L1-L5) are not stored in Humaans and must be maintained manually in config.yaml or in the profiles directly.

**To refresh Humaans data only:**
```bash
python update_profiles.py --humaans-only
```

### Slack Data (`data/slack/`)

Raw Slack analysis is stored in JSON files:
- `{member-key}_slack.json` - Individual analysis
- `all_slack_analysis.json` - Combined data

**What's captured:**
- Message counts by channel
- Message frequency and patterns
- Average message length
- Notable messages (for manual review)

**Channel filtering:** By default, all channels are analyzed EXCEPT social/off-topic channels listed in `channels_to_exclude` in `config.yaml`. Common excluded channels include:
- random, watercooler, social, off-topic
- fun, games, music, pets, food
- celebrations, birthdays, etc.

To add or remove channels from the exclude list, edit `config.yaml`:

```yaml
channels_to_exclude:
  - "random"
  - "watercooler"
  - "your-social-channel"
```

**Privacy note:** Raw DM content is NOT captured. Only metadata and patterns are analyzed.

### Analytics Data (`data/analytics/`)

Imported from dev-analytics repo:
- `{member-key}_analytics.json` - Individual metrics
- `all_analytics.json` - Combined data

**What's captured:**
- DORA metrics (deployment frequency, lead time, etc.)
- Contribution metrics (PRs, reviews, lines changed)
- Trends over time

### Gmail Email Data (`data/email/`)

Email communication analysis from your Gmail inbox:
- `email_engagement.json` - Structured email data per team member

**What's captured:**
- Total email count (from direct reports to you)
- Communication patterns (tone, clarity, responsiveness)
- Response rates and average response times
- Notable emails worth highlighting

**Note:** Email data requires manual refresh using Claude Code with MCP, as Gmail uses OAuth authentication. See [Refreshing Email Data](#refreshing-email-data) below.

**Privacy note:** Email content is analyzed for patterns only. Raw email content is NOT stored - only summaries and metadata are captured.

### Gemini Meeting Notes Data (`data/meetings/`)

Meeting engagement analysis from Gemini notes/transcriptions in Google Drive:
- `meeting_engagement.json` - Structured meeting data per team member

**What's captured:**
- Meetings attended (where they appear in notes)
- Contribution mentions (times named as contributing)
- Action items assigned to them
- Topics they engaged with
- Engagement patterns (participation level, quality, initiative)
- Notable contributions

**Note:** Meeting data requires manual refresh using Claude Code with MCP, as Google Drive uses OAuth authentication. See [Refreshing Meeting Data](#refreshing-meeting-data) below.

**How Gemini notes work:** Google Meet with Gemini generates meeting notes that include:
- Summary mentioning key participants
- Details with timestamps and speaker attributions (e.g., "Dominic Harries suggested...")
- Suggested next steps with assignees

## Refreshing RFC Data

RFC engagement data must be refreshed manually using Claude Code with MCP (Model Context Protocol), as the Notion integration uses OAuth authentication.

### When to Refresh

- **Monthly:** As part of the regular profile update cadence
- **Quarterly:** Before performance reviews
- **Ad-hoc:** When you know new RFCs have been created or significant contributions made

### How to Refresh RFC Data

1. **Open Claude Code** in the `apolitical-assistant` directory:
   ```bash
   cd ~/Dev/Apolitical/apolitical-assistant
   claude
   ```

2. **Request the RFC analysis:**
   ```
   Analyze RFC engagement from Notion for all direct reports and update the data files in hr/team-profiles/data/notion/
   ```

3. **Claude will:**
   - Search the Notion Proposals (RFCs) database
   - Extract Owner and Contributors for each RFC
   - Match Notion user IDs to team member emails
   - Update `rfc_engagement.json` and `rfc_engagement_summary.md`

4. **Run profile update** to incorporate the fresh data:
   ```bash
   cd hr/team-profiles/scripts
   python update_profiles.py --all --force
   ```

### Manual RFC Data Structure

If you need to manually update the RFC data, edit `data/notion/rfc_engagement.json`:

```json
{
  "analysis_date": "2026-01-20",
  "team_engagement": {
    "email@apolitical.co": {
      "name": "Team Member",
      "rfcs_authored": [
        {
          "title": "RFC Title",
          "status": "Accepted",
          "url": "https://www.notion.so/..."
        }
      ],
      "rfcs_contributed": [
        {
          "title": "Another RFC",
          "url": "https://www.notion.so/...",
          "role": "Contributor"
        }
      ],
      "totals": {
        "authored": 1,
        "contributed": 1
      }
    }
  }
}
```

## Refreshing Email Data

Email communication data must be refreshed manually using Claude Code with MCP (Model Context Protocol), as Gmail uses OAuth authentication.

### When to Refresh

- **Monthly:** As part of the regular profile update cadence
- **Quarterly:** Before performance reviews
- **Ad-hoc:** When preparing for a specific 1:1 or performance conversation

### How to Refresh Email Data

1. **Open Claude Code** in the `apolitical-assistant` directory:
   ```bash
   cd ~/Dev/Apolitical/apolitical-assistant
   claude
   ```

2. **Initialize the data file** (first time only):
   ```bash
   cd hr/team-profiles/scripts
   python email_analyzer.py --init
   ```

3. **For each direct report, request email analysis:**
   ```
   Search my Gmail for emails from samuel.balogun@apolitical.co in the last 12 months.
   Analyze their communication patterns including:
   - Tone and clarity
   - Responsiveness
   - Detail level
   - Notable examples of good communication

   Update the email_engagement.json file with the results.
   ```

4. **Claude will:**
   - Search Gmail for emails from that person
   - Analyze communication patterns
   - Update `data/email/email_engagement.json`

5. **Run profile update** to incorporate the fresh data:
   ```bash
   cd hr/team-profiles/scripts
   python update_profiles.py --all --force
   ```

### Manual Email Data Structure

If you need to manually update the email data, edit `data/email/email_engagement.json`:

```json
{
  "analysis_date": "2026-01-20",
  "source": "Gmail via MCP",
  "team_engagement": {
    "email@apolitical.co": {
      "name": "Team Member",
      "metrics": {
        "total_emails": 150,
        "emails_received": 100,
        "emails_sent": 50,
        "average_length": "Medium",
        "response_rate": "90%",
        "average_response_time": "4h"
      },
      "patterns": {
        "tone": "Professional and collaborative",
        "clarity": "Clear and well-structured",
        "responsiveness": "Quick to respond, usually same day",
        "detail_level": "Thorough with good context",
        "proactiveness": "Often raises issues before asked"
      },
      "notable_emails": [
        {
          "date": "2026-01-15",
          "subject": "Proposal for new architecture",
          "summary": "Well-thought-out technical proposal with clear trade-offs",
          "type": "positive"
        }
      ],
      "analysis_date": "2026-01-20",
      "analysis_period": "Last 12 months"
    }
  }
}
```

## Refreshing Meeting Data

Meeting engagement data must be refreshed manually using Claude Code with MCP (Model Context Protocol), as Google Drive uses OAuth authentication.

### When to Refresh

- **Monthly:** As part of the regular profile update cadence
- **Quarterly:** Before performance reviews
- **Ad-hoc:** When preparing for 1:1s or performance conversations

### How to Refresh Meeting Data

1. **Open Claude Code** in the `apolitical-assistant` directory:
   ```bash
   cd ~/Dev/Apolitical/apolitical-assistant
   claude
   ```

2. **Initialize the data file** (first time only):
   ```bash
   cd hr/team-profiles/scripts
   python meeting_analyzer.py --init
   ```

3. **Search for Gemini meeting notes:**
   ```
   Search Google Drive for "Notes by Gemini" from the last 3 months
   ```

4. **For each direct report, analyze their meeting participation:**
   ```
   Analyze meeting engagement for Dominic Harries from the Gemini meeting notes.
   Look at:
   - How many meetings they attended
   - How often they're mentioned as contributing
   - What topics they engaged with
   - Action items assigned to them
   - Notable contributions (proposals, problem-solving, leadership)

   Update the meeting_engagement.json file with the results.
   ```

5. **Claude will:**
   - Search meeting notes for mentions of that person
   - Analyze their contributions and patterns
   - Update `data/meetings/meeting_engagement.json`

6. **Run profile update** to incorporate the fresh data:
   ```bash
   cd hr/team-profiles/scripts
   python update_profiles.py --all --force
   ```

### Understanding Gemini Notes Format

Gemini meeting notes use specific patterns for speaker attribution:
- "**[Name] suggested/proposed/noted/affirmed/discussed...**"
- Action items: "**[Name] will...**"

Look for these patterns when analyzing contributions.

### Manual Meeting Data Structure

If you need to manually update the meeting data, edit `data/meetings/meeting_engagement.json`:

```json
{
  "analysis_date": "2026-01-20",
  "source": "Google Drive Gemini Notes via MCP",
  "team_engagement": {
    "email@apolitical.co": {
      "name": "Team Member",
      "metrics": {
        "meetings_attended": 15,
        "contribution_mentions": 45,
        "action_items_assigned": 8,
        "topics_discussed": ["QA automation", "Architecture"]
      },
      "engagement_patterns": {
        "participation_level": "Active contributor in technical discussions",
        "contribution_quality": "Provides well-thought-out solutions",
        "initiative": "Often proposes new ideas",
        "collaboration": "Builds on others' ideas constructively",
        "follow_through": "Consistently completes assigned actions"
      },
      "notable_contributions": [
        {
          "meeting": "QA / Testing",
          "date": "2026-01-19",
          "contribution": "Proposed automated testing strategy",
          "type": "technical_proposal"
        }
      ],
      "meetings_list": [
        {
          "name": "QA / Testing",
          "date": "2026-01-19",
          "doc_id": "1ZUhKPKSsj...",
          "mentions": 12
        }
      ],
      "analysis_date": "2026-01-20",
      "analysis_period": "Last 3 months"
    }
  }
}
```

## Troubleshooting

### "Humaans API token not found"

The scripts use Keychain credentials. Ensure you've run:

```bash
cd ~/Dev/Apolitical/apolitical-assistant
npm run setup
```

This will store the Humaans API token in macOS Keychain with the key `apolitical-assistant-humaans-api-token`.

### "Slack token not found"

Same as above - the scripts use Keychain credentials. Ensure you've run:

```bash
cd ~/Dev/Apolitical/apolitical-assistant
npm run setup
```

### "Dev analytics repo not found"

Update the path in `config.yaml`:

```yaml
data_sources:
  dev_analytics_path: "/actual/path/to/apolitical-dev-analytics"
```

### "No reports found"

Check that dev-analytics has generated reports:

```bash
ls ~/Dev/apolitical-dev-analytics/reports/
```

If empty, run `make monthly` in that repo first.

### Profile looks empty

Check if data files exist:

```bash
ls hr/team-profiles/data/slack/
ls hr/team-profiles/data/analytics/
```

If missing, run data collection first:

```bash
python slack_analyzer.py --all
python import_analytics.py
```

## Data Retention

### What to Keep

- **Profiles** (`profiles/*.md`): Keep all versions (git tracked)
- **Summary files**: Keep recent versions
- **Config**: Always keep current

### What to Archive

After 6 months, consider archiving:
- Old data snapshots in `data/`
- Historical analysis files

### What to Delete

- Temporary files
- Test outputs
- Duplicate data files

## Privacy Considerations

### Sensitive Sections

These sections contain sensitive information and should not be shared:

- Private Communications analysis
- Management Notes
- 1:1 Discussion Highlights
- Development Areas (without consent)

### Safe to Share

These sections can be shared with the team member:

- Delivery Performance metrics
- Public communication patterns
- Strengths Summary
- Goals & Aspirations (if they provided them)

### Never Share

- Other team members' profiles
- Comparative assessments
- Raw Slack message content
- Compensation information

## Customization

### Adding New Metrics

1. Update data collection scripts to capture new data
2. Add new sections to `templates/profile_template.md`
3. Update `update_profiles.py` to format the new sections
4. Run a full update to propagate changes

### Adding Team Members

1. Add entry to `config.yaml`
2. Run `python update_profiles.py --person "New Person" --force`

### Removing Team Members

1. Move their profile to an archive folder
2. Remove from `config.yaml`
3. Regenerate team summary

## Automation Ideas

### GitHub Actions

Set up monthly automation:

```yaml
name: Monthly Profile Update
on:
  schedule:
    - cron: '0 9 1 * *'  # First of month at 9am
jobs:
  update:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - name: Update profiles
        run: |
          cd hr/team-profiles/scripts
          python update_profiles.py --all --collect --force
```

### Slack Reminders

Set up reminders for manual updates:

```
/remind me to update team profiles every month on the 1st at 10am
```
