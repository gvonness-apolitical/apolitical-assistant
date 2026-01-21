# Team Profiles

Professional development profiles for engineering direct reports.

## Overview

This system maintains comprehensive, living documents for each team member that integrate:

- **Humaans HR data** - job titles, start dates, tenure, manager status (via API)
- **Slack communications** analysis (public channels + DMs)
- **Delivery metrics** from apolitical-dev-analytics
- **Manual observations** from 1:1s and daily work
- **Competency assessments** against company frameworks

## Quick Start

### Prerequisites

1. Run the main project setup (for Keychain credentials):
   ```bash
   cd ~/Dev/Apolitical/apolitical-assistant
   npm run setup
   ```

2. Install Python dependencies:
   ```bash
   pip install pyyaml requests
   ```

3. Ensure dev-analytics repo is available:
   ```bash
   ls ~/Dev/apolitical-dev-analytics
   ```

### First Time Setup

```bash
cd hr/team-profiles/scripts

# Fetch fresh Humaans data first (optional, recommended)
python update_profiles.py --humaans-only

# Initialize all profiles - each profile's "Created" date = employee start date
python update_profiles.py --init --all --force

# Or override with a specific date (e.g., aligning with review cycle)
python update_profiles.py --init --all --force --created-date 2025-01-01
```

### Regular Updates

```bash
# Update all profiles (preserves manual content)
python update_profiles.py --all --force

# Update with fresh data collection
python update_profiles.py --all --collect --force

# Generate team summary
python generate_summary.py --all
```

### Update Single Person

```bash
python update_profiles.py --person "Samuel Balogun" --force

# With data collection
python update_profiles.py --person "Samuel Balogun" --collect --force
```

## Directory Structure

```
hr/team-profiles/           # Encrypted via git-crypt
├── README.md                    # This file
├── config.yaml                  # Team configuration
├── TEAM_SUMMARY.md             # Generated team overview
├── COMPARISON_MATRIX.md        # Generated comparison view
├── profiles/                    # Individual profile documents
│   ├── samuel-balogun.md
│   ├── byron-sorgdrager.md
│   └── ...
├── scripts/                     # Maintenance scripts
│   ├── update_profiles.py       # Main orchestrator
│   ├── humaans_client.py        # Humaans API client
│   ├── slack_analyzer.py        # Slack analysis
│   ├── import_analytics.py      # Dev-analytics import
│   └── generate_summary.py      # Team summaries
├── templates/
│   └── profile_template.md      # Profile template
├── data/                        # Raw data (gitignored)
│   ├── humaans/                 # Humaans API data
│   ├── slack/
│   └── analytics/
└── docs/
    ├── MAINTENANCE_GUIDE.md     # How to maintain profiles
    └── PROFILE_GUIDE.md         # How to interpret profiles
```

## Team Members

| Name | Email | Squad | Profile |
|------|-------|-------|---------|
| Samuel Balogun | samuel.balogun@apolitical.co | TBD | [Profile](profiles/samuel-balogun.md) |
| Byron Sorgdrager | byron.sorgdrager@apolitical.co | Hydra | [Profile](profiles/byron-sorgdrager.md) |
| Ibrahim Idris | khalifa.idris@apolitical.co | Hydra | [Profile](profiles/ibrahim-idris.md) |
| Peter Shatwell | peter.shatwell@apolitical.co | Data | [Profile](profiles/peter-shatwell.md) |
| Romilly Eveleigh | romilly.eveleigh@apolitical.co | Hydra | [Profile](profiles/romilly-eveleigh.md) |
| Leonardo Maglio | leonardo.maglio@apolitical.co | Hydra | [Profile](profiles/leonardo-maglio.md) |
| Renzo Rozza Gonzalez | renzo.rozza@apolitical.co | TBD | [Profile](profiles/renzo-rozza.md) |
| Charles Killer | charles.killer@apolitical.co | Think Tank | [Profile](profiles/charles-killer.md) |
| Chih-Yuan Yang | yang.chih-yuan@apolitical.co | Data | [Profile](profiles/chih-yuan-yang.md) |
| Dominic Harries | dominic.harries@apolitical.co | Hydra | [Profile](profiles/dominic-harries.md) |

## Scripts

### `update_profiles.py`

Main script for creating and updating profiles.

```bash
# Initialize all profiles (first time)
python update_profiles.py --init --all --force

# Initialize with custom "Profile Created" date
python update_profiles.py --init --all --force --created-date 2025-10-01

# Update all profiles (preserves manual content)
python update_profiles.py --all --force

# Update with data collection
python update_profiles.py --all --collect --force

# Update single person
python update_profiles.py --person "Name" --force

# Regenerate from template (WARNING: loses manual content)
python update_profiles.py --regenerate --all --force

# Dry run (preview changes)
python update_profiles.py --all --dry-run
```

### `slack_analyzer.py`

Analyzes Slack communications.

```bash
# Analyze all team members
python slack_analyzer.py --all

# Analyze specific person
python slack_analyzer.py --person "Name" --months 12

# Custom output directory
python slack_analyzer.py --all --output /path/to/output
```

### `import_analytics.py`

Imports metrics from dev-analytics.

```bash
# Import all available reports
python import_analytics.py

# List available reports
python import_analytics.py --list

# Import specific period
python import_analytics.py --period 2025-01
```

### `generate_summary.py`

Generates team-wide views.

```bash
# Generate all summaries
python generate_summary.py --all

# Generate specific view
python generate_summary.py --summary
python generate_summary.py --matrix
```

## Performance Review Usage

These profiles support a continuous feedback model. See [Maintenance Guide](docs/MAINTENANCE_GUIDE.md) for full details.

### Recommended Cadence

| Frequency | Action |
|-----------|--------|
| **Weekly** | Add 1:1 notes, evidence log entries (manual edits, no script needed) |
| **Monthly** | `python update_profiles.py --all --collect --force` |
| **Quarterly** | Full review - update ratings, strengths, development areas, goals |
| **Annual** | Archive & optionally re-initialize for new review cycle |

### Key Points

- **`--init`** creates fresh profiles using each person's start date from Humaans
- **Regular updates** preserve all manual content (ratings, notes, evidence)
- **`--regenerate`** resets everything - use only for template migrations
- Profiles track from employee start date, not system setup date

## Configuration

Edit `config.yaml` to:

- Add/remove team members
- Update squad assignments
- Change data source paths
- Modify analysis thresholds

## Documentation

- [Maintenance Guide](docs/MAINTENANCE_GUIDE.md) - How to keep profiles updated, **performance review best practices**
- [Profile Guide](docs/PROFILE_GUIDE.md) - How to interpret profiles

## Privacy

- `data/` directory is gitignored (contains raw Slack exports)
- Profiles contain synthesized insights, not raw message content
- Private DM content is summarized, not quoted
- Treat all profiles as confidential management documents

## Troubleshooting

### "Slack token not found"

Run the main project setup:
```bash
cd ~/Dev/Apolitical/apolitical-assistant
npm run setup
```

### "Dev analytics repo not found"

Update the path in `config.yaml` or ensure the repo exists at:
```bash
~/Dev/apolitical-dev-analytics
```

### Empty profiles

Run data collection first:
```bash
python slack_analyzer.py --all
python import_analytics.py
python update_profiles.py --all --force
```
