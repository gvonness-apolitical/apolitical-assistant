#!/usr/bin/env python3
"""
Profile Update Script

Main script for managing team member profiles. Coordinates data collection
from multiple sources (Slack, dev-analytics, Humaans) and updates profile documents.

Usage:
  # Initialize profiles for all team members
  python update_profiles.py --init --all

  # Initialize with a specific creation date (e.g., when you started tracking)
  python update_profiles.py --init --all --created-date 2025-10-01

  # Update existing profiles with latest data
  python update_profiles.py --all --force

  # Update with fresh data collection
  python update_profiles.py --all --collect --force

Section Types:
- AUTO-UPDATED: Refreshed automatically from data sources
- MANUAL: Requires human input, preserved on updates
- APPEND-ONLY: New entries added, existing content never overwritten
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
PROFILES_DIR = PROJECT_DIR / "profiles"
DATA_DIR = PROJECT_DIR / "data"
TEMPLATE_PATH = PROJECT_DIR / "templates" / "profile_template.md"
HUMAANS_DATA_PATH = DATA_DIR / "humaans"
NOTION_DATA_PATH = DATA_DIR / "notion"
RFC_ENGAGEMENT_FILE = NOTION_DATA_PATH / "rfc_engagement.json"
EMAIL_DATA_PATH = DATA_DIR / "email"
EMAIL_ENGAGEMENT_FILE = EMAIL_DATA_PATH / "email_engagement.json"
MEETING_DATA_PATH = DATA_DIR / "meetings"
MEETING_ENGAGEMENT_FILE = MEETING_DATA_PATH / "meeting_engagement.json"

# Section markers for parsing
SECTION_PATTERN = re.compile(r'^## (\d+)\. (.+)$', re.MULTILINE)
AUTO_UPDATED_SECTIONS = {1, 2, 3, 4}  # Profile Overview, Delivery, RFC, Communication
MANUAL_SECTIONS = {5, 6, 7, 8, 9, 10}  # Leadership, Engineering Values, Skills, etc.
APPEND_ONLY_SECTIONS = {11, 12}  # 1:1 Notes, Evidence Log


def load_config() -> dict:
    """Load configuration from config.yaml"""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def load_template() -> str:
    """Load the profile template"""
    with open(TEMPLATE_PATH) as f:
        return f.read()


def load_slack_data(member_key: str) -> Optional[dict]:
    """Load Slack analysis data for a team member"""
    slack_file = DATA_DIR / "slack" / f"{member_key}_slack.json"
    if slack_file.exists():
        with open(slack_file) as f:
            return json.load(f)
    return None


def load_analytics_data(member_key: str) -> Optional[dict]:
    """Load analytics data for a team member"""
    analytics_file = DATA_DIR / "analytics" / f"{member_key}_analytics.json"
    if analytics_file.exists():
        with open(analytics_file) as f:
            return json.load(f)
    return None


def load_humaans_data(email: str) -> Optional[dict]:
    """Load Humaans data for a team member by email"""
    # Email-based filename (sanitize for filesystem)
    safe_email = email.replace("@", "_at_").replace(".", "_")
    humaans_file = HUMAANS_DATA_PATH / f"{safe_email}.json"
    if humaans_file.exists():
        with open(humaans_file) as f:
            return json.load(f)
    return None


def load_rfc_engagement_data() -> Optional[dict]:
    """Load RFC engagement data from Notion export"""
    if RFC_ENGAGEMENT_FILE.exists():
        with open(RFC_ENGAGEMENT_FILE) as f:
            return json.load(f)
    return None


def get_rfc_data_for_member(email: str) -> Optional[dict]:
    """Get RFC engagement data for a specific team member"""
    rfc_data = load_rfc_engagement_data()
    if not rfc_data:
        return None
    return rfc_data.get("team_engagement", {}).get(email)


def load_email_engagement_data() -> Optional[dict]:
    """Load email engagement data from the JSON file"""
    if EMAIL_ENGAGEMENT_FILE.exists():
        with open(EMAIL_ENGAGEMENT_FILE) as f:
            return json.load(f)
    return None


def get_email_data_for_member(email: str) -> Optional[dict]:
    """Get email engagement data for a specific team member"""
    email_data = load_email_engagement_data()
    if not email_data:
        return None
    return email_data.get("team_engagement", {}).get(email)


def load_meeting_engagement_data() -> Optional[dict]:
    """Load meeting engagement data from the JSON file"""
    if MEETING_ENGAGEMENT_FILE.exists():
        with open(MEETING_ENGAGEMENT_FILE) as f:
            return json.load(f)
    return None


def get_meeting_data_for_member(email: str) -> Optional[dict]:
    """Get meeting engagement data for a specific team member"""
    meeting_data = load_meeting_engagement_data()
    if not meeting_data:
        return None
    return meeting_data.get("team_engagement", {}).get(email)


def parse_profile_sections(content: str) -> dict:
    """
    Parse a profile into sections by numbered headers.

    Returns dict mapping section number to content:
    {
        1: "## 1. Profile Overview\n...",
        2: "## 2. Delivery Performance\n...",
        ...
        "update_history": "## Update History\n...",
        "footer": "*This is a living document...*"
    }
    """
    sections = {}

    # Find all section headers and their positions
    matches = list(SECTION_PATTERN.finditer(content))

    for i, match in enumerate(matches):
        section_num = int(match.group(1))
        start = match.start()

        # End is either next section or Update History or end of content
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            # Look for Update History section
            update_match = re.search(r'^## Update History', content[start:], re.MULTILINE)
            if update_match:
                end = start + update_match.start()
            else:
                end = len(content)

        sections[section_num] = content[start:end].rstrip('\n') + '\n'

    # Extract Update History section
    update_match = re.search(r'^## Update History.*', content, re.MULTILINE | re.DOTALL)
    if update_match:
        update_content = update_match.group(0)
        # Strip footer if present
        footer_match = re.search(r'\n\*This is a living document.*', update_content, re.DOTALL)
        if footer_match:
            sections["update_history"] = update_content[:footer_match.start()].rstrip('\n') + '\n'
            sections["footer"] = footer_match.group(0).strip()
        else:
            sections["update_history"] = update_content.rstrip('\n') + '\n'

    return sections


def extract_metrics_history(content: str) -> list:
    """
    Extract existing metrics history rows from a profile.
    Returns list of row strings (without header).
    """
    # Look for the Metrics History table
    match = re.search(
        r'### Metrics History.*?\n\|.*?\|.*?\n\|[-\s|]+\n((?:\|.*\n)*)',
        content,
        re.MULTILINE
    )
    if match:
        rows = match.group(1).strip().split('\n')
        return [r for r in rows if r.strip() and r.strip() != '{{METRICS_HISTORY}}']
    return []


def extract_update_history(content: str) -> list:
    """
    Extract existing update history rows from a profile.
    Returns list of row strings (without header).
    """
    # Look for the Update History table - capture only table rows (lines starting with |)
    match = re.search(
        r'## Update History.*?\n\|[^\n]+\|[^\n]*\n\|[-\s|]+\n((?:\|[^\n]+\n)*)',
        content,
        re.MULTILINE
    )
    if match:
        rows_text = match.group(1).strip()
        if not rows_text:
            return []
        rows = rows_text.split('\n')
        # Filter to only table rows and exclude placeholders
        return [
            r.strip() for r in rows
            if r.strip().startswith('|') and '{{UPDATE_HISTORY}}' not in r
        ]
    return []


def generate_metrics_snapshot(analytics_data: Optional[dict], period: str = None) -> Optional[str]:
    """
    Generate a metrics history row from analytics data.

    Returns a table row string like:
    | 2026-01 | 12 | 25 | +1500/-800 | Strong month |

    Returns None if no data available.
    """
    if not analytics_data or not analytics_data.get("periods"):
        return None

    periods = sorted(analytics_data.get("periods", {}).keys(), reverse=True)
    if not periods:
        return None

    # Use specified period or most recent
    target_period = period if period and period in periods else periods[0]
    period_data = analytics_data["periods"].get(target_period, {})
    metrics = period_data.get("metrics", {})

    prs = metrics.get("prs_merged", "N/A")
    reviews = metrics.get("reviews", "N/A")
    lines_added = metrics.get("lines_added", 0) or 0
    lines_deleted = metrics.get("lines_deleted", 0) or 0
    lines_str = f"+{lines_added}/-{lines_deleted}"

    return f"| {target_period} | {prs} | {reviews} | {lines_str} | |"


def should_add_metrics_snapshot(existing_content: str, period: str) -> bool:
    """
    Check if we should add a new metrics snapshot for this period.

    Returns True if the period is not already in the metrics history.
    """
    existing_rows = extract_metrics_history(existing_content)
    for row in existing_rows:
        if period in row:
            return False
    return True


def merge_profiles(
    new_content: str,
    existing_content: str,
    data_sources_updated: list,
    analytics_data: Optional[dict] = None
) -> str:
    """
    Merge new auto-generated content with existing manual/append-only sections.

    - AUTO-UPDATED sections (1-4): Use new content
    - MANUAL sections (5-10): Preserve existing content
    - APPEND-ONLY sections (11-12): Preserve existing content
    - Metrics History: Preserve existing rows, add new snapshot if period not present
    - Update History: Append new entry
    """
    new_sections = parse_profile_sections(new_content)
    existing_sections = parse_profile_sections(existing_content)

    # Start building merged content
    merged_parts = []

    # Get header (everything before section 1)
    header_match = re.match(r'^(.*?)(?=## 1\.)', new_content, re.DOTALL)
    if header_match:
        header = header_match.group(1).rstrip('\n-').strip()
        merged_parts.append(header)

    # Process each numbered section
    for section_num in range(1, 13):
        section_content = None
        if section_num in AUTO_UPDATED_SECTIONS:
            # Use new auto-generated content
            if section_num in new_sections:
                section_content = new_sections[section_num]
        elif section_num in MANUAL_SECTIONS or section_num in APPEND_ONLY_SECTIONS:
            # Preserve existing content if available
            if section_num in existing_sections:
                section_content = existing_sections[section_num]
            elif section_num in new_sections:
                # Fall back to template if no existing content
                section_content = new_sections[section_num]

        if section_content:
            # Clean up section: remove trailing separators and footer
            section_content = section_content.rstrip('\n').rstrip('-').rstrip('\n')
            # Remove footer if present in section
            section_content = re.sub(r'\n\*This is a living document.*$', '', section_content, flags=re.DOTALL)
            merged_parts.append(section_content.strip())

    # Handle Metrics History - preserve existing rows and optionally add new snapshot
    existing_metrics_rows = extract_metrics_history(existing_content)

    # Check if we should add a new metrics snapshot
    new_snapshot = None
    if analytics_data and analytics_data.get("periods"):
        latest_period = sorted(analytics_data["periods"].keys(), reverse=True)[0]
        if should_add_metrics_snapshot(existing_content, latest_period):
            new_snapshot = generate_metrics_snapshot(analytics_data, latest_period)

    # Build metrics rows list (new snapshot at top)
    all_metrics_rows = []
    if new_snapshot:
        all_metrics_rows.append(new_snapshot)
    all_metrics_rows.extend(existing_metrics_rows)

    # Join sections with single separator
    merged_content = '\n\n---\n\n'.join(merged_parts)

    # Replace metrics history placeholder
    if all_metrics_rows:
        metrics_rows_str = '\n'.join(all_metrics_rows)
        merged_content = merged_content.replace('{{METRICS_HISTORY}}', metrics_rows_str)
    else:
        merged_content = merged_content.replace('{{METRICS_HISTORY}}', '')

    # Handle Update History - preserve and append
    existing_update_rows = extract_update_history(existing_content)
    today = datetime.now().strftime("%Y-%m-%d")
    sources_str = ", ".join(data_sources_updated) if data_sources_updated else "Auto-refresh"
    new_update_row = f"| {today} | Profile refreshed | {sources_str} |"

    # Build update history
    all_update_rows = [new_update_row] + existing_update_rows  # New entries at top
    update_rows_str = '\n'.join(all_update_rows)

    # Add Update History section and footer
    update_history_section = f"""## Update History

