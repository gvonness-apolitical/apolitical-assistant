"""
Tests for humaans_client.py - Humaans API client module.
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
import requests


class TestHumaansClient:
    """Tests for HumaansClient class."""

    @patch("humaans_client.get_credential")
    def test_init_with_provided_token(self, mock_get_credential):
        """Should use provided token instead of keychain."""
        from humaans_client import HumaansClient

        client = HumaansClient(api_token="test-token")

        assert client.api_token == "test-token"
        mock_get_credential.assert_not_called()

    @patch("humaans_client.get_credential")
    def test_init_with_keychain_token(self, mock_get_credential):
        """Should fetch token from keychain when not provided."""
        mock_get_credential.return_value = "keychain-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        assert client.api_token == "keychain-token"
        mock_get_credential.assert_called_once_with("humaans-api-token")

    @patch("humaans_client.get_credential")
    def test_init_raises_without_token(self, mock_get_credential):
        """Should raise ValueError when no token available."""
        mock_get_credential.return_value = None
        from humaans_client import HumaansClient

        with pytest.raises(ValueError, match="Humaans API token not found"):
            HumaansClient()

    @patch("humaans_client.get_credential")
    def test_get_request(self, mock_get_credential):
        """Should make GET request with correct headers."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient, HUMAANS_API_BASE

        client = HumaansClient()

        with patch.object(client.session, "get") as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = {"data": "test"}
            mock_get.return_value = mock_response

            result = client._get("people")

            mock_get.assert_called_once_with(
                f"{HUMAANS_API_BASE}/people", params=None
            )
            assert result == {"data": "test"}

    @patch("humaans_client.get_credential")
    def test_get_all_pagination(self, mock_get_credential):
        """Should handle pagination when fetching all records."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        # Mock paginated responses
        responses = [
            {"data": [{"id": "1"}, {"id": "2"}], "total": 5},
            {"data": [{"id": "3"}, {"id": "4"}], "total": 5},
            {"data": [{"id": "5"}], "total": 5},
        ]
        call_count = 0

        def mock_get_side_effect(endpoint, params=None):
            nonlocal call_count
            result = responses[call_count]
            call_count += 1
            return result

        with patch.object(client, "_get", side_effect=mock_get_side_effect):
            result = client._get_all("people")

            assert len(result) == 5
            assert result[0]["id"] == "1"
            assert result[4]["id"] == "5"

    @patch("humaans_client.get_credential")
    def test_get_person_by_email(self, mock_get_credential):
        """Should find person by email."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        with patch.object(
            client, "_get_all", return_value=[{"id": "123", "email": "test@example.com"}]
        ):
            result = client.get_person_by_email("test@example.com")

            assert result["id"] == "123"

    @patch("humaans_client.get_credential")
    def test_get_person_by_email_not_found(self, mock_get_credential):
        """Should return None when person not found."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        with patch.object(client, "_get_all", return_value=[]):
            result = client.get_person_by_email("notfound@example.com")

            assert result is None

    @patch("humaans_client.get_credential")
    def test_get_current_job_role_sorts_by_date(self, mock_get_credential):
        """Should return most recent job role."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        roles = [
            {"jobTitle": "Junior Engineer", "effectiveDate": "2020-01-01"},
            {"jobTitle": "Senior Engineer", "effectiveDate": "2023-06-01"},
            {"jobTitle": "Staff Engineer", "effectiveDate": "2025-01-01"},
        ]

        with patch.object(client, "get_job_roles", return_value=roles):
            result = client.get_current_job_role("person-123")

            assert result["jobTitle"] == "Staff Engineer"

    @patch("humaans_client.get_credential")
    def test_get_current_job_role_empty(self, mock_get_credential):
        """Should return None when no roles exist."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        with patch.object(client, "get_job_roles", return_value=[]):
            result = client.get_current_job_role("person-123")

            assert result is None

    @patch("humaans_client.get_credential")
    def test_get_compensation_handles_403(self, mock_get_credential):
        """Should return empty list on 403 forbidden."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        mock_response = MagicMock()
        mock_response.status_code = 403
        error = requests.HTTPError()
        error.response = mock_response

        with patch.object(client, "_get_all", side_effect=error):
            result = client.get_compensation("person-123")

            assert result == []

    @patch("humaans_client.get_credential")
    def test_get_employee_data_comprehensive(self, mock_get_credential):
        """Should return comprehensive employee data."""
        mock_get_credential.return_value = "test-token"
        from humaans_client import HumaansClient

        client = HumaansClient()

        person = {
            "id": "person-123",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com",
            "employmentStartDate": "2022-01-15",
            "directReports": ["person-456"],
        }
        job_role = {
            "jobTitle": "Senior Engineer L4",
            "department": {"name": "Engineering"},
            "effectiveDate": "2024-01-01",
        }

        with patch.object(client, "get_person_by_email", return_value=person):
            with patch.object(client, "get_current_job_role", return_value=job_role):
                with patch.object(client, "get_compensation", return_value=[]):
                    result = client.get_employee_data("john@example.com")

                    assert result["person"]["firstName"] == "John"
                    assert result["current_job_role"]["jobTitle"] == "Senior Engineer L4"
                    assert result["calculated"]["department"] == "Engineering"
                    assert result["calculated"]["level"] == "L4"
                    assert result["calculated"]["is_manager"] is True
                    assert result["calculated"]["tenure_years"] is not None


class TestFetchAllTeamData:
    """Tests for fetch_all_team_data function."""

    @patch("humaans_client.HumaansClient")
    def test_fetches_all_team_members(self, MockClient):
        """Should fetch data for all provided emails."""
        from humaans_client import fetch_all_team_data

        mock_client = MagicMock()
        mock_client.get_employee_data.return_value = {"person": {"id": "123"}}
        MockClient.return_value = mock_client

        emails = ["alice@example.com", "bob@example.com"]
        result = fetch_all_team_data(emails)

        assert len(result) == 2
        assert "alice@example.com" in result
        assert "bob@example.com" in result

    @patch("humaans_client.HumaansClient")
    def test_handles_missing_employees(self, MockClient):
        """Should handle employees not found."""
        from humaans_client import fetch_all_team_data

        mock_client = MagicMock()
        mock_client.get_employee_data.side_effect = [
            {"person": {"id": "123"}},
            None,  # Second employee not found
        ]
        MockClient.return_value = mock_client

        emails = ["alice@example.com", "bob@example.com"]
        result = fetch_all_team_data(emails)

        assert len(result) == 1
        assert "alice@example.com" in result
        assert "bob@example.com" not in result

    @patch("humaans_client.HumaansClient")
    def test_handles_api_errors(self, MockClient):
        """Should continue on API errors."""
        from humaans_client import fetch_all_team_data

        mock_client = MagicMock()
        mock_client.get_employee_data.side_effect = [
            {"person": {"id": "123"}},
            Exception("API Error"),
            {"person": {"id": "456"}},
        ]
        MockClient.return_value = mock_client

        emails = ["alice@example.com", "bob@example.com", "charlie@example.com"]
        result = fetch_all_team_data(emails)

        assert len(result) == 2
        assert "alice@example.com" in result
        assert "charlie@example.com" in result
