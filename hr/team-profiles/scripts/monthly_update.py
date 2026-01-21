#!/usr/bin/env python3
"""
Monthly Profile Update Script

Comprehensive script for monthly profile updates and pre-talent review preparation.
Orchestrates all data collection, identifies stale data requiring manual refresh,
updates all profiles, and generates a summary report.

Usage:
    # Standard monthly update
    python monthly_update.py

    # Pre-talent review (more verbose, includes recommendations)
    python monthly_update.py --talent-review

    # Skip automated data collection (just update profiles with existing data)
    python monthly_update.py --skip-collection

    # Dry run to see what would be updated
    python monthly_update.py --dry-run
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import yaml

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_DIR / "config.yaml"
DATA_DIR = PROJECT_DIR / "data"
PROFILES_DIR = PROJECT_DIR / "profiles"
REPORTS_DIR = PROJECT_DIR / "reports"

# Data source paths
SLACK_DATA_PATH = DATA_DIR / "slack"
ANALYTICS_DATA_PATH = DATA_DIR / "analytics"
HUMAANS_DATA_PATH = DATA_DIR / "humaans"
NOTION_DATA_PATH = DATA_DIR / "notion"
EMAIL_DATA_PATH = DATA_DIR / "email"
MEETING_DATA_PATH = DATA_DIR / "meetings"

# Data files
RFC_ENGAGEMENT_FILE = NOTION_DATA_PATH / "rfc_engagement.json"
EMAIL_ENGAGEMENT_FILE = EMAIL_DATA_PATH / "email_engagement.json"
MEETING_ENGAGEMENT_FILE = MEETING_DATA_PATH / "meeting_engagement.json"

# Freshness thresholds (days)
THRESHOLDS = {
    "critical": 60,  # Data older than this is critically stale
    "warning": 30,   # Data older than this needs attention
    "ok": 14,        # Data within this range is fresh
}


class Colors:
    """ANSI color codes for terminal output"""
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


def color(text: str, color_code: str) -> str:
    """Wrap text in color codes"""
    return f"{color_code}{text}{Colors.END}"


def load_config() -> dict:
    """Load configuration from config.yaml"""
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def get_data_freshness(file_path: Path, date_key: str = "analysis_date") -> Optional[datetime]:
    """Get the date when a data file was last updated"""
    if not file_path.exists():
        return None
    try:
        with open(file_path) as f:
            data = json.load(f)
        date_str = data.get(date_key)
        if date_str:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except (json.JSONDecodeError, ValueError, KeyError):
        pass
    return None


def days_since(date: Optional[datetime]) -> Optional[int]:
    """Calculate days since a date"""
    if not date:
        return None
    return (datetime.now() - date).days


def freshness_status(days: Optional[int]) -> tuple[str, str]:
    """Return status emoji and color based on days since update"""
    if days is None:
        return "❌", Colors.RED
    elif days <= THRESHOLDS["ok"]:
        return "✅", Colors.GREEN
    elif days <= THRESHOLDS["warning"]:
        return "⚠️", Colors.YELLOW
    else:
        return "🔴", Colors.RED


def check_credentials() -> dict:
    """Check if required credentials are available"""
    results = {}
    credentials = [
        ("slack-token", "Slack API"),
        ("humaans-api-token", "Humaans HR"),
        ("github-token", "GitHub"),
    ]

    for key, name in credentials:
        service = f"apolitical-assistant-{key}"
        try:
            result = subprocess.run(
                ["security", "find-generic-password", "-s", service, "-w"],
                capture_output=True, text=True, check=True
            )
            results[name] = True
        except subprocess.CalledProcessError:
            results[name] = False

    return results


def check_dev_analytics_repo(config: dict) -> tuple[bool, str]:
    """Check if dev-analytics repo exists and has recent reports"""
    path = Path(config.get("data_sources", {}).get("dev_analytics_path", "")).expanduser()
    if not path.exists():
        return False, "Repository not found"

    reports_dir = path / "reports"
    if not reports_dir.exists():
        return False, "No reports directory"

    # Check for recent reports
    report_files = list(reports_dir.glob("*.json")) + list(reports_dir.glob("*.md"))
    if not report_files:
        return False, "No report files found"

    latest = max(report_files, key=lambda p: p.stat().st_mtime)
    days_old = (datetime.now() - datetime.fromtimestamp(latest.stat().st_mtime)).days

    if days_old > 45:
        return True, f"Reports are {days_old} days old - run 'make monthly' in dev-analytics"

    return True, f"Latest report: {days_old} days ago"


def print_header(title: str):
    """Print a section header"""
    print(f"\n{color('=' * 70, Colors.BLUE)}")
    print(color(f"  {title}", Colors.BOLD))
    print(f"{color('=' * 70, Colors.BLUE)}\n")


def print_subheader(title: str):
    """Print a subsection header"""
    print(f"\n{color(title, Colors.CYAN)}")
    print("-" * 50)


def run_preflight_checks(config: dict) -> bool:
    """Run pre-flight checks and return True if all critical checks pass"""
    print_header("Pre-flight Checks")

    all_ok = True

    # Check config
    print_subheader("Configuration")
    team_count = len(config.get("team_members", []))
    print(f"  Team members configured: {team_count}")
    if team_count == 0:
        print(color("  ❌ No team members in config.yaml!", Colors.RED))
        all_ok = False
    else:
        print(color("  ✅ Configuration OK", Colors.GREEN))

    # Check credentials
    print_subheader("Credentials (Keychain)")
    creds = check_credentials()
    for name, available in creds.items():
        if available:
            print(f"  ✅ {name}")
        else:
            print(color(f"  ❌ {name} - run 'npm run setup' to configure", Colors.RED))
            if name in ["Slack API", "Humaans HR"]:
                all_ok = False

    # Check dev-analytics repo
    print_subheader("Dev Analytics Repository")
    repo_ok, repo_msg = check_dev_analytics_repo(config)
    if repo_ok:
        print(f"  ✅ {repo_msg}")
    else:
        print(color(f"  ⚠️ {repo_msg}", Colors.YELLOW))

    # Check directories
    print_subheader("Directory Structure")
    dirs_to_check = [
        (PROFILES_DIR, "Profiles"),
        (DATA_DIR, "Data"),
        (PROJECT_DIR / "templates", "Templates"),
    ]
    for dir_path, name in dirs_to_check:
        if dir_path.exists():
            print(f"  ✅ {name}: {dir_path}")
        else:
            print(color(f"  ❌ {name} missing: {dir_path}", Colors.RED))
            all_ok = False

    return all_ok


def get_all_data_freshness(config: dict) -> dict:
    """Get freshness status for all data sources"""
    freshness = {
        "automated": {},
        "manual_mcp": {},
    }

    # Automated sources
    # Humaans - check individual files
    humaans_dates = []
    for member in config.get("team_members", []):
        email = member["email"]
        safe_email = email.replace("@", "_at_").replace(".", "_")
        humaans_file = HUMAANS_DATA_PATH / f"{safe_email}.json"
        if humaans_file.exists():
            humaans_dates.append(datetime.fromtimestamp(humaans_file.stat().st_mtime))

    if humaans_dates:
        freshness["automated"]["Humaans HR"] = min(humaans_dates)
    else:
        freshness["automated"]["Humaans HR"] = None

    # Slack - check combined file
    slack_combined = SLACK_DATA_PATH / "all_slack_analysis.json"
    freshness["automated"]["Slack Public Channels"] = get_data_freshness(slack_combined)

    # Analytics
    analytics_combined = ANALYTICS_DATA_PATH / "all_analytics.json"
    freshness["automated"]["Dev Analytics"] = get_data_freshness(analytics_combined, "import_date")

    # Manual MCP sources
    freshness["manual_mcp"]["Notion RFCs"] = get_data_freshness(RFC_ENGAGEMENT_FILE)
    freshness["manual_mcp"]["Gmail Email"] = get_data_freshness(EMAIL_ENGAGEMENT_FILE)
    freshness["manual_mcp"]["Gemini Meeting Notes"] = get_data_freshness(MEETING_ENGAGEMENT_FILE)

    return freshness


def print_data_freshness_report(freshness: dict):
    """Print a report on data freshness"""
    print_header("Data Freshness Report")

    print_subheader("Automated Data Sources (refreshed by this script)")
    for source, date in freshness["automated"].items():
        days = days_since(date)
        emoji, col = freshness_status(days)
        if date:
            print(f"  {emoji} {source}: {date.strftime('%Y-%m-%d')} ({days} days ago)")
        else:
            print(color(f"  {emoji} {source}: Never collected", Colors.RED))

    print_subheader("Manual MCP Data Sources (require Claude Code refresh)")
    stale_sources = []
    for source, date in freshness["manual_mcp"].items():
        days = days_since(date)
        emoji, col = freshness_status(days)
        if date:
            print(f"  {emoji} {source}: {date.strftime('%Y-%m-%d')} ({days} days ago)")
            if days and days > THRESHOLDS["warning"]:
                stale_sources.append(source)
        else:
            print(color(f"  {emoji} {source}: Never collected", Colors.RED))
            stale_sources.append(source)

    if stale_sources:
        print(f"\n{color('⚠️  Action Required:', Colors.YELLOW)}")
        print("  The following data sources need manual refresh via Claude Code:")
        for source in stale_sources:
            print(f"    - {source}")
        print("\n  See MAINTENANCE_GUIDE.md for refresh instructions.")

    return stale_sources


def run_automated_collection(config: dict, dry_run: bool = False):
    """Run all automated data collection"""
    print_header("Automated Data Collection")

    if dry_run:
        print(color("  [DRY RUN] Would run the following:", Colors.YELLOW))
        print("    1. Fetch Humaans HR data")
        print("    2. Run Slack public channel analysis")
        print("    3. Import dev-analytics reports")
        return

    # Run update_profiles.py with --collect flag
    print("Running automated data collection...")
    print("This may take several minutes.\n")

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_DIR / "update_profiles.py"),
            "--all",
            "--collect",
            "--force",
        ],
        cwd=SCRIPT_DIR,
    )

    if result.returncode != 0:
        print(color("\n⚠️ Some collection tasks may have failed. Check output above.", Colors.YELLOW))
    else:
        print(color("\n✅ Data collection complete", Colors.GREEN))


def update_all_profiles(dry_run: bool = False):
    """Update all profiles with collected data"""
    print_header("Profile Updates")

    if dry_run:
        config = load_config()
        print(color("  [DRY RUN] Would update profiles for:", Colors.YELLOW))
        for member in config.get("team_members", []):
            profile_path = PROFILES_DIR / member["profile_file"]
            status = "update" if profile_path.exists() else "create"
            print(f"    - {member['name']} ({status})")
        return

    # Profiles are already updated by run_automated_collection
    # This function is here for the --skip-collection case
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_DIR / "update_profiles.py"),
            "--all",
            "--force",
        ],
        cwd=SCRIPT_DIR,
        capture_output=True,
        text=True,
    )

    # Count updates
    updated = result.stdout.count("Updated:")
    print(f"  Updated {updated} profiles")


def generate_summary_report(config: dict, freshness: dict, stale_sources: list, talent_review: bool = False) -> str:
    """Generate a summary report"""
    print_header("Summary Report")

    now = datetime.now()
    report_lines = [
        f"# Profile Update Summary",
        f"",
        f"**Generated:** {now.strftime('%Y-%m-%d %H:%M')}",
        f"**Mode:** {'Talent Review Preparation' if talent_review else 'Monthly Update'}",
        f"",
        f"## Team Members Updated",
        f"",
    ]

    for member in config.get("team_members", []):
        profile_path = PROFILES_DIR / member["profile_file"]
        if profile_path.exists():
            report_lines.append(f"- ✅ {member['name']}")
        else:
            report_lines.append(f"- ❌ {member['name']} (profile missing)")

    report_lines.extend([
        f"",
        f"## Data Freshness",
        f"",
        f"### Automated Sources",
        f"",
    ])

    for source, date in freshness["automated"].items():
        days = days_since(date)
        if date:
            status = "✅" if days and days <= THRESHOLDS["warning"] else "⚠️"
            report_lines.append(f"- {status} **{source}**: {date.strftime('%Y-%m-%d')} ({days} days)")
        else:
            report_lines.append(f"- ❌ **{source}**: Not collected")

    report_lines.extend([
        f"",
        f"### Manual MCP Sources",
        f"",
    ])

    for source, date in freshness["manual_mcp"].items():
        days = days_since(date)
        if date:
            status = "✅" if days and days <= THRESHOLDS["warning"] else "⚠️"
            report_lines.append(f"- {status} **{source}**: {date.strftime('%Y-%m-%d')} ({days} days)")
        else:
            report_lines.append(f"- ❌ **{source}**: Not collected")

    if stale_sources:
        report_lines.extend([
            f"",
            f"## ⚠️ Action Required",
            f"",
            f"The following data sources need manual refresh via Claude Code with MCP:",
            f"",
        ])
        for source in stale_sources:
            report_lines.append(f"- {source}")
        report_lines.extend([
            f"",
            f"See `docs/MAINTENANCE_GUIDE.md` for refresh instructions.",
        ])

    if talent_review:
        report_lines.extend([
            f"",
            f"## Talent Review Checklist",
            f"",
            f"- [ ] All profiles have been updated with latest data",
            f"- [ ] Manual MCP data sources are fresh (< 30 days old)",
            f"- [ ] Leadership Values assessments are filled in",
            f"- [ ] Engineering Values assessments are filled in",
            f"- [ ] Development Areas & Growth Plans are current",
            f"- [ ] 1:1 notes have been added from recent meetings",
            f"- [ ] Evidence log has recent achievements documented",
        ])

    report_lines.extend([
        f"",
        f"---",
        f"",
        f"*Report generated by monthly_update.py*",
    ])

    report = "\n".join(report_lines)

    # Save report
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = REPORTS_DIR / f"update_summary_{now.strftime('%Y-%m-%d')}.md"
    with open(report_file, "w") as f:
        f.write(report)

    print(f"  Report saved: {report_file}")

    # Print summary to terminal
    print_subheader("Quick Summary")

    team_count = len(config.get("team_members", []))
    profiles_exist = sum(1 for m in config.get("team_members", [])
                        if (PROFILES_DIR / m["profile_file"]).exists())

    print(f"  Profiles: {profiles_exist}/{team_count} up to date")

    fresh_automated = sum(1 for d in freshness["automated"].values()
                         if d and days_since(d) and days_since(d) <= THRESHOLDS["warning"])
    print(f"  Automated data sources: {fresh_automated}/{len(freshness['automated'])} fresh")

    fresh_manual = sum(1 for d in freshness["manual_mcp"].values()
                      if d and days_since(d) and days_since(d) <= THRESHOLDS["warning"])
    print(f"  Manual MCP sources: {fresh_manual}/{len(freshness['manual_mcp'])} fresh")

    if stale_sources:
        print(color(f"\n  ⚠️ {len(stale_sources)} data source(s) need manual refresh", Colors.YELLOW))
    else:
        print(color("\n  ✅ All data sources are fresh!", Colors.GREEN))

    return report


def print_mcp_refresh_instructions(stale_sources: list):
    """Print instructions for refreshing stale MCP data sources"""
    if not stale_sources:
        return

    print_header("MCP Refresh Instructions")

    instructions = {
        "Notion RFCs": """
  1. Open Claude Code in the apolitical-assistant directory
  2. Run: "Analyze RFC engagement from Notion for all direct reports and
     update the data files in hr/team-profiles/data/notion/"
