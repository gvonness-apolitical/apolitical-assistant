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

# Get the directory where this script lives, then find repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Unlock git-crypt files if locked (prevents corruption when writing to encrypted files)
if command -v git-crypt &> /dev/null; then
    (
        cd "$REPO_ROOT"
        # Check if any files are still encrypted (locked)
        if git-crypt status -e 2>/dev/null | grep -q "encrypted:"; then
            echo "Unlocking git-crypt files..."
            unlock_output=$(git-crypt unlock 2>&1) && exit 0

            # If unlock failed due to dirty working directory, stash and retry
            if echo "$unlock_output" | grep -q "Working directory not clean"; then
                echo "Working directory not clean, stashing changes..."
                git stash
                if git-crypt unlock 2>/dev/null; then
                    echo "Restoring stashed changes..."
                    git stash pop
                else
                    echo "Warning: git-crypt unlock failed (may need GPG key)"
                    git stash pop
                fi
            else
                echo "Warning: git-crypt unlock failed: $unlock_output"
            fi
        fi
    )
fi

# Launch Claude Code with all arguments passed through
exec claude "$@"