<!-- AUTO-APPENDED: Log of each profile update -->

| Date | Changes | Data Sources Refreshed |
|------|---------|------------------------|
{update_rows_str}

---

*This is a living document. Sections marked AUTO-UPDATED refresh automatically. Sections marked MANUAL or APPEND-ONLY require human input.*
"""

    merged_content += '\n\n---\n\n' + update_history_section

    # Clean up any double separators
    merged_content = re.sub(r'(\n---\n\n)+', '\n\n---\n\n', merged_content)
    merged_content = re.sub(r'^---\n', '', merged_content)  # Remove leading separator

    return merged_content


def save_humaans_data(email: str, data: dict):
    """Save Humaans data for a team member"""
    HUMAANS_DATA_PATH.mkdir(parents=True, exist_ok=True)
    safe_email = email.replace("@", "_at_").replace(".", "_")
    humaans_file = HUMAANS_DATA_PATH / f"{safe_email}.json"
    with open(humaans_file, "w") as f:
        json.dump(data, f, indent=2, default=str)


def fetch_humaans_data(config: dict) -> dict:
    """
    Fetch data from Humaans API for all team members.

    Returns a dict mapping email -> employee data
    """
    try:
        from humaans_client import HumaansClient
    except ImportError:
        print("Warning: humaans_client module not found")
        return {}

    print("\nFetching data from Humaans API...")
    client = HumaansClient()
    results = {}

    for member in config["team_members"]:
        email = member["email"]
        print(f"  Fetching: {member['name']} ({email})")
        try:
            data = client.get_employee_data(email)
            if data:
                results[email] = data
                save_humaans_data(email, data)
                calc = data.get("calculated", {})
                print(f"    Level: {calc.get('level', 'Not found')}")
                print(f"    Job Title: {calc.get('job_title', 'N/A')}")
            else:
                print(f"    Warning: No data found")
        except Exception as e:
            print(f"    Error: {e}")

    return results


def format_slack_section(slack_data: Optional[dict]) -> str:
    """Format Slack data for the profile"""
    if not slack_data or "public_channels" not in slack_data:
        return """### Public Channels

