#!/usr/bin/env python3
"""
Humaans API Client

Direct API client for fetching employee data from Humaans, including
job roles, levels, and organizational information.

API Reference: https://docs.humaans.io/api/
"""

import subprocess
from datetime import datetime
from typing import Optional

import requests

# Keychain configuration (matches the TypeScript implementation)
SERVICE_PREFIX = "apolitical-assistant-"
HUMAANS_API_BASE = "https://app.humaans.io/api"


def get_credential(key: str) -> Optional[str]:
    """Get a credential from macOS Keychain (same as TypeScript implementation)"""
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


class HumaansClient:
    """Client for the Humaans API"""

    def __init__(self, api_token: Optional[str] = None):
        """Initialize the client with an API token"""
        self.api_token = api_token or get_credential("humaans-api-token")
        if not self.api_token:
            raise ValueError(
                "Humaans API token not found. "
                "Run 'npm run setup' in the apolitical-assistant repo to configure credentials."
            )

        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            }
        )

    def _get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make a GET request to the Humaans API"""
        url = f"{HUMAANS_API_BASE}/{endpoint}"
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def _get_all(self, endpoint: str, params: Optional[dict] = None) -> list:
        """Get all records from a paginated endpoint"""
        params = params or {}
        params["$limit"] = 100
        params["$skip"] = 0

        all_records = []
        while True:
            response = self._get(endpoint, params)
            data = response.get("data", [])
            all_records.extend(data)

            # Check if there are more records
            total = response.get("total", len(data))
            if len(all_records) >= total or len(data) == 0:
                break

            params["$skip"] += params["$limit"]

        return all_records

    def get_people(self) -> list:
        """Get all people in the organization"""
        return self._get_all("people")

    def get_person(self, person_id: str) -> dict:
        """Get a specific person by ID"""
        return self._get(f"people/{person_id}")

    def get_person_by_email(self, email: str) -> Optional[dict]:
        """Get a person by their email address"""
        people = self._get_all("people", {"email": email})
        return people[0] if people else None

    def get_job_roles(self, person_id: Optional[str] = None) -> list:
        """
        Get job roles, optionally filtered by person ID.

        Job roles contain historical and current role information including:
        - jobTitle
        - department
        - effectiveDate
        - team information
        """
        params = {}
        if person_id:
            params["personId"] = person_id
        return self._get_all("job-roles", params)

    def get_current_job_role(self, person_id: str) -> Optional[dict]:
        """Get the current (most recent) job role for a person"""
        roles = self.get_job_roles(person_id)
        if not roles:
            return None

        # Sort by effective date descending and return the most recent
        roles_sorted = sorted(
            roles,
            key=lambda r: r.get("effectiveDate", "1900-01-01"),
            reverse=True,
        )
        return roles_sorted[0]

    def get_compensation(self, person_id: Optional[str] = None) -> list:
        """
        Get compensation records (requires finance/owner access).

        Compensation may include level/grade information.
        """
        params = {}
        if person_id:
            params["personId"] = person_id
        try:
            return self._get_all("compensations", params)
        except requests.HTTPError as e:
            if e.response.status_code == 403:
                # Access denied - likely doesn't have finance permissions
                return []
            raise

    def get_teams(self) -> list:
        """Get all teams in the organization"""
        return self._get_all("teams")

    def get_departments(self) -> list:
        """Get all departments in the organization"""
        return self._get_all("departments")

    def get_employee_data(self, email: str) -> Optional[dict]:
        """
        Get comprehensive employee data including job role and level info.

        Returns a dict with:
        - person: Basic person data
        - current_job_role: Current job role details
        - compensation: Compensation info (if accessible)
        - calculated fields: tenure, level, etc.
        """
        person = self.get_person_by_email(email)
        if not person:
            return None

        person_id = person.get("id")

        # Get job role info
        current_role = self.get_current_job_role(person_id)

        # Try to get compensation (may fail due to permissions)
        compensation = []
        try:
            compensation = self.get_compensation(person_id)
        except Exception:
            pass

        # Calculate tenure
        start_date = person.get("employmentStartDate")
        tenure_years = None
        tenure_months = None
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                now = datetime.now(start.tzinfo) if start.tzinfo else datetime.now()
                delta = now - start
                tenure_years = delta.days // 365
                tenure_months = (delta.days % 365) // 30
            except (ValueError, TypeError):
                pass

        # Extract level from various sources
        level = None

        # Try to get level from job role
        if current_role:
            # Check for explicit level field
            level = current_role.get("level") or current_role.get("grade")

            # Some organizations encode level in job title
            job_title = current_role.get("jobTitle", "")
            if not level:
                # Look for patterns like "L3", "Level 3", "Senior", etc.
                import re

                level_match = re.search(r"\b[Ll](\d+)\b", job_title)
                if level_match:
                    level = f"L{level_match.group(1)}"

        # Try to get level from compensation
        if not level and compensation:
            latest_comp = sorted(
                compensation,
                key=lambda c: c.get("effectiveDate", "1900-01-01"),
                reverse=True,
            )
            if latest_comp:
                level = latest_comp[0].get("level") or latest_comp[0].get("grade")

        # Get department - can be string or object depending on API version
        department = None
        if current_role:
            dept = current_role.get("department")
            if isinstance(dept, dict):
                department = dept.get("name")
            elif isinstance(dept, str):
                department = dept

        return {
            "person": person,
            "current_job_role": current_role,
            "compensation": compensation,
            "calculated": {
                "tenure_years": tenure_years,
                "tenure_months": tenure_months,
                "level": level,
                "start_date": start_date,
                "job_title": current_role.get("jobTitle") if current_role else person.get("jobTitle"),
                "department": department,
                "manager_id": person.get("managerId") or person.get("reportingTo"),
                "is_manager": bool(person.get("directReports", [])),
            },
        }


def fetch_all_team_data(emails: list[str]) -> dict:
    """
    Fetch data for all team members by email.

    Returns a dict mapping email -> employee data
    """
    client = HumaansClient()
    results = {}

    for email in emails:
        print(f"  Fetching data for: {email}")
        try:
            data = client.get_employee_data(email)
            if data:
                results[email] = data
            else:
                print(f"    Warning: No data found for {email}")
        except Exception as e:
            print(f"    Error fetching {email}: {e}")

    return results


if __name__ == "__main__":
    # Test the client
    import sys
    import yaml

    # Load config to get team member emails
    script_dir = __file__
    if isinstance(script_dir, str):
        from pathlib import Path

        script_dir = Path(script_dir).parent
        config_path = script_dir.parent / "config.yaml"
    else:
        config_path = "../config.yaml"

    with open(config_path) as f:
        config = yaml.safe_load(f)

    emails = [m["email"] for m in config["team_members"]]

    print("Testing Humaans API client...")
    print(f"Fetching data for {len(emails)} team members\n")

    try:
        data = fetch_all_team_data(emails)
        print(f"\nSuccessfully fetched data for {len(data)} employees")

        # Print summary
        print("\nSummary:")
        print("-" * 60)
        for email, emp_data in data.items():
            calc = emp_data["calculated"]
            name = f"{emp_data['person'].get('firstName', '')} {emp_data['person'].get('lastName', '')}"
            print(f"{name}")
            print(f"  Job Title: {calc.get('job_title', 'N/A')}")
            print(f"  Level: {calc.get('level', 'Not found')}")
            print(f"  Start Date: {calc.get('start_date', 'N/A')}")
            print(f"  Tenure: {calc.get('tenure_years', 'N/A')} years, {calc.get('tenure_months', 'N/A')} months")
            print(f"  Is Manager: {calc.get('is_manager', False)}")
            print()

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
