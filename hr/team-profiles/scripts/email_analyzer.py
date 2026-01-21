#!/usr/bin/env python3
"""
Email Communication Analyzer for Team Profiles

Analyzes email communications from direct reports to extract communication patterns,
metrics, and notable examples.

Unlike Slack analysis which uses direct API calls, Gmail analysis requires OAuth
and is performed manually via Claude Code with MCP tools. This script provides:
1. Data structure documentation
2. Functions to load and format email analysis data
3. Integration with update_profiles.py

Usage:
    # Manual analysis via Claude Code (see MAINTENANCE_GUIDE.md)
    # Then run profile updates to incorporate the data:
    python update_profiles.py --all --force
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
DATA_DIR = PROJECT_DIR / "data" / "email"
EMAIL_ENGAGEMENT_FILE = DATA_DIR / "email_engagement.json"


def load_config() -> dict:
    """Load configuration from config.yaml"""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


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


def format_email_section(email_data: Optional[dict]) -> tuple:
    """
    Format email data for profile insertion.

    Returns tuple of:
    - total_emails: str (count or "Not yet analyzed")
    - avg_length: str (average length or empty)
    - response_rate: str (response rate or empty)
    - avg_response_time: str (average response time or empty)
    - communication_patterns: str (bullet list of patterns)
    - notable_emails: str (bullet list of notable examples)
    - email_date: str (analysis date or "Not analyzed")
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

    communication_patterns = "\n".join(f"- {item}" for item in pattern_items) if pattern_items else "*To be assessed*"

    # Format notable emails
    if notable:
        notable_items = []
        for email in notable[:5]:  # Limit to 5 examples
            date = email.get("date", "Unknown date")
            subject = email.get("subject", "No subject")
            summary = email.get("summary", "")
            notable_items.append(f"- **{date}**: {subject}" + (f" - {summary}" if summary else ""))
        notable_emails = "\n".join(notable_items)
    else:
        notable_emails = "*None captured*"

    # Get analysis date
    email_date = email_data.get("analysis_date", "Not analyzed")

    return (
        total_emails,
        avg_length,
        response_rate,
        avg_response_time,
        communication_patterns,
        notable_emails,
        email_date,
    )


def create_empty_email_data() -> dict:
    """
    Create an empty email engagement data structure.
    Useful for initializing the data file.
    """
    config = load_config()

    team_engagement = {}
    for member in config["team_members"]:
        team_engagement[member["email"]] = {
            "name": member["name"],
            "metrics": {
                "total_emails": 0,
                "emails_received": 0,
                "emails_sent": 0,
                "average_length": None,
                "response_rate": None,
                "average_response_time": None,
            },
            "patterns": {
                "tone": None,
                "clarity": None,
                "responsiveness": None,
                "detail_level": None,
                "proactiveness": None,
            },
            "notable_emails": [],
            "analysis_date": None,
            "analysis_period": None,
        }

    return {
        "analysis_date": datetime.now().strftime("%Y-%m-%d"),
        "source": "Gmail via MCP",
        "team_engagement": team_engagement,
    }


def init_data_file():
    """Initialize the email engagement data file if it doesn't exist"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not EMAIL_ENGAGEMENT_FILE.exists():
        data = create_empty_email_data()
        with open(EMAIL_ENGAGEMENT_FILE, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Created empty email engagement file: {EMAIL_ENGAGEMENT_FILE}")
    else:
        print(f"Email engagement file already exists: {EMAIL_ENGAGEMENT_FILE}")


def print_data_structure():
    """Print the expected data structure for documentation"""
    structure = '''
Email Engagement Data Structure
================================

The email_engagement.json file should have the following structure:

{
  "analysis_date": "2026-01-20",
  "source": "Gmail via MCP",
  "team_engagement": {
    "email@apolitical.co": {
      "name": "Team Member Name",
      "metrics": {
        "total_emails": 150,           // Total emails in analysis period
        "emails_received": 100,         // Emails received from them
        "emails_sent": 50,              // Emails sent to them (replies)
        "average_length": "Medium",     // Short/Medium/Long
        "response_rate": "90%",         // % of emails that got a response
        "average_response_time": "4h"   // Average response time
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
          "type": "positive"  // positive, needs_attention, neutral
        }
      ],
      "analysis_date": "2026-01-20",
      "analysis_period": "Last 12 months"
    }
  }
}

How to Gather This Data
========================

1. Open Claude Code in the apolitical-assistant directory
2. For each direct report, search their emails:

   "Search my Gmail for emails from samuel.balogun@apolitical.co in the last 12 months
   and analyze their communication patterns"

3. Update the email_engagement.json file with the analysis results
4. Run profile updates: python update_profiles.py --all --force
'''
    print(structure)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Email Communication Analyzer utilities"
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize empty email engagement data file",
    )
    parser.add_argument(
        "--structure",
        action="store_true",
        help="Print the expected data structure",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if email data exists and show summary",
    )

    args = parser.parse_args()

    if args.init:
        init_data_file()
    elif args.structure:
        print_data_structure()
    elif args.check:
        data = load_email_engagement_data()
        if data:
            print(f"Email engagement data found (analyzed: {data.get('analysis_date', 'Unknown')})")
            team = data.get("team_engagement", {})
            for email, info in team.items():
                analyzed = info.get("analysis_date")
                total = info.get("metrics", {}).get("total_emails", 0)
                status = f"Analyzed ({total} emails)" if analyzed else "Not analyzed"
                print(f"  - {info.get('name', email)}: {status}")
        else:
            print("No email engagement data found.")
            print("Run with --init to create the data file, then use Claude Code to gather data.")
    else:
        parser.print_help()