| Metric | Value |
|--------|-------|
| **Total Messages** | *Not yet analyzed* |
| **Average Message Length** | |
| **Messages per Week** | |
| **Most Active Channels** | |
| **Peak Activity Times** | |

**Communication Patterns:**
- Tone and voice: *To be assessed*
- Clarity and structure: *To be assessed*
- Technical vs. non-technical balance: *To be assessed*
- Engagement style: *To be assessed*
- Collaboration indicators: *To be assessed*"""

    public = slack_data["public_channels"]
    metrics = public.get("metrics", {})
    channels = public.get("channel_breakdown", {})

    # Top channels
    top_channels = ", ".join(list(channels.keys())[:5]) if channels else "N/A"

    # Peak times
    peak_hour = metrics.get("peak_activity_hour")
    peak_day = metrics.get("peak_activity_day")
    peak_time = f"{peak_hour}:00" if peak_hour is not None else "N/A"

    return f"""### Public Channels

| Metric | Value |
|--------|-------|
| **Total Messages** | {metrics.get('total_messages', 'N/A')} |
| **Average Message Length** | {metrics.get('average_message_length', 'N/A')} chars |
| **Messages per Week** | {metrics.get('messages_per_week', 'N/A')} |
| **Most Active Channels** | {top_channels} |
| **Peak Activity Times** | {peak_day or 'N/A'} @ {peak_time} |

**Communication Patterns:**
- Tone and voice: *To be assessed*
- Clarity and structure: *To be assessed*
- Technical vs. non-technical balance: *To be assessed*
- Engagement style: *To be assessed*
- Collaboration indicators: *To be assessed*"""


def format_analytics_section(analytics_data: Optional[dict]) -> str:
    """Format analytics data for the profile"""
    if not analytics_data or not analytics_data.get("periods"):
        return """### DORA Metrics

| Metric | Value | Rating | Trend |
|--------|-------|--------|-------|
| **Deployment Frequency** | *Not yet imported* | | |
| **Lead Time for Changes** | | | |
| **Change Failure Rate** | | | |
| **Mean Time to Recovery** | | | |

