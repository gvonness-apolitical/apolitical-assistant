#!/usr/bin/env python3
"""
Notion RFC Analyzer for Team Profiles

Analyzes RFC engagement on Notion for each team member:
- RFCs authored (Owner)
- RFCs contributed to (Contributors)
- Comments on RFCs

Uses the Notion API to fetch data from the Proposals (aka RFCs) database.
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

from utils import get_credential, load_config, DATA_DIR

# Notion-specific data directory
NOTION_DATA_DIR = DATA_DIR / "notion"

# RFC Database ID
RFC_DATABASE_ID = "090aa88f-f28d-43cb-9d1d-deeb91ce0cc6"


class NotionClient:
    """Simple Notion API client"""

    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
        self.base_url = "https://api.notion.com/v1"

    def _api_call(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make a Notion API call"""
        url = f"{self.base_url}/{endpoint}"
        if method == "GET":
            response = requests.get(url, headers=self.headers)
        elif method == "POST":
            response = requests.post(url, headers=self.headers, json=data or {})
        else:
            raise ValueError(f"Unsupported method: {method}")

        response.raise_for_status()
        return response.json()

    def query_database(self, database_id: str, start_cursor: str = None) -> dict:
        """Query a database for all pages"""
        data = {"page_size": 100}
        if start_cursor:
            data["start_cursor"] = start_cursor
        return self._api_call("POST", f"databases/{database_id}/query", data)

    def get_all_database_pages(self, database_id: str) -> list:
        """Get all pages from a database (handles pagination)"""
        all_pages = []
        start_cursor = None

        while True:
            result = self.query_database(database_id, start_cursor)
            all_pages.extend(result.get("results", []))

            if not result.get("has_more"):
                break
            start_cursor = result.get("next_cursor")

        return all_pages

    def get_page_comments(self, page_id: str) -> list:
        """Get all comments on a page"""
        all_comments = []
        start_cursor = None

        while True:
            endpoint = f"comments?block_id={page_id}"
            if start_cursor:
                endpoint += f"&start_cursor={start_cursor}"

            result = self._api_call("GET", endpoint)
            all_comments.extend(result.get("results", []))

            if not result.get("has_more"):
                break
            start_cursor = result.get("next_cursor")

        return all_comments

    def get_user(self, user_id: str) -> dict:
        """Get user information"""
        return self._api_call("GET", f"users/{user_id}")


def extract_user_ids(property_value: dict) -> list:
    """Extract user IDs from a person property value"""
    if not property_value:
        return []

    people = property_value.get("people", [])
    return [p.get("id") for p in people if p.get("id")]


def extract_property_value(properties: dict, prop_name: str) -> any:
    """Extract a property value from Notion page properties"""
    prop = properties.get(prop_name, {})
    prop_type = prop.get("type")

    if prop_type == "title":
        title_list = prop.get("title", [])
        return "".join([t.get("plain_text", "") for t in title_list])
    elif prop_type == "select":
        select = prop.get("select")
        return select.get("name") if select else None
    elif prop_type == "date":
        date = prop.get("date")
        return date.get("start") if date else None
    elif prop_type == "people":
        return extract_user_ids(prop)

    return None


class RFCAnalyzer:
    """Analyzes RFC engagement for team members"""

    def __init__(self, notion_client: NotionClient, team_members: list):
        self.notion = notion_client
        self.team_members = team_members

        # Build email to member mapping
        self.email_to_member = {
            m["email"].lower(): m for m in team_members
        }

        # We'll populate this with Notion user ID -> member mapping
        self.user_id_to_member = {}

    def _get_notion_user_email(self, user_id: str) -> Optional[str]:
        """Get email for a Notion user ID"""
        try:
            user = self.notion.get_user(user_id)
            if user.get("type") == "person":
                return user.get("person", {}).get("email", "").lower()
        except Exception as e:
            print(f"  Warning: Could not fetch user {user_id}: {e}")
        return None

    def _match_user_to_member(self, user_id: str) -> Optional[dict]:
        """Match a Notion user ID to a team member"""
        if user_id in self.user_id_to_member:
            return self.user_id_to_member[user_id]

        email = self._get_notion_user_email(user_id)
        if email and email in self.email_to_member:
            member = self.email_to_member[email]
            self.user_id_to_member[user_id] = member
            return member

        self.user_id_to_member[user_id] = None
        return None

    def analyze_rfcs(self) -> dict:
        """Analyze all RFCs and return engagement data"""
        print("Fetching RFCs from Notion...")
        rfcs = self.notion.get_all_database_pages(RFC_DATABASE_ID)
        print(f"Found {len(rfcs)} RFCs")

        # Initialize engagement tracking
        engagement = {
            m["email"]: {
                "name": m["name"],
                "email": m["email"],
                "rfcs_authored": [],
                "rfcs_contributed": [],
                "rfc_comments": [],
                "totals": {
                    "authored": 0,
                    "contributed": 0,
                    "comments": 0,
                }
            }
            for m in self.team_members
        }

        # Process each RFC
        for i, rfc in enumerate(rfcs):
            rfc_id = rfc.get("id")
            properties = rfc.get("properties", {})

            title = extract_property_value(properties, "Name")
            status = extract_property_value(properties, "Status")
            created = extract_property_value(properties, "Created")
            owner_ids = extract_property_value(properties, "Owner") or []
            contributor_ids = extract_property_value(properties, "Contributors") or []

            rfc_url = rfc.get("url", "")

            rfc_info = {
                "id": rfc_id,
                "title": title,
                "status": status,
                "created": created,
                "url": rfc_url,
            }

            print(f"  [{i+1}/{len(rfcs)}] Processing: {title[:50]}...")

            # Track authors (Owner field)
            for user_id in owner_ids:
                member = self._match_user_to_member(user_id)
                if member:
                    engagement[member["email"]]["rfcs_authored"].append(rfc_info)
                    engagement[member["email"]]["totals"]["authored"] += 1

            # Track contributors
            for user_id in contributor_ids:
                member = self._match_user_to_member(user_id)
                if member:
                    # Don't double-count if they're also the owner
                    if rfc_info not in engagement[member["email"]]["rfcs_authored"]:
                        engagement[member["email"]]["rfcs_contributed"].append(rfc_info)
                        engagement[member["email"]]["totals"]["contributed"] += 1

            # Get comments on this RFC
            try:
                comments = self.notion.get_page_comments(rfc_id)
                for comment in comments:
                    comment_author_id = comment.get("created_by", {}).get("id")
                    if comment_author_id:
                        member = self._match_user_to_member(comment_author_id)
                        if member:
                            comment_info = {
                                "rfc_id": rfc_id,
                                "rfc_title": title,
                                "rfc_url": rfc_url,
                                "comment_id": comment.get("id"),
                                "created_time": comment.get("created_time"),
                                "text_preview": self._extract_comment_text(comment)[:200],
                            }
                            engagement[member["email"]]["rfc_comments"].append(comment_info)
                            engagement[member["email"]]["totals"]["comments"] += 1
            except Exception as e:
                print(f"    Warning: Could not fetch comments for RFC: {e}")

        return {
            "analysis_date": datetime.now().isoformat(),
            "total_rfcs": len(rfcs),
            "team_engagement": engagement,
        }

    def _extract_comment_text(self, comment: dict) -> str:
        """Extract plain text from a comment"""
        rich_text = comment.get("rich_text", [])
        return "".join([t.get("plain_text", "") for t in rich_text])


