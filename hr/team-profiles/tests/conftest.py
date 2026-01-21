"""
Pytest configuration and fixtures for team-profiles tests.
"""

import sys
from pathlib import Path

import pytest

# Add scripts directory to path for imports
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))


@pytest.fixture
def sample_email_data():
    """Sample email engagement data for testing."""
    return {
        "metrics": {
            "total_emails": 150,
            "average_length": "Medium (100-300 words)",
            "response_rate": "85%",
            "average_response_time": "4 hours",
        },
        "patterns": {
            "tone": "Professional and collaborative",
            "clarity": "High - well-structured messages",
            "responsiveness": "Very responsive",
            "detail_level": "Thorough",
            "proactiveness": "Often initiates conversations",
        },
        "notable_emails": [
            {
                "date": "2026-01-15",
                "subject": "Project Update",
                "summary": "Detailed status update on Q1 initiatives",
            },
            {
                "date": "2026-01-10",
                "subject": "Team Feedback",
                "summary": "Thoughtful feedback on team process improvements",
            },
        ],
        "analysis_date": "2026-01-20",
        "analysis_period": "Last 30 days",
    }


@pytest.fixture
def sample_meeting_data():
    """Sample meeting engagement data for testing."""
    return {
        "metrics": {
            "meetings_attended": 25,
            "contribution_mentions": 12,
            "action_items_assigned": 8,
        },
        "engagement_patterns": {
            "participation_level": "High - actively contributes",
            "contribution_quality": "Insightful and actionable",
            "initiative": "Frequently proposes solutions",
            "collaboration": "Strong team player",
            "follow_through": "Consistently delivers on commitments",
        },
        "notable_contributions": [
            {
                "meeting": "Architecture Review",
                "date": "2026-01-18",
                "contribution": "Proposed efficient caching strategy",
            },
            {
                "meeting": "Sprint Planning",
                "date": "2026-01-14",
                "contribution": "Identified key dependencies",
            },
        ],
        "analysis_date": "2026-01-20",
        "analysis_period": "Last 30 days",
    }


@pytest.fixture
def sample_slack_data():
    """Sample Slack analysis data for testing."""
    return {
        "public_channels": {
            "metrics": {
                "total_messages": 250,
                "average_message_length": 85,
                "messages_per_week": 45,
                "peak_activity_hour": 14,
                "peak_activity_day": "Tuesday",
            },
            "channel_breakdown": {
                "#engineering": 100,
                "#general": 50,
                "#random": 30,
                "#team-updates": 40,
                "#support": 30,
            },
        }
    }


@pytest.fixture
def temp_json_file(tmp_path):
    """Create a temporary JSON file for testing."""
    import json

    file_path = tmp_path / "test.json"
    data = {"key": "value", "nested": {"foo": "bar"}}
    with open(file_path, "w") as f:
        json.dump(data, f)
    return file_path


@pytest.fixture
def temp_config_file(tmp_path):
    """Create a temporary config.yaml file for testing."""
    import yaml

    file_path = tmp_path / "config.yaml"
    data = {
        "team_members": [
            {"name": "Alice", "email": "alice@example.com"},
            {"name": "Bob", "email": "bob@example.com"},
        ],
        "settings": {"update_frequency": "weekly"},
    }
    with open(file_path, "w") as f:
        yaml.dump(data, f)
    return file_path