### Contribution Metrics

| Metric | Current Period | Previous Period | Trend |
|--------|----------------|-----------------|-------|
| PRs Merged | | | |
| Review Turnaround (avg) | | | |
| Lines Added | | | |
| Lines Deleted | | | |
| Code Review Participation | | | |
| CI Pass Rate | | | |"""

    # Get most recent period
    periods = sorted(analytics_data.get("periods", {}).keys(), reverse=True)
    if not periods:
        return format_analytics_section(None)

    current_period = periods[0]
    previous_period = periods[1] if len(periods) > 1 else None

    current = analytics_data["periods"][current_period]
    previous = analytics_data["periods"].get(previous_period, {}) if previous_period else {}

    current_metrics = current.get("metrics", {})
    current_dora = current.get("dora", {})
    previous_metrics = previous.get("metrics", {})

    # Calculate trends
    def trend(current_val, previous_val):
        if current_val is None or previous_val is None:
            return ""
        try:
            current_val = float(current_val)
            previous_val = float(previous_val)
            if current_val > previous_val:
                return "📈"
            elif current_val < previous_val:
                return "📉"
            else:
                return "➡️"
        except (ValueError, TypeError):
            return ""

    pr_trend = trend(
        current_metrics.get("prs_merged"),
        previous_metrics.get("prs_merged"),
    )

    return f"""### DORA Metrics

| Metric | Value | Rating | Trend |
|--------|-------|--------|-------|
| **Deployment Frequency** | {current_dora.get('deployment_frequency', 'N/A')} | | |
| **Lead Time for Changes** | {current_dora.get('lead_time', 'N/A')} | | |
| **Change Failure Rate** | {current_dora.get('change_failure_rate', 'N/A')} | | |
| **Mean Time to Recovery** | {current_dora.get('mttr', 'N/A')} | | |

### Contribution Metrics ({current_period})

