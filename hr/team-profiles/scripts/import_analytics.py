#!/usr/bin/env python3
"""
Import Analytics from apolitical-dev-analytics

Imports delivery metrics and DORA data from the dev-analytics repository
and formats them for integration with team profiles.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
DATA_DIR = PROJECT_DIR / "data" / "analytics"


def load_config() -> dict:
    """Load configuration from config.yaml"""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def find_analytics_repo(config: dict) -> Path:
    """Find the dev-analytics repository"""
    configured_path = config.get("data_sources", {}).get("dev_analytics_path", "")
    expanded_path = Path(os.path.expanduser(configured_path))

    if expanded_path.exists():
        return expanded_path

    # Try common locations
    common_paths = [
        Path.home() / "Dev" / "apolitical-dev-analytics",
        Path.home() / "dev" / "apolitical-dev-analytics",
        Path.home() / "Development" / "apolitical-dev-analytics",
        Path.cwd().parent / "apolitical-dev-analytics",
    ]

    for path in common_paths:
        if path.exists():
            return path

    raise FileNotFoundError(
        "Could not find apolitical-dev-analytics repository. "
        "Please update the dev_analytics_path in config.yaml"
    )


def parse_markdown_report(file_path: Path) -> dict:
    """Parse a markdown report file and extract metrics"""
    with open(file_path) as f:
        content = f.read()

    # Extract period from filename or content
    period_match = re.search(r"(\d{4}-\d{2})", file_path.name)
    period = period_match.group(1) if period_match else "unknown"

    # Initialize result structure
    result = {
        "period": period,
        "file": str(file_path),
        "parsed_at": datetime.now().isoformat(),
        "contributors": {},
        "team_summary": {},
    }

    # Parse contributor sections
    # This is a simplified parser - adjust based on actual report format
    contributor_pattern = re.compile(
        r"##\s+(?P<name>[^\n]+)\n"
        r"(?P<content>(?:(?!^##\s).)*)",
        re.MULTILINE | re.DOTALL,
    )

    for match in contributor_pattern.finditer(content):
        name = match.group("name").strip()
        section_content = match.group("content")

        contributor_data = parse_contributor_section(name, section_content)
        if contributor_data:
            result["contributors"][name] = contributor_data

    # Parse team summary if present
    team_summary_match = re.search(
        r"#\s+Team\s+Summary\n((?:(?!^#\s).)*)",
        content,
        re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    if team_summary_match:
        result["team_summary"] = parse_team_summary(team_summary_match.group(1))

    return result


def parse_contributor_section(name: str, content: str) -> dict:
    """Parse an individual contributor's section"""
    data = {
        "name": name,
        "metrics": {},
        "dora": {},
        "trends": {},
    }

    # Extract PR metrics
    pr_match = re.search(r"PRs?\s*(?:Merged|Created):\s*(\d+)", content, re.IGNORECASE)
    if pr_match:
        data["metrics"]["prs_merged"] = int(pr_match.group(1))

    # Extract review metrics
    review_match = re.search(r"Reviews?:\s*(\d+)", content, re.IGNORECASE)
    if review_match:
        data["metrics"]["reviews"] = int(review_match.group(1))

    # Extract lines of code
    loc_match = re.search(
        r"Lines?\s*(?:Added|Changed)?:\s*\+?(\d+)\s*/?\s*-?(\d+)?",
        content,
        re.IGNORECASE,
    )
    if loc_match:
        data["metrics"]["lines_added"] = int(loc_match.group(1))
        if loc_match.group(2):
            data["metrics"]["lines_deleted"] = int(loc_match.group(2))

    # Extract DORA metrics if present
    deployment_match = re.search(
        r"Deployment\s*Frequency:\s*([^\n]+)", content, re.IGNORECASE
    )
    if deployment_match:
        data["dora"]["deployment_frequency"] = deployment_match.group(1).strip()

    lead_time_match = re.search(r"Lead\s*Time:\s*([^\n]+)", content, re.IGNORECASE)
    if lead_time_match:
        data["dora"]["lead_time"] = lead_time_match.group(1).strip()

    failure_rate_match = re.search(
        r"(?:Change\s*)?Failure\s*Rate:\s*([^\n]+)", content, re.IGNORECASE
    )
    if failure_rate_match:
        data["dora"]["change_failure_rate"] = failure_rate_match.group(1).strip()

    mttr_match = re.search(r"MTTR|Mean\s*Time\s*to\s*Recov(?:er|ery):\s*([^\n]+)", content, re.IGNORECASE)
    if mttr_match:
        data["dora"]["mttr"] = mttr_match.group(1).strip()

    return data


