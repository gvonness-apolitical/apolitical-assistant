"""
Tests for utils/formatters.py - Formatting utilities module.
"""

import pytest

from utils.formatters import (
    format_email_section,
    format_meeting_section,
    format_slack_section,
)


class TestFormatEmailSection:
    """Tests for format_email_section function."""

    def test_formats_complete_email_data(self, sample_email_data):
        """Should format all email metrics and patterns correctly."""
        result = format_email_section(sample_email_data)

        total_emails, avg_length, response_rate, avg_response_time, patterns, notable, email_date, email_period = (
            result
        )

        assert total_emails == "150"
        assert avg_length == "Medium (100-300 words)"
        assert response_rate == "85%"
        assert avg_response_time == "4 hours"
        assert "Tone: Professional and collaborative" in patterns
        assert "Clarity: High - well-structured messages" in patterns
        assert email_date == "2026-01-20"
        assert email_period == "Last 30 days"

    def test_formats_notable_emails(self, sample_email_data):
        """Should format notable emails with date and subject."""
        result = format_email_section(sample_email_data)
        _, _, _, _, _, notable, _, _ = result

        assert "**2026-01-15**: Project Update" in notable
        assert "Detailed status update on Q1 initiatives" in notable

    def test_handles_none_data(self):
        """Should return defaults for None input."""
        result = format_email_section(None)

        total_emails, avg_length, response_rate, avg_response_time, patterns, notable, email_date, email_period = (
            result
        )

        assert total_emails == "*Not yet analyzed*"
        assert avg_length == ""
        assert patterns == "*To be assessed*"
        assert notable == "*None captured*"
        assert email_date == "Not analyzed"

    def test_handles_empty_patterns(self):
        """Should handle data with empty patterns."""
        data = {"metrics": {"total_emails": 50}, "patterns": {}, "notable_emails": []}

        result = format_email_section(data)
        _, _, _, _, patterns, notable, _, _ = result

        assert patterns == "*To be assessed*"
        assert notable == "*None captured*"

    def test_limits_notable_emails_to_five(self):
        """Should limit notable emails to 5 entries."""
        data = {
            "metrics": {},
            "patterns": {},
            "notable_emails": [
                {"date": f"2026-01-{i:02d}", "subject": f"Email {i}"}
                for i in range(1, 10)
            ],
        }

        result = format_email_section(data)
        _, _, _, _, _, notable, _, _ = result

        # Should only have 5 entries
        assert notable.count("**2026-01") == 5
        assert "Email 6" not in notable


class TestFormatMeetingSection:
    """Tests for format_meeting_section function."""

    def test_formats_complete_meeting_data(self, sample_meeting_data):
        """Should format all meeting metrics and patterns correctly."""
        result = format_meeting_section(sample_meeting_data)

        (
            meetings,
            mentions,
            action_items,
            engagement,
            notable,
            meeting_date,
            meeting_period,
        ) = result

        assert meetings == "25"
        assert mentions == "12"
        assert action_items == "8"
        assert "Participation: High - actively contributes" in engagement
        assert "Collaboration: Strong team player" in engagement
        assert meeting_date == "2026-01-20"

    def test_formats_notable_contributions(self, sample_meeting_data):
        """Should format notable contributions with meeting and date."""
        result = format_meeting_section(sample_meeting_data)
        _, _, _, _, notable, _, _ = result

        assert "**Architecture Review** (2026-01-18)" in notable
        assert "Proposed efficient caching strategy" in notable

    def test_handles_none_data(self):
        """Should return defaults for None input."""
        result = format_meeting_section(None)

        meetings, mentions, action_items, engagement, notable, date, period = result

        assert meetings == "*Not yet analyzed*"
        assert mentions == ""
        assert engagement == "*To be assessed*"
        assert notable == "*None captured*"

    def test_handles_empty_patterns(self):
        """Should handle data with empty engagement patterns."""
        data = {
            "metrics": {"meetings_attended": 10},
            "engagement_patterns": {},
            "notable_contributions": [],
        }

        result = format_meeting_section(data)
        _, _, _, engagement, notable, _, _ = result

        assert engagement == "*To be assessed*"
        assert notable == "*None captured*"


class TestFormatSlackSection:
    """Tests for format_slack_section function."""

    def test_formats_complete_slack_data(self, sample_slack_data):
        """Should format Slack metrics into markdown table."""
        result = format_slack_section(sample_slack_data)

        assert "| **Total Messages** | 250 |" in result
        assert "| **Average Message Length** | 85 chars |" in result
        assert "| **Messages per Week** | 45 |" in result
        assert "#engineering" in result
        assert "Tuesday @ 14:00" in result

    def test_handles_none_data(self):
        """Should return default template for None input."""
        result = format_slack_section(None)

        assert "*Not yet analyzed*" in result
        assert "### Public Channels" in result
        assert "*To be assessed*" in result

    def test_handles_missing_public_channels(self):
        """Should return default template when public_channels missing."""
        result = format_slack_section({"other_data": {}})

        assert "*Not yet analyzed*" in result

    def test_handles_missing_peak_times(self):
        """Should handle missing peak activity data."""
        data = {
            "public_channels": {
                "metrics": {"total_messages": 100},
                "channel_breakdown": {},
            }
        }

        result = format_slack_section(data)

        assert "N/A @ N/A" in result

    def test_limits_channels_to_five(self):
        """Should limit displayed channels to 5."""
        data = {
            "public_channels": {
                "metrics": {"total_messages": 100},
                "channel_breakdown": {
                    f"#channel-{i}": i * 10 for i in range(1, 10)
                },
            }
        }

        result = format_slack_section(data)

        # Should only show first 5 channels (dict order)
        channel_count = sum(1 for i in range(1, 10) if f"#channel-{i}" in result)
        assert channel_count <= 5
