"""
Tests for slack_analyzer.py - Slack analysis module.
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest


class TestSlackAnalyzer:
    """Tests for SlackAnalyzer class."""

    def test_init_normalizes_excluded_channels(self):
        """Should normalize excluded channels to lowercase."""
        from slack_analyzer import SlackAnalyzer

        analyzer = SlackAnalyzer(
            token="test-token", channels_to_exclude=["General", "RANDOM", "Team-Updates"]
        )

        assert "general" in analyzer.channels_to_exclude
        assert "random" in analyzer.channels_to_exclude
        assert "team-updates" in analyzer.channels_to_exclude

    def test_init_handles_none_excluded_channels(self):
        """Should handle None excluded channels."""
        from slack_analyzer import SlackAnalyzer

        analyzer = SlackAnalyzer(token="test-token", channels_to_exclude=None)

        assert analyzer.channels_to_exclude == set()

    @patch("slack_analyzer.requests.get")
    def test_api_call_success(self, mock_get):
        """Should make successful API call."""
        from slack_analyzer import SlackAnalyzer

        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True, "data": "test"}
        mock_get.return_value = mock_response

        analyzer = SlackAnalyzer(token="test-token")
        result = analyzer._api_call("users.info", {"user": "U123"})

        assert result == {"ok": True, "data": "test"}
        mock_get.assert_called_once()

    @patch("slack_analyzer.requests.get")
    def test_api_call_raises_on_error(self, mock_get):
        """Should raise exception on API error."""
        from slack_analyzer import SlackAnalyzer

        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": False, "error": "user_not_found"}
        mock_get.return_value = mock_response

        analyzer = SlackAnalyzer(token="test-token")

        with pytest.raises(Exception, match="Slack API error: user_not_found"):
            analyzer._api_call("users.info", {"user": "U123"})

    @patch("slack_analyzer.requests.get")
    def test_search_messages(self, mock_get):
        """Should search for messages with correct parameters."""
        from slack_analyzer import SlackAnalyzer

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "ok": True,
            "messages": {"matches": [{"text": "test message"}]},
        }
        mock_get.return_value = mock_response

        analyzer = SlackAnalyzer(token="test-token")
        result = analyzer.search_messages("from:@user", count=50, page=1)

        assert result["messages"]["matches"][0]["text"] == "test message"

    def test_analyze_messages_empty(self):
        """Should handle empty message list."""
        from slack_analyzer import SlackAnalyzer

        analyzer = SlackAnalyzer(token="test-token")
        result = analyzer._analyze_messages([], "Test User")

        assert result["user_name"] == "Test User"
        assert result["total_messages"] == 0
        assert result["metrics"] == {}

    def test_analyze_messages_filters_excluded_channels(self):
        """Should filter out messages from excluded channels."""
        from slack_analyzer import SlackAnalyzer

        analyzer = SlackAnalyzer(
            token="test-token", channels_to_exclude=["general", "random"]
        )

        messages = [
            {"text": "msg1", "channel": {"name": "engineering"}},
            {"text": "msg2", "channel": {"name": "general"}},  # Should be filtered
            {"text": "msg3", "channel": {"name": "support"}},
            {"text": "msg4", "channel": {"name": "Random"}},  # Case-insensitive filter
        ]

        result = analyzer._analyze_messages(messages, "Test User")

        # Should only include engineering and support messages
        assert result["total_messages_before_filter"] == 4
        assert result["excluded_channels_count"] == 2

    @patch.object(__import__("slack_analyzer", fromlist=["SlackAnalyzer"]).SlackAnalyzer, "search_messages")
    def test_analyze_user_messages_pagination(self, mock_search):
        """Should handle pagination when analyzing user messages."""
        from slack_analyzer import SlackAnalyzer

        # First page has results, second page is empty
        mock_search.side_effect = [
            {
                "messages": {
                    "matches": [{"text": f"msg{i}"} for i in range(100)],
                    "pagination": {"page_count": 2},
                }
            },
            {
                "messages": {
                    "matches": [{"text": f"msg{i}"} for i in range(50)],
                    "pagination": {"page_count": 2},
                }
            },
        ]

        analyzer = SlackAnalyzer(token="test-token")

        # Mock _analyze_messages to avoid complex processing
        with patch.object(analyzer, "_analyze_messages") as mock_analyze:
            mock_analyze.return_value = {"total_messages": 150}
            result = analyzer.analyze_user_messages("U123", "Test User", months=1)

            # Should have called search twice (2 pages)
            assert mock_search.call_count == 2


class TestSlackDataDir:
    """Tests for module-level constants."""

    def test_slack_data_dir_exists(self):
        """Should have SLACK_DATA_DIR constant defined."""
        from slack_analyzer import SLACK_DATA_DIR, DATA_DIR

        # SLACK_DATA_DIR should be a subdirectory of DATA_DIR
        assert SLACK_DATA_DIR == DATA_DIR / "slack"
