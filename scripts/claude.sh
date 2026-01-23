#!/bin/bash
#
# Wrapper script for Claude Code that loads credentials from macOS Keychain
#
# Usage: ./scripts/claude.sh [claude args...]
#

set -e

# Load credentials from Keychain
export GOOGLE_CLIENT_ID=$(security find-generic-password -a "claude" -s "GOOGLE_CLIENT_ID" -w 2>/dev/null || echo "")
export GOOGLE_CLIENT_SECRET=$(security find-generic-password -a "claude" -s "GOOGLE_CLIENT_SECRET" -w 2>/dev/null || echo "")
export GOOGLE_REFRESH_TOKEN=$(security find-generic-password -a "claude" -s "GOOGLE_REFRESH_TOKEN" -w 2>/dev/null || echo "")
export SLACK_TOKEN=$(security find-generic-password -a "claude" -s "SLACK_TOKEN" -w 2>/dev/null || echo "")
export INCIDENTIO_API_KEY=$(security find-generic-password -a "claude" -s "INCIDENTIO_API_KEY" -w 2>/dev/null || echo "")
export HUMAANS_API_TOKEN=$(security find-generic-password -a "claude" -s "HUMAANS_API_TOKEN" -w 2>/dev/null || echo "")
export GITHUB_PERSONAL_ACCESS_TOKEN=$(security find-generic-password -a "claude" -s "GITHUB_PERSONAL_ACCESS_TOKEN" -w 2>/dev/null || echo "")
export LINEAR_API_KEY=$(security find-generic-password -a "claude" -s "LINEAR_API_KEY" -w 2>/dev/null || echo "")

# Check for missing credentials
missing=()
[ -z "$GOOGLE_CLIENT_ID" ] && missing+=("GOOGLE_CLIENT_ID")
[ -z "$GOOGLE_CLIENT_SECRET" ] && missing+=("GOOGLE_CLIENT_SECRET")
[ -z "$GOOGLE_REFRESH_TOKEN" ] && missing+=("GOOGLE_REFRESH_TOKEN")
[ -z "$SLACK_TOKEN" ] && missing+=("SLACK_TOKEN")
[ -z "$INCIDENTIO_API_KEY" ] && missing+=("INCIDENTIO_API_KEY")
[ -z "$HUMAANS_API_TOKEN" ] && missing+=("HUMAANS_API_TOKEN")
[ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && missing+=("GITHUB_PERSONAL_ACCESS_TOKEN")
[ -z "$LINEAR_API_KEY" ] && missing+=("LINEAR_API_KEY")

if [ ${#missing[@]} -gt 0 ]; then
    echo "Warning: Missing credentials in Keychain:"
    for cred in "${missing[@]}"; do
        echo "  - $cred"
    done
    echo ""
    echo "Run 'npm run credentials -- --setup' to configure."
    echo ""
fi

# Launch Claude Code with all arguments passed through
exec claude "$@"
