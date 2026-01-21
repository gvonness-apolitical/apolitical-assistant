"""
Core utilities for team profile scripts.

Provides common functions for configuration loading, credential access, and file operations.
"""

import json
import subprocess
from pathlib import Path
from typing import Optional

import yaml

# Configuration paths
SCRIPT_DIR = Path(__file__).parent.parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
DATA_DIR = PROJECT_DIR / "data"

# Keychain configuration (matches the TypeScript implementation)
SERVICE_PREFIX = "apolitical-assistant-"


def get_credential(key: str) -> Optional[str]:
    """
    Get a credential from macOS Keychain.

    This matches the TypeScript implementation in packages/shared/src/keychain.ts

    Args:
        key: The credential key (e.g., 'slack-token', 'humaans-api-token')

    Returns:
        The credential value, or None if not found
    """
    service = f"{SERVICE_PREFIX}{key}"
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-w"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def load_config(config_path: Path = None) -> dict:
    """
    Load configuration from config.yaml.

    Args:
        config_path: Optional path to config file. Defaults to PROJECT_DIR/config.yaml

    Returns:
        Parsed configuration dictionary
    """
    path = config_path or CONFIG_PATH
    with open(path) as f:
        return yaml.safe_load(f)


def load_json_file(path: Path) -> Optional[dict]:
    """
    Load and parse a JSON file.

    Args:
        path: Path to the JSON file

    Returns:
        Parsed JSON as dictionary, or None if file doesn't exist
    """
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def save_json_file(path: Path, data: dict, indent: int = 2) -> None:
    """
    Save data to a JSON file.

    Creates parent directories if they don't exist.

    Args:
        path: Path to save the JSON file
        data: Dictionary to serialize
        indent: JSON indentation level (default: 2)
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=indent, default=str)
