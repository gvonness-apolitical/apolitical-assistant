"""
Formatting utilities for team profile sections.

Provides functions to format data from various sources (email, meetings, Slack)
into markdown sections for profile documents.
"""

from typing import Optional


def format_email_section(email_data: Optional[dict]) -> tuple:
    """
    Format email engagement data for profile insertion.

    Args:
        email_data: Email engagement data dictionary with metrics, patterns, and notable_emails

    Returns:
        Tuple of:
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

    Args:
        meeting_data: Meeting engagement data dictionary with metrics, engagement_patterns,
                     and notable_contributions

    Returns:
        Tuple of:
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


def format_slack_section(slack_data: Optional[dict]) -> str:
    """
    Format Slack data for the profile.

    Args:
        slack_data: Slack analysis data dictionary with public_channels metrics

    Returns:
        Formatted markdown section for Slack communication patterns
    """
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