def parse_team_summary(content: str) -> dict:
    """Parse team summary section"""
    summary = {}

    # Extract total PRs
    total_prs_match = re.search(r"Total\s*PRs?:\s*(\d+)", content, re.IGNORECASE)
    if total_prs_match:
        summary["total_prs"] = int(total_prs_match.group(1))

    # Extract active contributors
    contributors_match = re.search(
        r"(?:Active\s*)?Contributors?:\s*(\d+)", content, re.IGNORECASE
    )
    if contributors_match:
        summary["active_contributors"] = int(contributors_match.group(1))

    return summary


def find_reports(analytics_path: Path, period: Optional[str] = None) -> list:
    """Find all report files, optionally filtered by period"""
    reports_dir = analytics_path / "reports"

    if not reports_dir.exists():
        # Try alternative locations
        for alt in ["output", "generated", "."]:
            alt_dir = analytics_path / alt
            if alt_dir.exists():
                reports_dir = alt_dir
                break

    if not reports_dir.exists():
        raise FileNotFoundError(f"Reports directory not found in {analytics_path}")

    # Find markdown reports
    report_files = list(reports_dir.glob("**/*.md"))

    if period:
        report_files = [f for f in report_files if period in f.name]

    return sorted(report_files, reverse=True)


def map_contributor_to_team_member(
    contributor_name: str, config: dict
) -> Optional[dict]:
    """Map a contributor name from analytics to a team member in config"""
    for member in config["team_members"]:
        # Try exact match first
        if member["name"].lower() == contributor_name.lower():
            return member

        # Try partial matches
        name_parts = member["name"].lower().split()
        contributor_parts = contributor_name.lower().split()

        # Check if any name part matches
        if any(p in contributor_parts for p in name_parts):
            return member

        # Check GitHub username
        if member.get("github", "").lower() == contributor_name.lower():
            return member

    return None


def import_analytics(
    config: dict, period: Optional[str] = None, output_dir: Path = None
) -> dict:
    """Import analytics data for all team members"""
    output_dir = output_dir or DATA_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find analytics repo
    analytics_path = find_analytics_repo(config)
    print(f"Found analytics repo at: {analytics_path}")

    # Find reports
    reports = find_reports(analytics_path, period)
    print(f"Found {len(reports)} report(s)")

    if not reports:
        print("No reports found!")
        return {}

    # Parse all reports
    all_data = {
        "import_date": datetime.now().isoformat(),
        "analytics_path": str(analytics_path),
        "periods": {},
        "team_members": {},
    }

    for report_file in reports:
        print(f"Parsing: {report_file.name}")
        try:
            report_data = parse_markdown_report(report_file)
            period = report_data["period"]
            all_data["periods"][period] = report_data

            # Map contributors to team members
            for contributor_name, contributor_data in report_data.get(
                "contributors", {}
            ).items():
                member = map_contributor_to_team_member(contributor_name, config)
                if member:
                    member_key = member["profile_file"].replace(".md", "")
                    if member_key not in all_data["team_members"]:
                        all_data["team_members"][member_key] = {
                            "name": member["name"],
                            "periods": {},
                        }
                    all_data["team_members"][member_key]["periods"][
                        period
                    ] = contributor_data

        except Exception as e:
            print(f"  Error parsing {report_file.name}: {e}")

    # Save individual files for each team member
    for member_key, member_data in all_data["team_members"].items():
        output_file = output_dir / f"{member_key}_analytics.json"
        with open(output_file, "w") as f:
            json.dump(member_data, f, indent=2)
        print(f"Saved: {output_file}")

    # Save combined data
    combined_file = output_dir / "all_analytics.json"
    with open(combined_file, "w") as f:
        json.dump(all_data, f, indent=2)
    print(f"\nCombined data saved to: {combined_file}")

    return all_data


def main():
    parser = argparse.ArgumentParser(
        description="Import analytics data from apolitical-dev-analytics"
    )
    parser.add_argument(
        "--reports-path",
        type=str,
        help="Path to dev-analytics repository (overrides config)",
    )
    parser.add_argument(
        "--period",
        type=str,
        help="Specific period to import (e.g., '2025-01')",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output directory for results",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available reports without importing",
    )

    args = parser.parse_args()

    # Load config
    config = load_config()

    # Override path if provided
    if args.reports_path:
        config["data_sources"]["dev_analytics_path"] = args.reports_path

    # Determine output directory
    output_dir = Path(args.output) if args.output else DATA_DIR

    if args.list:
        analytics_path = find_analytics_repo(config)
        reports = find_reports(analytics_path)
        print(f"Available reports in {analytics_path}:")
        for report in reports:
            print(f"  - {report.name}")
    else:
        import_analytics(config, args.period, output_dir)


if __name__ == "__main__":
    main()
