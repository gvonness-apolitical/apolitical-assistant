#!/usr/bin/env python3
"""
Slack Communication Analyzer for Team Profiles

Analyzes Slack communications (public channels and DMs) for each team member
to extract communication patterns, metrics, and notable messages.

Uses the same Keychain credentials as the main apolitical-assistant project.
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests

from utils import get_credential, load_config, DATA_DIR

# Slack-specific data directory
SLACK_DATA_DIR = DATA_DIR / "slack"


class SlackAnalyzer:
    """Analyzes Slack communications for a team member"""

    def __init__(self, token: str, channels_to_exclude: list = None):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.base_url = "https://slack.com/api"
        # Normalize excluded channels to lowercase for case-insensitive matching
        self.channels_to_exclude = set(
            ch.lower() for ch in (channels_to_exclude or [])
        )

    def _api_call(self, method: str, params: dict = None) -> dict:
        """Make a Slack API call"""
        url = f"{self.base_url}/{method}"
        response = requests.get(url, headers=self.headers, params=params or {})
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            raise Exception(f"Slack API error: {data.get('error', 'Unknown error')}")
        return data

    def search_messages(
        self, query: str, count: int = 100, page: int = 1
    ) -> dict:
        """Search for messages matching a query"""
        return self._api_call(
            "search.messages",
            {"query": query, "count": count, "page": page, "sort": "timestamp"},
        )

    def get_user_info(self, user_id: str) -> dict:
        """Get information about a user"""
        return self._api_call("users.info", {"user": user_id})

    def get_conversations_history(
        self, channel_id: str, oldest: float = None, limit: int = 100
    ) -> dict:
        """Get conversation history from a channel"""
        params = {"channel": channel_id, "limit": limit}
        if oldest:
            params["oldest"] = oldest
        return self._api_call("conversations.history", params)

    def analyze_user_messages(
        self, user_id: str, user_name: str, months: int = 12
    ) -> dict:
        """Analyze all messages from a user over a time period"""
        # Calculate the start date
        start_date = datetime.now() - timedelta(days=months * 30)
        start_ts = start_date.timestamp()

        # Search for messages from this user
        all_messages = []
        page = 1
        max_pages = 50  # Safety limit

        print(f"Searching for messages from {user_name}...")

        while page <= max_pages:
            query = f"from:<@{user_id}> after:{start_date.strftime('%Y-%m-%d')}"
            try:
                result = self.search_messages(query, count=100, page=page)
                messages = result.get("messages", {}).get("matches", [])

                if not messages:
                    break

                all_messages.extend(messages)
                print(f"  Found {len(all_messages)} messages so far (page {page})...")

                # Check if there are more pages
                pagination = result.get("messages", {}).get("pagination", {})
                total_pages = pagination.get("page_count", 1)
                if page >= total_pages:
                    break

                page += 1

            except Exception as e:
                print(f"  Error on page {page}: {e}")
                break

        print(f"  Total messages found: {len(all_messages)}")

        # Analyze the messages
        return self._analyze_messages(all_messages, user_name)

    def _analyze_messages(self, messages: list, user_name: str) -> dict:
        """Analyze a list of messages and extract metrics"""
        if not messages:
            return {
                "user_name": user_name,
                "total_messages": 0,
                "total_messages_before_filter": 0,
                "excluded_channels_count": 0,
                "analysis_date": datetime.now().isoformat(),
                "metrics": {},
                "channel_breakdown": {},
                "excluded_channels": list(self.channels_to_exclude),
                "notable_messages": [],
            }

        # Filter out messages from excluded channels
        excluded_count = 0
        filtered_messages = []
        excluded_channel_counts = defaultdict(int)

        for msg in messages:
            channel_name = msg.get("channel", {}).get("name", "unknown")
            if channel_name.lower() in self.channels_to_exclude:
                excluded_count += 1
                excluded_channel_counts[channel_name] += 1
            else:
                filtered_messages.append(msg)

        if excluded_count > 0:
            print(f"  Filtered out {excluded_count} messages from excluded channels")

        messages = filtered_messages

        if not messages:
            return {
                "user_name": user_name,
                "total_messages": 0,
                "total_messages_before_filter": excluded_count,
                "excluded_channels_count": excluded_count,
                "analysis_date": datetime.now().isoformat(),
                "metrics": {},
                "channel_breakdown": {},
                "excluded_channels": list(self.channels_to_exclude),
                "excluded_channel_breakdown": dict(excluded_channel_counts),
                "notable_messages": [],
            }

        # Basic metrics
        total_messages = len(messages)
        message_lengths = [len(m.get("text", "")) for m in messages]
        avg_length = sum(message_lengths) / total_messages if total_messages else 0

        # Channel breakdown
        channel_counts = defaultdict(int)
        for msg in messages:
            channel = msg.get("channel", {}).get("name", "unknown")
            channel_counts[channel] += 1

        # Time analysis
        timestamps = []
        for msg in messages:
            try:
                ts = float(msg.get("ts", 0))
                if ts:
                    timestamps.append(datetime.fromtimestamp(ts))
            except (ValueError, TypeError):
                pass

        # Messages per week
        if timestamps:
            date_range = (max(timestamps) - min(timestamps)).days
            weeks = max(date_range / 7, 1)
            messages_per_week = total_messages / weeks
        else:
            messages_per_week = 0

        # Hour distribution
        hour_distribution = defaultdict(int)
        day_distribution = defaultdict(int)
        for ts in timestamps:
            hour_distribution[ts.hour] += 1
            day_distribution[ts.strftime("%A")] += 1

        # Find peak activity times
        peak_hour = max(hour_distribution.items(), key=lambda x: x[1])[0] if hour_distribution else None
        peak_day = max(day_distribution.items(), key=lambda x: x[1])[0] if day_distribution else None

        # Notable messages (longer, more reactions, etc.)
        notable_messages = []
        for msg in sorted(messages, key=lambda m: len(m.get("text", "")), reverse=True)[:10]:
            notable_messages.append({
                "text": msg.get("text", "")[:500],  # Truncate for privacy
                "channel": msg.get("channel", {}).get("name", "unknown"),
                "timestamp": msg.get("ts"),
                "permalink": msg.get("permalink"),
            })

        return {
            "user_name": user_name,
            "total_messages": total_messages,
            "total_messages_before_filter": total_messages + excluded_count,
            "excluded_channels_count": excluded_count,
            "analysis_date": datetime.now().isoformat(),
            "analysis_period_months": 12,
            "metrics": {
                "total_messages": total_messages,
                "average_message_length": round(avg_length, 1),
                "messages_per_week": round(messages_per_week, 1),
                "peak_activity_hour": peak_hour,
                "peak_activity_day": peak_day,
            },
            "channel_breakdown": dict(sorted(channel_counts.items(), key=lambda x: x[1], reverse=True)),
            "excluded_channels": list(self.channels_to_exclude),
            "excluded_channel_breakdown": dict(excluded_channel_counts) if excluded_count else {},
            "hour_distribution": dict(sorted(hour_distribution.items())),
            "day_distribution": dict(day_distribution),
            "notable_messages": notable_messages,
        }

    def analyze_dm_history(self, user_id: str, user_name: str) -> dict:
        """
        Analyze DM history with a user.
        Note: This requires appropriate Slack permissions.
        """
        # This is a placeholder - DM access requires additional permissions
        # and should be used carefully with privacy considerations
        return {
            "user_name": user_name,
            "user_id": user_id,
            "analysis_date": datetime.now().isoformat(),
            "note": "DM analysis requires manual review due to privacy considerations",
            "summary": {
                "communication_frequency": "TBD",
                "responsiveness": "TBD",
                "tone": "TBD",
            },
        }


def analyze_person(config: dict, person_name: str, months: int = 12) -> dict:
    """Analyze Slack communications for a specific person"""
    # Find the person in config
    person = None
    for member in config["team_members"]:
        if member["name"].lower() == person_name.lower():
            person = member
            break

    if not person:
        raise ValueError(f"Person '{person_name}' not found in config")

    # Get Slack token
    token = get_credential("slack-token")
    if not token:
        raise ValueError("Slack token not found in Keychain")

    # Get excluded channels from config
    channels_to_exclude = config.get("channels_to_exclude", [])

    # Create analyzer with excluded channels
    analyzer = SlackAnalyzer(token, channels_to_exclude=channels_to_exclude)

    # Analyze public messages
    public_analysis = analyzer.analyze_user_messages(
        person["slack_id"], person["name"], months
    )

    # Analyze DMs (placeholder)
    dm_analysis = analyzer.analyze_dm_history(person["slack_id"], person["name"])

    return {
        "person": person,
        "public_channels": public_analysis,
        "direct_messages": dm_analysis,
        "generated_at": datetime.now().isoformat(),
    }


def analyze_all(config: dict, months: int = 12, output_dir: Path = None) -> list:
    """Analyze all team members"""
    output_dir = output_dir or SLACK_DATA_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for member in config["team_members"]:
        print(f"\n{'='*60}")
        print(f"Analyzing: {member['name']}")
        print(f"{'='*60}")

        try:
            analysis = analyze_person(config, member["name"], months)
            results.append(analysis)

            # Save individual result
            output_file = output_dir / f"{member['profile_file'].replace('.md', '')}_slack.json"
            with open(output_file, "w") as f:
                json.dump(analysis, f, indent=2, default=str)
            print(f"Saved to: {output_file}")

        except Exception as e:
            print(f"Error analyzing {member['name']}: {e}")
            results.append({"person": member, "error": str(e)})

    # Save combined results
    combined_file = output_dir / "all_slack_analysis.json"
    with open(combined_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nCombined results saved to: {combined_file}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Analyze Slack communications for team members"
    )
    parser.add_argument(
        "--person",
        type=str,
        help="Name of the person to analyze (e.g., 'Samuel Balogun')",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Analyze all team members",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=12,
        help="Number of months to analyze (default: 12)",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output directory for results",
    )

    args = parser.parse_args()

    # Load config
    config = load_config()

    # Determine output directory
    output_dir = Path(args.output) if args.output else DATA_DIR

    if args.all:
        results = analyze_all(config, args.months, output_dir)
        print(f"\nAnalyzed {len(results)} team members")
    elif args.person:
        result = analyze_person(config, args.person, args.months)
        output_file = output_dir / f"{args.person.lower().replace(' ', '-')}_slack.json"
        output_dir.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nResults saved to: {output_file}")
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
