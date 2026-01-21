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
from typing import Optional

from utils import load_config, load_json_file, DATA_DIR
from utils.formatters import format_email_section  # Re-export for backwards compatibility

# Email-specific data directory
EMAIL_DATA_DIR = DATA_DIR / "email"
EMAIL_ENGAGEMENT_FILE = EMAIL_DATA_DIR / "email_engagement.json"


def load_email_engagement_data() -> Optional[dict]:
    """Load email engagement data from the JSON file"""
    return load_json_file(EMAIL_ENGAGEMENT_FILE)


def get_email_data_for_member(email: str) -> Optional[dict]:
    """Get email engagement data for a specific team member"""
    email_data = load_email_engagement_data()
    if not email_data:
        return None
    return email_data.get("team_engagement", {}).get(email)


# Note: format_email_section is imported from utils.formatters at the top of this file


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
    EMAIL_DATA_DIR.mkdir(parents=True, exist_ok=True)

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
