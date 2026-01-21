#!/usr/bin/env python3
"""
Team Summary Generator

Generates team-wide summary views and comparison matrices from individual profiles.
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
PROFILES_DIR = PROJECT_DIR / "profiles"
DATA_DIR = PROJECT_DIR / "data"


def load_config() -> dict:
    """Load configuration from config.yaml"""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def load_all_slack_data() -> dict:
    """Load all Slack analysis data"""
    slack_dir = DATA_DIR / "slack"
    data = {}

    if not slack_dir.exists():
        return data

    for file in slack_dir.glob("*_slack.json"):
        member_key = file.stem.replace("_slack", "")
        with open(file) as f:
            data[member_key] = json.load(f)

    return data


def load_all_analytics_data() -> dict:
    """Load all analytics data"""
    analytics_dir = DATA_DIR / "analytics"
    data = {}

    if not analytics_dir.exists():
        return data

    for file in analytics_dir.glob("*_analytics.json"):
        member_key = file.stem.replace("_analytics", "")
        with open(file) as f:
            data[member_key] = json.load(f)

    return data


def generate_communication_summary(config: dict, slack_data: dict) -> str:
    """Generate a communication summary table"""
    lines = [
        "## Communication Summary",
        "",
        "| Name | Total Messages | Msg/Week | Avg Length | Top Channels |",
        "|------|----------------|----------|------------|--------------|",
    ]

    for member in config["team_members"]:
        member_key = member["profile_file"].replace(".md", "")
        data = slack_data.get(member_key, {})

        if "public_channels" in data:
            metrics = data["public_channels"].get("metrics", {})
            channels = data["public_channels"].get("channel_breakdown", {})
            top_channels = ", ".join(list(channels.keys())[:3]) if channels else "N/A"

            lines.append(
                f"| {member['name']} | "
                f"{metrics.get('total_messages', 'N/A')} | "
                f"{metrics.get('messages_per_week', 'N/A')} | "
                f"{metrics.get('average_message_length', 'N/A')} | "
                f"{top_channels} |"
            )
        else:
            lines.append(f"| {member['name']} | N/A | N/A | N/A | N/A |")

    return "\n".join(lines)


def generate_delivery_summary(config: dict, analytics_data: dict) -> str:
    """Generate a delivery metrics summary table"""
    lines = [
        "## Delivery Summary",
        "",
        "| Name | PRs Merged | Reviews | Lines +/- | Deploy Freq |",
        "|------|------------|---------|-----------|-------------|",
    ]

    for member in config["team_members"]:
        member_key = member["profile_file"].replace(".md", "")
        data = analytics_data.get(member_key, {})

        periods = data.get("periods", {})
        if periods:
            # Get most recent period
            latest_period = sorted(periods.keys(), reverse=True)[0]
            latest = periods[latest_period]
            metrics = latest.get("metrics", {})
            dora = latest.get("dora", {})

            lines_added = metrics.get("lines_added", 0)
            lines_deleted = metrics.get("lines_deleted", 0)
            lines_change = f"+{lines_added}/-{lines_deleted}" if lines_added or lines_deleted else "N/A"

            lines.append(
                f"| {member['name']} | "
                f"{metrics.get('prs_merged', 'N/A')} | "
                f"{metrics.get('reviews', 'N/A')} | "
                f"{lines_change} | "
                f"{dora.get('deployment_frequency', 'N/A')} |"
            )
        else:
            lines.append(f"| {member['name']} | N/A | N/A | N/A | N/A |")

    return "\n".join(lines)


def generate_squad_breakdown(config: dict) -> str:
    """Generate a breakdown by squad"""
    squads = {}
    for member in config["team_members"]:
        squad = member.get("squad", "Unassigned")
        if squad not in squads:
            squads[squad] = []
        squads[squad].append(member["name"])

    lines = [
        "## Squad Breakdown",
        "",
    ]

    for squad, members in sorted(squads.items()):
        lines.append(f"### {squad}")
        for member in members:
            lines.append(f"- {member}")
        lines.append("")

    return "\n".join(lines)


def generate_standouts(
    config: dict, slack_data: dict, analytics_data: dict
) -> str:
    """Identify standouts (positive and concerning)"""
    lines = [
        "## Standouts",
        "",
        "### High Performers",
        "",
    ]

    # Find top performers by various metrics
    high_performers = []
    concerning = []

    for member in config["team_members"]:
        member_key = member["profile_file"].replace(".md", "")

        # Check Slack activity
        slack = slack_data.get(member_key, {})
        if "public_channels" in slack:
            msgs = slack["public_channels"].get("metrics", {}).get("total_messages", 0)
            if msgs > 500:
                high_performers.append(
                    f"**{member['name']}**: High communication engagement ({msgs} messages)"
                )
            elif msgs < 50:
                concerning.append(
                    f"**{member['name']}**: Low public channel activity ({msgs} messages)"
                )

        # Check analytics
        analytics = analytics_data.get(member_key, {})
        periods = analytics.get("periods", {})
        if periods:
            latest_period = sorted(periods.keys(), reverse=True)[0]
            latest = periods[latest_period]
            prs = latest.get("metrics", {}).get("prs_merged", 0)
            if prs and prs > 20:
                high_performers.append(
                    f"**{member['name']}**: Strong PR output ({prs} PRs merged)"
                )

    if high_performers:
        for item in high_performers:
            lines.append(f"- {item}")
    else:
        lines.append("*No standouts identified yet - run data collection first*")

    lines.extend([
        "",
        "### Areas of Concern",
        "",
    ])

    if concerning:
        for item in concerning:
            lines.append(f"- {item}")
    else:
        lines.append("*No concerns identified*")

    return "\n".join(lines)


def generate_team_summary(config: dict, output_path: Optional[Path] = None) -> str:
    """Generate the complete team summary"""
    # Load data
    slack_data = load_all_slack_data()
    analytics_data = load_all_analytics_data()

    # Generate sections
    sections = [
        f"# Team Summary",
        "",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
        "",
        f"**Team Size:** {len(config['team_members'])} direct reports",
        "",
        "---",
        "",
        generate_squad_breakdown(config),
        "---",
        "",
        generate_communication_summary(config, slack_data),
        "",
        "---",
        "",
        generate_delivery_summary(config, analytics_data),
        "",
        "---",
        "",
        generate_standouts(config, slack_data, analytics_data),
        "",
        "---",
        "",
        "## Quick Links",
        "",
    ]

    # Add links to individual profiles
    for member in config["team_members"]:
        sections.append(f"- [{member['name']}](profiles/{member['profile_file']})")

    content = "\n".join(sections)

    # Write to file if path provided
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            f.write(content)
        print(f"Summary saved to: {output_path}")

    return content


def generate_comparison_matrix(config: dict, output_path: Optional[Path] = None) -> str:
    """Generate a comparison matrix for all team members"""
    slack_data = load_all_slack_data()
    analytics_data = load_all_analytics_data()

    lines = [
        "# Team Comparison Matrix",
        "",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
        "",
        "## Metrics Comparison",
        "",
        "| Name | Squad | Level | Messages | PRs | Reviews |",
        "|------|-------|-------|----------|-----|---------|",
    ]

    for member in config["team_members"]:
        member_key = member["profile_file"].replace(".md", "")

        # Get Slack metrics
        slack = slack_data.get(member_key, {})
        messages = "N/A"
        if "public_channels" in slack:
            messages = slack["public_channels"].get("metrics", {}).get("total_messages", "N/A")

        # Get analytics metrics
        analytics = analytics_data.get(member_key, {})
        prs = "N/A"
        reviews = "N/A"
        periods = analytics.get("periods", {})
        if periods:
            latest_period = sorted(periods.keys(), reverse=True)[0]
            latest = periods[latest_period]
            prs = latest.get("metrics", {}).get("prs_merged", "N/A")
            reviews = latest.get("metrics", {}).get("reviews", "N/A")

        lines.append(
            f"| {member['name']} | "
            f"{member.get('squad', 'TBD')} | "
            f"{member.get('level', 'TBD')} | "
            f"{messages} | "
            f"{prs} | "
            f"{reviews} |"
        )

    content = "\n".join(lines)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            f.write(content)
        print(f"Matrix saved to: {output_path}")

    return content


def main():
    parser = argparse.ArgumentParser(
        description="Generate team summary and comparison views"
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Generate team summary",
    )
    parser.add_argument(
        "--matrix",
        action="store_true",
        help="Generate comparison matrix",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Generate all views",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output directory",
    )

    args = parser.parse_args()

    # Load config
    config = load_config()

    # Determine output directory
    output_dir = Path(args.output) if args.output else PROJECT_DIR

    if args.all or args.summary:
        summary_path = output_dir / "TEAM_SUMMARY.md"
        generate_team_summary(config, summary_path)

    if args.all or args.matrix:
        matrix_path = output_dir / "COMPARISON_MATRIX.md"
        generate_comparison_matrix(config, matrix_path)

    if not any([args.summary, args.matrix, args.all]):
        parser.print_help()
        print("\nUse --summary, --matrix, or --all to generate reports")


if __name__ == "__main__":
    main()
