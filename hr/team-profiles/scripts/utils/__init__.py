"""
Shared utilities for team profile scripts.

This module provides common functionality used across:
- update_profiles.py
- slack_analyzer.py
- humaans_client.py
- notion_rfc_analyzer.py
- email_analyzer.py
- meeting_analyzer.py
"""

from .core import (
    get_credential,
    load_config,
    load_json_file,
    save_json_file,
    PROJECT_DIR,
    CONFIG_PATH,
    DATA_DIR,
    SERVICE_PREFIX,
)
from .formatters import (
    format_email_section,
    format_meeting_section,
    format_slack_section,
)

__all__ = [
    # Core utilities
    "get_credential",
    "load_config",
    "load_json_file",
    "save_json_file",
    "PROJECT_DIR",
    "CONFIG_PATH",
    "DATA_DIR",
    "SERVICE_PREFIX",
    # Formatters
    "format_email_section",
    "format_meeting_section",
    "format_slack_section",
]
