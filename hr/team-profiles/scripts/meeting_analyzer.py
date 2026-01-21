#!/usr/bin/env python3
"""
Meeting Engagement Analyzer for Team Profiles

Analyzes meeting engagement from Gemini notes/transcriptions in Google Drive
to extract participation patterns, contribution metrics, and notable examples.

Unlike Slack analysis which uses direct API calls, Google Drive analysis requires OAuth
and is performed manually via Claude Code with MCP tools. This script provides:
1. Data structure documentation
2. Functions to load and format meeting engagement data
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
from utils.formatters import format_meeting_section  # Re-export for backwards compatibility

# Meeting-specific data directory
MEETING_DATA_DIR = DATA_DIR / "meetings"
MEETING_ENGAGEMENT_FILE = MEETING_DATA_DIR / "meeting_engagement.json"


def load_meeting_engagement_data() -> Optional[dict]:
    """Load meeting engagement data from the JSON file"""
    return load_json_file(MEETING_ENGAGEMENT_FILE)


def get_meeting_data_for_member(email: str) -> Optional[dict]:
    """Get meeting engagement data for a specific team member"""
    meeting_data = load_meeting_engagement_data()
    if not meeting_data:
        return None
    return meeting_data.get("team_engagement", {}).get(email)


# Note: format_meeting_section is imported from utils.formatters at the top of this file


def create_empty_meeting_data() -> dict:
    """
    Create an empty meeting engagement data structure.
    Useful for initializing the data file.
    """
    config = load_config()

    team_engagement = {}
    for member in config["team_members"]:
        team_engagement[member["email"]] = {
            "name": member["name"],
            "metrics": {
                "meetings_attended": 0,
                "contribution_mentions": 0,
                "action_items_assigned": 0,
                "topics_discussed": [],
            },
            "engagement_patterns": {
                "participation_level": None,
                "contribution_quality": None,
                "initiative": None,
                "collaboration": None,
                "follow_through": None,
            },
            "notable_contributions": [],
            "meetings_list": [],
            "analysis_date": None,
            "analysis_period": None,
        }

    return {
        "analysis_date": datetime.now().strftime("%Y-%m-%d"),
        "source": "Google Drive Gemini Notes via MCP",
        "team_engagement": team_engagement,
    }


def init_data_file():
    """Initialize the meeting engagement data file if it doesn't exist"""
    MEETING_DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not MEETING_ENGAGEMENT_FILE.exists():
        data = create_empty_meeting_data()
        with open(MEETING_ENGAGEMENT_FILE, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Created empty meeting engagement file: {MEETING_ENGAGEMENT_FILE}")
    else:
        print(f"Meeting engagement file already exists: {MEETING_ENGAGEMENT_FILE}")


def print_data_structure():
    """Print the expected data structure for documentation"""
    structure = '''
Meeting Engagement Data Structure
==================================

The meeting_engagement.json file should have the following structure:

{
  "analysis_date": "2026-01-20",
  "source": "Google Drive Gemini Notes via MCP",
  "team_engagement": {
    "email@apolitical.co": {
      "name": "Team Member Name",
      "metrics": {
        "meetings_attended": 15,           // Meetings where they appeared
        "contribution_mentions": 45,        // Times mentioned in notes as contributing
        "action_items_assigned": 8,         // Action items assigned to them
        "topics_discussed": [               // Key topics they engaged with
          "QA automation",
          "Platform architecture",
          "Performance optimization"
        ]
      },
      "engagement_patterns": {
        "participation_level": "Active contributor in technical discussions",
        "contribution_quality": "Provides well-thought-out solutions with clear trade-offs",
        "initiative": "Often proposes new ideas and approaches",
        "collaboration": "Builds on others' ideas constructively",
        "follow_through": "Consistently completes assigned action items"
      },
      "notable_contributions": [
        {
          "meeting": "QA / Testing",
          "date": "2026-01-19",
          "contribution": "Proposed automated testing strategy with self-healing tests",
          "type": "technical_proposal"  // technical_proposal, problem_solving, leadership, collaboration
        }
      ],
      "meetings_list": [
        {
          "name": "QA / Testing",
          "date": "2026-01-19",
          "doc_id": "1ZUhKPKSsj-jlNZr5w2gD35R57q9Y58Na6APek5tW-LQ",
          "mentions": 12
        }
      ],
      "analysis_date": "2026-01-20",
      "analysis_period": "Last 3 months"
    }
  }
}

How to Gather This Data
========================

1. Open Claude Code in the apolitical-assistant directory
2. Search for Gemini meeting notes:

   "Search Google Drive for 'Notes by Gemini' from the last 3 months"

3. For each direct report, analyze their meeting participation:

   "Analyze meeting engagement for Dominic Harries from the Gemini meeting notes.
   Look at:
   - How many meetings they attended
   - How often they're mentioned as contributing
   - What topics they engaged with
   - Action items assigned to them
   - Notable contributions

   Update the meeting_engagement.json file with the results."

4. Run profile updates: python update_profiles.py --all --force

Gemini Notes Format
===================

Gemini meeting notes typically include:
- **Summary**: High-level overview mentioning key participants
- **Details**: Detailed breakdown with timestamps and speaker attributions
- **Suggested next steps**: Action items with assignees

Example speaker attribution in notes:
"Dominic Harries suggested two main approaches, including implementing
an end-to-end test for Futura..."

Look for patterns like "[Name] suggested/proposed/noted/affirmed/discussed..."
'''
    print(structure)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Meeting Engagement Analyzer utilities"
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize empty meeting engagement data file",
    )
    parser.add_argument(
        "--structure",
        action="store_true",
        help="Print the expected data structure",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check if meeting data exists and show summary",
    )

    args = parser.parse_args()

    if args.init:
        init_data_file()
    elif args.structure:
        print_data_structure()
    elif args.check:
        data = load_meeting_engagement_data()
        if data:
            print(f"Meeting engagement data found (analyzed: {data.get('analysis_date', 'Unknown')})")
            team = data.get("team_engagement", {})
            for email, info in team.items():
                analyzed = info.get("analysis_date")
                attended = info.get("metrics", {}).get("meetings_attended", 0)
                mentions = info.get("metrics", {}).get("contribution_mentions", 0)
                status = f"Analyzed ({attended} meetings, {mentions} mentions)" if analyzed else "Not analyzed"
                print(f"  - {info.get('name', email)}: {status}")
        else:
            print("No meeting engagement data found.")
            print("Run with --init to create the data file, then use Claude Code to gather data.")
    else:
        parser.print_help()
