"""
Tests for utils/core.py - Core utilities module.
"""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

import pytest

from utils.core import (
    SERVICE_PREFIX,
    get_credential,
    load_config,
    load_json_file,
    save_json_file,
)


class TestGetCredential:
    """Tests for get_credential function."""

    def test_returns_credential_when_found(self):
        """Should return credential value from keychain."""
        mock_result = MagicMock()
        mock_result.stdout = "secret-token\n"

        with patch("utils.core.subprocess.run", return_value=mock_result) as mock_run:
            result = get_credential("slack-token")

            assert result == "secret-token"
            mock_run.assert_called_once_with(
                [
                    "security",
                    "find-generic-password",
                    "-s",
                    f"{SERVICE_PREFIX}slack-token",
                    "-w",
                ],
                capture_output=True,
                text=True,
                check=True,
            )

    def test_returns_none_when_not_found(self):
        """Should return None when credential is not in keychain."""
        with patch(
            "utils.core.subprocess.run",
            side_effect=subprocess.CalledProcessError(44, "security"),
        ):
            result = get_credential("nonexistent-token")

            assert result is None

    def test_trims_whitespace(self):
        """Should trim whitespace from credential value."""
        mock_result = MagicMock()
        mock_result.stdout = "  token-with-spaces  \n"

        with patch("utils.core.subprocess.run", return_value=mock_result):
            result = get_credential("test-token")

            assert result == "token-with-spaces"


class TestLoadConfig:
    """Tests for load_config function."""

    def test_loads_yaml_config(self, temp_config_file):
        """Should load and parse YAML configuration file."""
        config = load_config(temp_config_file)

        assert "team_members" in config
        assert len(config["team_members"]) == 2
        assert config["team_members"][0]["name"] == "Alice"
        assert config["settings"]["update_frequency"] == "weekly"

    def test_raises_on_missing_file(self, tmp_path):
        """Should raise error when config file doesn't exist."""
        with pytest.raises(FileNotFoundError):
            load_config(tmp_path / "nonexistent.yaml")


class TestLoadJsonFile:
    """Tests for load_json_file function."""

    def test_loads_existing_json_file(self, temp_json_file):
        """Should load and parse existing JSON file."""
        result = load_json_file(temp_json_file)

        assert result == {"key": "value", "nested": {"foo": "bar"}}

    def test_returns_none_for_nonexistent_file(self, tmp_path):
        """Should return None when file doesn't exist."""
        result = load_json_file(tmp_path / "nonexistent.json")

        assert result is None


class TestSaveJsonFile:
    """Tests for save_json_file function."""

    def test_saves_json_file(self, tmp_path):
        """Should save data as JSON file."""
        file_path = tmp_path / "output.json"
        data = {"test": "data", "number": 42}

        save_json_file(file_path, data)

        assert file_path.exists()
        with open(file_path) as f:
            saved_data = json.load(f)
        assert saved_data == data

    def test_creates_parent_directories(self, tmp_path):
        """Should create parent directories if they don't exist."""
        file_path = tmp_path / "nested" / "dir" / "output.json"
        data = {"nested": True}

        save_json_file(file_path, data)

        assert file_path.exists()

    def test_uses_custom_indent(self, tmp_path):
        """Should use custom indentation level."""
        file_path = tmp_path / "indented.json"
        data = {"key": "value"}

        save_json_file(file_path, data, indent=4)

        with open(file_path) as f:
            content = f.read()
        # 4-space indent means "key" should be indented by 4 spaces
        assert '    "key"' in content

    def test_handles_datetime_serialization(self, tmp_path):
        """Should serialize datetime objects using str()."""
        from datetime import datetime

        file_path = tmp_path / "datetime.json"
        data = {"timestamp": datetime(2026, 1, 21, 12, 0, 0)}

        save_json_file(file_path, data)

        with open(file_path) as f:
            saved_data = json.load(f)
        assert "2026-01-21" in saved_data["timestamp"]