""",
        "Gmail Email": """
  1. Open Claude Code in the apolitical-assistant directory
  2. For each direct report, run:
     "Search my Gmail for emails from {email} in the last 12 months.
     Analyze communication patterns and update email_engagement.json"
""",
        "Gemini Meeting Notes": """
  1. Open Claude Code in the apolitical-assistant directory
  2. Search for Gemini notes: "Search Google Drive for 'Notes by Gemini'
     from the last 3 months"
  3. For each direct report: "Analyze meeting engagement for {name}
     from the Gemini notes and update meeting_engagement.json"
""",
    }

    for source in stale_sources:
        if source in instructions:
            print(f"{color(source, Colors.BOLD)}")
            print(instructions[source])


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Comprehensive monthly profile update script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python monthly_update.py                  # Standard monthly update
  python monthly_update.py --talent-review  # Pre-talent review preparation
  python monthly_update.py --skip-collection # Update profiles only
  python monthly_update.py --dry-run        # Preview what would happen
        """,
    )
    parser.add_argument(
        "--talent-review",
        action="store_true",
        help="Prepare for talent review (includes checklist and recommendations)",
    )
    parser.add_argument(
        "--skip-collection",
        action="store_true",
        help="Skip automated data collection, just update profiles",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be updated without making changes",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args()

    # Disable colors if requested
    if args.no_color:
        Colors.RED = ""
        Colors.GREEN = ""
        Colors.YELLOW = ""
        Colors.BLUE = ""
        Colors.CYAN = ""
        Colors.BOLD = ""
        Colors.END = ""

    # Header
    mode = "Talent Review Preparation" if args.talent_review else "Monthly Update"
    print(f"\n{color('╔' + '═' * 68 + '╗', Colors.BLUE)}")
    print(f"{color('║', Colors.BLUE)}  {color('Team Profile ' + mode, Colors.BOLD):<66} {color('║', Colors.BLUE)}")
    print(f"{color('║', Colors.BLUE)}  {datetime.now().strftime('%Y-%m-%d %H:%M'):<66} {color('║', Colors.BLUE)}")
    print(f"{color('╚' + '═' * 68 + '╝', Colors.BLUE)}")

    # Load config
    config = load_config()

    # Pre-flight checks
    if not run_preflight_checks(config):
        print(color("\n❌ Pre-flight checks failed. Please fix issues above.", Colors.RED))
        sys.exit(1)

    # Get initial data freshness
    freshness = get_all_data_freshness(config)

    # Print data freshness report
    stale_sources = print_data_freshness_report(freshness)

    # Run automated collection (unless skipped)
    if not args.skip_collection:
        run_automated_collection(config, args.dry_run)
        # Refresh freshness data after collection
        if not args.dry_run:
            freshness = get_all_data_freshness(config)
            stale_sources = [s for s, d in freshness["manual_mcp"].items()
                           if not d or (days_since(d) and days_since(d) > THRESHOLDS["warning"])]
    elif args.skip_collection and not args.dry_run:
        # Just update profiles with existing data
        update_all_profiles(args.dry_run)

    # Generate summary report
    generate_summary_report(config, freshness, stale_sources, args.talent_review)

    # Print MCP refresh instructions if needed
    if stale_sources and (args.talent_review or any(
        not d or (days_since(d) and days_since(d) > THRESHOLDS["critical"])
        for d in freshness["manual_mcp"].values()
    )):
        print_mcp_refresh_instructions(stale_sources)

    # Final status
    print_header("Complete")

    if args.dry_run:
        print(color("  This was a dry run. No changes were made.", Colors.YELLOW))
    else:
        print(color("  ✅ Monthly update complete!", Colors.GREEN))
        if stale_sources:
            print(f"\n  Next step: Refresh stale MCP data sources using Claude Code")
            print(f"  Then run: python monthly_update.py --skip-collection")

    print()


if __name__ == "__main__":
    main()