| Metric | Current Period | Previous Period | Trend |
|--------|----------------|-----------------|-------|
| PRs Merged | {current_metrics.get('prs_merged', 'N/A')} | {previous_metrics.get('prs_merged', 'N/A')} | {pr_trend} |
| Reviews | {current_metrics.get('reviews', 'N/A')} | {previous_metrics.get('reviews', 'N/A')} | |
| Lines Added | {current_metrics.get('lines_added', 'N/A')} | {previous_metrics.get('lines_added', 'N/A')} | |
| Lines Deleted | {current_metrics.get('lines_deleted', 'N/A')} | {previous_metrics.get('lines_deleted', 'N/A')} | |"""


def format_rfc_section(rfc_data: Optional[dict]) -> tuple:
    """
    Format RFC engagement data for the profile.
    Returns tuple of (authored_count, contributed_count, authored_list, contributed_list, rfc_date)
    """
    if not rfc_data:
        return (
            "0",
            "0",
            "*No RFCs authored*",
            "*No RFC contributions*",
            "Not available",
        )

    totals = rfc_data.get("totals", {})
    authored_count = str(totals.get("authored", 0))
    contributed_count = str(totals.get("contributed", 0))

    # Format authored list
    authored = rfc_data.get("rfcs_authored", [])
    if authored:
        authored_lines = []
        for rfc in authored:
            title = rfc.get("title", "Unknown")
            status = rfc.get("status", "Unknown")
            url = rfc.get("url", "")
            if url:
                authored_lines.append(f"- [{title}]({url}) ({status})")
            else:
                authored_lines.append(f"- {title} ({status})")
        authored_list = "\n".join(authored_lines)
    else:
        authored_list = "*No RFCs authored*"

    # Format contributed list
    contributed = rfc_data.get("rfcs_contributed", [])
    if contributed:
        contributed_lines = []
        for rfc in contributed:
            title = rfc.get("title", "Unknown")
            url = rfc.get("url", "")
            role = rfc.get("role", "Contributor")
            if url:
                contributed_lines.append(f"- [{title}]({url}) - {role}")
            else:
                contributed_lines.append(f"- {title} - {role}")
        contributed_list = "\n".join(contributed_lines)
    else:
        contributed_list = "*No RFC contributions*"

    # Get RFC data date from the main file
    full_rfc_data = load_rfc_engagement_data()
    rfc_date = full_rfc_data.get("analysis_date", "Unknown") if full_rfc_data else "Not available"

    return (authored_count, contributed_count, authored_list, contributed_list, rfc_date)


def format_email_section(email_data: Optional[dict]) -> tuple:
    """
    Format email engagement data for profile insertion.

    Returns tuple of:
    - total_emails: str
    - avg_length: str
    - response_rate: str
    - avg_response_time: str
    - patterns: str (formatted bullet list)
    - notable: str (formatted bullet list)
    - email_date: str
    - email_period: str
    """
    if not email_data:
        return (
            "*Not yet analyzed*",
            "",
            "",
            "",
            "*To be assessed*",
            "*None captured*",
            "Not analyzed",
            "N/A",
        )

    metrics = email_data.get("metrics", {})
    patterns = email_data.get("patterns", {})
    notable = email_data.get("notable_emails", [])

    # Format metrics
    total_emails = str(metrics.get("total_emails", "*Not yet analyzed*"))
    avg_length = str(metrics.get("average_length", "")) if metrics.get("average_length") else ""
    response_rate = str(metrics.get("response_rate", "")) if metrics.get("response_rate") else ""
    avg_response_time = str(metrics.get("average_response_time", "")) if metrics.get("average_response_time") else ""

    # Format communication patterns
    pattern_items = []
    if patterns.get("tone"):
        pattern_items.append(f"Tone: {patterns['tone']}")
    if patterns.get("clarity"):
        pattern_items.append(f"Clarity: {patterns['clarity']}")
    if patterns.get("responsiveness"):
        pattern_items.append(f"Responsiveness: {patterns['responsiveness']}")
    if patterns.get("detail_level"):
        pattern_items.append(f"Detail level: {patterns['detail_level']}")
    if patterns.get("proactiveness"):
        pattern_items.append(f"Proactiveness: {patterns['proactiveness']}")

    formatted_patterns = "\n".join(f"- {item}" for item in pattern_items) if pattern_items else "*To be assessed*"

    # Format notable emails
    if notable:
        notable_items = []
        for email in notable[:5]:  # Limit to 5 examples
            date = email.get("date", "Unknown date")
            subject = email.get("subject", "No subject")
            summary = email.get("summary", "")
            notable_items.append(f"- **{date}**: {subject}" + (f" - {summary}" if summary else ""))
        formatted_notable = "\n".join(notable_items)
    else:
        formatted_notable = "*None captured*"

    # Get dates
    email_date = email_data.get("analysis_date", "Not analyzed")
    email_period = email_data.get("analysis_period", "N/A")

    return (
        total_emails,
        avg_length,
        response_rate,
        avg_response_time,
        formatted_patterns,
        formatted_notable,
        email_date,
        email_period,
    )


def format_meeting_section(meeting_data: Optional[dict]) -> tuple:
    """
    Format meeting engagement data for profile insertion.

    Returns tuple of:
    - meetings_attended: str
    - contribution_mentions: str
    - action_items: str
    - engagement_summary: str (formatted bullet list)
    - notable_contributions: str (formatted bullet list)
    - meeting_date: str
    - meeting_period: str
    """
    if not meeting_data:
        return (
            "*Not yet analyzed*",
            "",
            "",
            "*To be assessed*",
            "*None captured*",
            "Not analyzed",
            "N/A",
        )

    metrics = meeting_data.get("metrics", {})
    patterns = meeting_data.get("engagement_patterns", {})
    notable = meeting_data.get("notable_contributions", [])

    # Format metrics
    meetings_attended = str(metrics.get("meetings_attended", "*Not yet analyzed*"))
    contribution_mentions = str(metrics.get("contribution_mentions", "")) if metrics.get("contribution_mentions") else ""
    action_items = str(metrics.get("action_items_assigned", "")) if metrics.get("action_items_assigned") else ""

    # Format engagement patterns
    pattern_items = []
    if patterns.get("participation_level"):
        pattern_items.append(f"Participation: {patterns['participation_level']}")
    if patterns.get("contribution_quality"):
        pattern_items.append(f"Contribution quality: {patterns['contribution_quality']}")
    if patterns.get("initiative"):
        pattern_items.append(f"Initiative: {patterns['initiative']}")
    if patterns.get("collaboration"):
        pattern_items.append(f"Collaboration: {patterns['collaboration']}")
    if patterns.get("follow_through"):
        pattern_items.append(f"Follow-through: {patterns['follow_through']}")

    engagement_summary = "\n".join(f"- {item}" for item in pattern_items) if pattern_items else "*To be assessed*"

    # Format notable contributions
    if notable:
        notable_items = []
        for contrib in notable[:5]:  # Limit to 5 examples
            meeting = contrib.get("meeting", "Unknown meeting")
            date = contrib.get("date", "Unknown date")
            contribution = contrib.get("contribution", "")
            notable_items.append(f"- **{meeting}** ({date}): {contribution}")
        notable_contributions = "\n".join(notable_items)
    else:
        notable_contributions = "*None captured*"

    # Get dates
    meeting_date = meeting_data.get("analysis_date", "Not analyzed")
    meeting_period = meeting_data.get("analysis_period", "N/A")

    return (
        meetings_attended,
        contribution_mentions,
        action_items,
        engagement_summary,
        notable_contributions,
        meeting_date,
        meeting_period,
    )


def generate_profile(member: dict, template: str, created_date: str = None) -> str:
    """
    Generate a profile document for a team member.

    Args:
        member: Team member configuration dict
        template: Profile template string
        created_date: Optional date string (YYYY-MM-DD) for when profile was created.
                     Defaults to today if not specified.
    """
    member_key = member["profile_file"].replace(".md", "")
    profile_created = created_date or datetime.now().strftime("%Y-%m-%d")

    # Load data
    slack_data = load_slack_data(member_key)
    analytics_data = load_analytics_data(member_key)
    humaans_data = load_humaans_data(member["email"])
    rfc_data = get_rfc_data_for_member(member["email"])
    email_data = get_email_data_for_member(member["email"])
    meeting_data = get_meeting_data_for_member(member["email"])

    # Extract Humaans data if available
    humaans_calc = humaans_data.get("calculated", {}) if humaans_data else {}
    humaans_person = humaans_data.get("person", {}) if humaans_data else {}

    # Determine data freshness
    slack_date = "Not analyzed"
    slack_period = "N/A"
    if slack_data and "public_channels" in slack_data:
        slack_date = slack_data["public_channels"].get("analysis_date", "Unknown")[:10]
        slack_period = f"Last {slack_data['public_channels'].get('analysis_period_months', 12)} months"

    analytics_date = "Not imported"
    analytics_period = "N/A"
    if analytics_data and analytics_data.get("periods"):
        periods = sorted(analytics_data["periods"].keys())
        if periods:
            analytics_date = datetime.now().strftime("%Y-%m-%d")
            analytics_period = f"{periods[0]} to {periods[-1]}"

    # Determine level - prefer Humaans data, then config
    level = humaans_calc.get("level") or member.get("level", "TBD")

    # Determine start date - prefer Humaans data, then config
    start_date = humaans_calc.get("start_date") or member.get("start_date", "TBD")

    # Calculate time in role/tenure
    tenure_str = "TBD"
    if humaans_calc.get("tenure_years") is not None:
        years = humaans_calc.get("tenure_years", 0)
        months = humaans_calc.get("tenure_months", 0)
        if years > 0:
            tenure_str = f"{years} year{'s' if years != 1 else ''}"
            if months > 0:
                tenure_str += f", {months} month{'s' if months != 1 else ''}"
        elif months > 0:
            tenure_str = f"{months} month{'s' if months != 1 else ''}"
        else:
            tenure_str = "< 1 month"

    # Determine job title/role - prefer Humaans data
    job_title = humaans_calc.get("job_title") or member.get("role", "Software Engineer")

    # Determine Humaans data freshness
    humaans_date = "Not fetched"
    if humaans_data:
        humaans_date = datetime.now().strftime("%Y-%m-%d")

    # Format RFC data
    (
        rfc_authored_count,
        rfc_contributed_count,
        rfc_authored_list,
        rfc_contributed_list,
        rfc_date,
    ) = format_rfc_section(rfc_data)

    # Format email data
    (
        email_total,
        email_avg_length,
        email_response_rate,
        email_avg_response_time,
        email_patterns,
        email_notable,
        email_date,
        email_period,
    ) = format_email_section(email_data)

    # Format meeting data
    (
        meeting_attended,
        meeting_mentions,
        meeting_actions,
        meeting_engagement,
        meeting_notable,
        meeting_date,
        meeting_period,
    ) = format_meeting_section(meeting_data)

    # Replace template placeholders
    profile = template
    replacements = {
        "{{NAME}}": member["name"],
        "{{EMAIL}}": member["email"],
        "{{ROLE}}": job_title,
        "{{LEVEL}}": level,
        "{{SQUAD}}": member.get("squad", "TBD"),
        "{{START_DATE}}": start_date,
        "{{TIME_IN_ROLE}}": tenure_str,
        "{{PROFILE_CREATED}}": profile_created,
        "{{LAST_UPDATED}}": datetime.now().strftime("%Y-%m-%d"),
        "{{SLACK_PUBLIC_DATE}}": slack_date,
        "{{SLACK_PUBLIC_PERIOD}}": slack_period,
        "{{SLACK_DM_DATE}}": "Manual review required",
        "{{SLACK_DM_PERIOD}}": "N/A",
        "{{DEV_ANALYTICS_DATE}}": analytics_date,
        "{{DEV_ANALYTICS_PERIOD}}": analytics_period,
        "{{HUMAANS_DATE}}": humaans_date,
        "{{NOTION_RFC_DATE}}": rfc_date,
        "{{RFC_AUTHORED_COUNT}}": rfc_authored_count,
        "{{RFC_CONTRIBUTED_COUNT}}": rfc_contributed_count,
        "{{RFC_AUTHORED_LIST}}": rfc_authored_list,
        "{{RFC_CONTRIBUTED_LIST}}": rfc_contributed_list,
        "{{EMAIL_DATE}}": email_date,
        "{{EMAIL_PERIOD}}": email_period,
        "{{EMAIL_TOTAL}}": email_total,
        "{{EMAIL_AVG_LENGTH}}": email_avg_length,
        "{{EMAIL_RESPONSE_RATE}}": email_response_rate,
        "{{EMAIL_AVG_RESPONSE_TIME}}": email_avg_response_time,
        "{{EMAIL_PATTERNS}}": email_patterns,
        "{{EMAIL_NOTABLE}}": email_notable,
        "{{MEETING_DATE}}": meeting_date,
        "{{MEETING_PERIOD}}": meeting_period,
        "{{MEETING_ATTENDED}}": meeting_attended,
        "{{MEETING_MENTIONS}}": meeting_mentions,
        "{{MEETING_ACTIONS}}": meeting_actions,
        "{{MEETING_ENGAGEMENT}}": meeting_engagement,
        "{{MEETING_NOTABLE}}": meeting_notable,
        "{{MANUAL_DATE}}": datetime.now().strftime("%Y-%m-%d"),
    }

    for placeholder, value in replacements.items():
        profile = profile.replace(placeholder, value)

    # Replace data sections with actual data
    # Find and replace the Communication Style section
    slack_section = format_slack_section(slack_data)
    profile = re.sub(
        r"### Public Channels\n\n\|.*?\*\*Communication Patterns:\*\*\n.*?(?=\n### Private|\n---)",
        slack_section,
        profile,
        flags=re.DOTALL,
    )

    # Find and replace the Delivery Performance section
    analytics_section = format_analytics_section(analytics_data)
    profile = re.sub(
        r"### DORA Metrics\n\n\|.*?### Contribution Metrics\n\n\|.*?(?=\n### Delivery Trends|\n---)",
        analytics_section,
        profile,
        flags=re.DOTALL,
    )

    return profile


def update_profile(
    member: dict,
    template: str,
    force: bool = False,
    data_sources: list = None,
    regenerate: bool = False,
    init: bool = False,
    created_date: str = None
) -> bool:
    """
    Update a single profile.

    Modes:
    - Default: Update AUTO-UPDATED sections, preserve MANUAL/APPEND-ONLY sections
    - --force: Same as default, but doesn't skip existing profiles
    - --init: Create new profile (errors if profile already exists unless --force)
    - --regenerate: Completely regenerate from template (loses all manual content!)

    Args:
        member: Team member configuration dict
        template: Profile template string
        force: Overwrite existing profiles
        data_sources: List of data sources that were refreshed
        regenerate: Regenerate from template (loses manual content)
        init: Initialize/create new profile
        created_date: Date string (YYYY-MM-DD) for profile creation date

    If the profile exists:
    - Preserve MANUAL and APPEND-ONLY sections
    - Update AUTO-UPDATED sections with fresh data
    - Append to Update History
    - Add metrics snapshot if new period available

    If --init is used:
    - Create new profile from template
    - Error if profile exists (unless --force)

    If --regenerate is used:
    - Completely overwrite with fresh template (WARNING: loses manual content)
    """
    profile_path = PROFILES_DIR / member["profile_file"]
    data_sources = data_sources or []
    member_key = member["profile_file"].replace(".md", "")

    # Check for init mode conflicts
    if init and profile_path.exists() and not force:
        print(f"  Error: Profile already exists. Use --force to overwrite or remove --init to update.")
        return False

    # Load analytics data for metrics history
    analytics_data = load_analytics_data(member_key)

    # For init mode, use employee start date from Humaans if no created_date specified
    effective_created_date = created_date
    if init and not created_date:
        humaans_data = load_humaans_data(member["email"])
        if humaans_data:
            humaans_calc = humaans_data.get("calculated", {})
            start_date = humaans_calc.get("start_date")
            if start_date:
                effective_created_date = start_date
                print(f"  Using employee start date from Humaans: {start_date}")

    # Generate new profile content from template
    new_content = generate_profile(member, template, effective_created_date)

    # Check if profile exists and determine update mode
    should_merge = profile_path.exists() and not regenerate and not init

    if should_merge:
        # Read existing content
        with open(profile_path) as f:
            existing_content = f.read()

        # Check if template structure has changed significantly
        existing_sections = parse_profile_sections(existing_content)
        new_sections = parse_profile_sections(new_content)

        # If section counts differ significantly, warn about structure change
        if len(existing_sections) > 0 and len(new_sections) > 0:
            if abs(len(existing_sections) - len(new_sections)) > 2:
                print(f"  Warning: Template structure has changed significantly")
                print(f"  Consider using --regenerate to update to new format")

        if force:
            # Force mode: merge to preserve manual sections
            print(f"  Merging with existing profile (preserving manual sections)...")
            profile_content = merge_profiles(new_content, existing_content, data_sources, analytics_data)
        else:
            # Regular update: merge to preserve all non-auto sections
            print(f"  Updating auto sections (preserving manual sections)...")
            profile_content = merge_profiles(new_content, existing_content, data_sources, analytics_data)
    else:
        # New profile, init mode, or regenerate: use template-generated content
        profile_content = new_content

        # Determine update type for history
        if regenerate and profile_path.exists():
            change_type = "Profile regenerated from template"
            print(f"  Regenerating profile from template (manual content will be lost)...")
        elif init:
            change_type = "Profile initialized"
            print(f"  Initializing new profile...")
        else:
            change_type = "Profile created"
            print(f"  Creating new profile...")

        # Add initial Update History entry
        today = datetime.now().strftime("%Y-%m-%d")
        sources_str = ", ".join(data_sources) if data_sources else "Initial creation"
        initial_row = f"| {today} | {change_type} | {sources_str} |"
        profile_content = profile_content.replace("{{UPDATE_HISTORY}}", initial_row)

        # Add initial metrics snapshot if analytics data available
        if analytics_data and analytics_data.get("periods"):
            latest_period = sorted(analytics_data["periods"].keys(), reverse=True)[0]
            initial_snapshot = generate_metrics_snapshot(analytics_data, latest_period)
            if initial_snapshot:
                profile_content = profile_content.replace("{{METRICS_HISTORY}}", initial_snapshot)

    # Clean up any remaining placeholders
    profile_content = profile_content.replace("{{METRICS_HISTORY}}", "")
    profile_content = profile_content.replace("{{UPDATE_HISTORY}}", "")

    # Ensure directory exists
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)

    # Write profile
    with open(profile_path, "w") as f:
        f.write(profile_content)

    print(f"  Saved: {profile_path}")
    return True


def update_all_profiles(
    config: dict,
    force: bool = False,
    since: Optional[str] = None,
    data_sources: list = None,
    regenerate: bool = False,
    init: bool = False,
    created_date: str = None
) -> dict:
    """
    Update all team member profiles.

    Args:
        config: Configuration dict with team_members list
        force: Overwrite existing profiles
        since: Only include data since this date (not yet implemented)
        data_sources: List of data sources that were refreshed
        regenerate: Regenerate from template (loses manual content)
        init: Initialize/create new profiles
        created_date: Date string (YYYY-MM-DD) for profile creation date
    """
    template = load_template()
    results = {"updated": [], "skipped": [], "errors": []}
    data_sources = data_sources or []

    for member in config["team_members"]:
        print(f"\nProcessing: {member['name']}")
        try:
            if update_profile(member, template, force, data_sources, regenerate, init, created_date):
                results["updated"].append(member["name"])
            else:
                results["skipped"].append(member["name"])
        except Exception as e:
            print(f"  Error: {e}")
            results["errors"].append({"name": member["name"], "error": str(e)})

    return results


def run_data_collection(
    config: dict, slack: bool = True, analytics: bool = True, humaans: bool = True
):
    """Run data collection scripts"""
    import subprocess

    if humaans:
        print("\n" + "=" * 60)
        print("Fetching Humaans data...")
        print("=" * 60)
        try:
            fetch_humaans_data(config)
        except Exception as e:
            print(f"Warning: Humaans fetch encountered errors: {e}")

    if slack:
        print("\n" + "=" * 60)
        print("Running Slack analysis...")
        print("=" * 60)
        result = subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "slack_analyzer.py"), "--all"],
            cwd=SCRIPT_DIR,
        )
        if result.returncode != 0:
            print("Warning: Slack analysis encountered errors")

    if analytics:
        print("\n" + "=" * 60)
        print("Importing analytics data...")
        print("=" * 60)
        result = subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "import_analytics.py")],
            cwd=SCRIPT_DIR,
        )
        if result.returncode != 0:
            print("Warning: Analytics import encountered errors")


def main():
    parser = argparse.ArgumentParser(
        description="Update team member profiles with latest data"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Update all team member profiles",
    )
    parser.add_argument(
        "--person",
        type=str,
        help="Update profile for a specific person",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing profiles",
    )
    parser.add_argument(
        "--since",
        type=str,
        help="Only include data since this date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--collect",
        action="store_true",
        help="Run data collection before updating profiles",
    )
    parser.add_argument(
        "--no-slack",
        action="store_true",
        help="Skip Slack data collection",
    )
    parser.add_argument(
        "--no-analytics",
        action="store_true",
        help="Skip analytics data import",
    )
    parser.add_argument(
        "--no-humaans",
        action="store_true",
        help="Skip Humaans data fetch",
    )
    parser.add_argument(
        "--humaans-only",
        action="store_true",
        help="Only fetch Humaans data (skip Slack and analytics)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes",
    )
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="Regenerate profiles from template (WARNING: loses manual content)",
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize/create new profiles (errors if profile exists unless --force)",
    )
    parser.add_argument(
        "--created-date",
        type=str,
        metavar="YYYY-MM-DD",
        help="Set the 'Profile Created' date (defaults to today). Useful for initial setup.",
    )

    args = parser.parse_args()

    # Validate created-date format if provided
    if args.created_date:
        try:
            datetime.strptime(args.created_date, "%Y-%m-%d")
        except ValueError:
            print(f"Error: --created-date must be in YYYY-MM-DD format, got: {args.created_date}")
            sys.exit(1)

    # Load config
    config = load_config()

    # Track which data sources were collected
    data_sources_collected = []

    # Run data collection if requested
    if args.collect or args.humaans_only:
        if args.humaans_only:
            run_data_collection(config, slack=False, analytics=False, humaans=True)
            data_sources_collected.append("Humaans")
        else:
            run_data_collection(
                config,
                slack=not args.no_slack,
                analytics=not args.no_analytics,
                humaans=not args.no_humaans,
            )
            if not args.no_humaans:
                data_sources_collected.append("Humaans")
            if not args.no_slack:
                data_sources_collected.append("Slack")
            if not args.no_analytics:
                data_sources_collected.append("Dev Analytics")

    # Load template
    template = load_template()

    if args.dry_run:
        print("\nDRY RUN - No changes will be made")

    if args.all:
        action = "Initializing" if args.init else "Updating"
        print("\n" + "=" * 60)
        print(f"{action} all profiles...")
        print("=" * 60)

        if args.dry_run:
            for member in config["team_members"]:
                profile_path = PROFILES_DIR / member["profile_file"]
                status = "exists" if profile_path.exists() else "new"
                action_word = "initialize" if args.init else "update"
                print(f"  Would {action_word}: {member['name']} ({status})")
        else:
            results = update_all_profiles(
                config,
                args.force,
                args.since,
                data_sources_collected,
                args.regenerate,
                args.init,
                args.created_date,
            )
            print("\n" + "=" * 60)
            print("Summary")
            print("=" * 60)
            print(f"Updated: {len(results['updated'])}")
            print(f"Skipped: {len(results['skipped'])}")
            print(f"Errors: {len(results['errors'])}")

    elif args.person:
        # Find the person
        member = None
        for m in config["team_members"]:
            if m["name"].lower() == args.person.lower():
                member = m
                break

        if not member:
            print(f"Person not found: {args.person}")
            print("Available team members:")
            for m in config["team_members"]:
                print(f"  - {m['name']}")
            sys.exit(1)

        action = "Initializing" if args.init else "Updating"
        print(f"\n{action} profile for: {member['name']}")
        if args.dry_run:
            profile_path = PROFILES_DIR / member["profile_file"]
            status = "exists" if profile_path.exists() else "new"
            action_word = "initialize" if args.init else ("regenerate" if args.regenerate else "update")
            print(f"  Would {action_word}: {member['name']} ({status})")
        else:
            update_profile(
                member,
                template,
                args.force,
                data_sources_collected,
                args.regenerate,
                args.init,
                args.created_date,
            )

    else:
        parser.print_help()
        print("\nAvailable team members:")
        for m in config["team_members"]:
            print(f"  - {m['name']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