def generate_summary(engagement_data: dict) -> str:
    """Generate a summary of RFC engagement"""
    lines = [
        "# RFC Engagement Summary",
        f"\nAnalysis Date: {engagement_data['analysis_date']}",
        f"Total RFCs Analyzed: {engagement_data['total_rfcs']}",
        "\n## Team Member Engagement\n",
        "| Name | RFCs Authored | RFCs Contributed | Comments |",
        "|------|---------------|------------------|----------|",
    ]

    # Sort by total engagement
    sorted_members = sorted(
        engagement_data["team_engagement"].values(),
        key=lambda x: (x["totals"]["authored"] + x["totals"]["contributed"] + x["totals"]["comments"]),
        reverse=True
    )

    for member in sorted_members:
        totals = member["totals"]
        lines.append(
            f"| {member['name']} | {totals['authored']} | {totals['contributed']} | {totals['comments']} |"
        )

    lines.append("\n## Detailed Breakdown\n")

    for member in sorted_members:
        total = member["totals"]["authored"] + member["totals"]["contributed"] + member["totals"]["comments"]
        if total == 0:
            continue

        lines.append(f"### {member['name']}\n")

        if member["rfcs_authored"]:
            lines.append("**RFCs Authored:**")
            for rfc in member["rfcs_authored"]:
                status = rfc.get("status", "Unknown")
                lines.append(f"- [{rfc['title']}]({rfc['url']}) ({status})")
            lines.append("")

        if member["rfcs_contributed"]:
            lines.append("**RFCs Contributed To:**")
            for rfc in member["rfcs_contributed"]:
                status = rfc.get("status", "Unknown")
                lines.append(f"- [{rfc['title']}]({rfc['url']}) ({status})")
            lines.append("")

        if member["rfc_comments"]:
            lines.append(f"**Comments:** {len(member['rfc_comments'])} comments across RFCs")
            # Group by RFC
            by_rfc = defaultdict(list)
            for comment in member["rfc_comments"]:
                by_rfc[comment["rfc_title"]].append(comment)
            for rfc_title, comments in by_rfc.items():
                lines.append(f"- {rfc_title}: {len(comments)} comment(s)")
            lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze RFC engagement on Notion for team members"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output directory for results",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Only print summary, don't save detailed JSON",
    )

    args = parser.parse_args()

    # Load config
    config = load_config()

    # Get Notion token
    token = get_credential("notion-api-token")
    if not token:
        print("Error: Notion API token not found in Keychain")
        print("Run 'npm run setup' in the apolitical-assistant directory")
        sys.exit(1)

    # Create Notion client
    notion = NotionClient(token)

    # Create analyzer
    analyzer = RFCAnalyzer(notion, config["team_members"])

    # Run analysis
    print("\nAnalyzing RFC engagement...\n")
    results = analyzer.analyze_rfcs()

    # Generate summary
    summary = generate_summary(results)
    print("\n" + "=" * 60)
    print(summary)

    # Save results
    if not args.summary_only:
        output_dir = Path(args.output) if args.output else NOTION_DATA_DIR
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save detailed JSON
        json_file = output_dir / "rfc_engagement.json"
        with open(json_file, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\nDetailed results saved to: {json_file}")

        # Save summary markdown
        summary_file = output_dir / "rfc_engagement_summary.md"
        with open(summary_file, "w") as f:
            f.write(summary)
        print(f"Summary saved to: {summary_file}")


if __name__ == "__main__":
    main()
