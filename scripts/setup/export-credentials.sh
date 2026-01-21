#!/bin/bash
# Export credentials from macOS Keychain to environment variables
# Usage: source scripts/setup/export-credentials.sh

SERVICE_PREFIX="apolitical-assistant-"

get_credential() {
    local key="$1"
    security find-generic-password -s "${SERVICE_PREFIX}${key}" -w 2>/dev/null
}

# Google OAuth
export GOOGLE_CLIENT_ID=$(get_credential "google-oauth-client-id")
export GOOGLE_CLIENT_SECRET=$(get_credential "google-oauth-client-secret")
export GOOGLE_REFRESH_TOKEN=$(get_credential "google-refresh-token")

# Slack
export SLACK_TOKEN=$(get_credential "slack-token")

# GitHub
export GITHUB_PERSONAL_ACCESS_TOKEN=$(get_credential "github-token")

# Linear
export LINEAR_API_KEY=$(get_credential "linear-api-key")

# Humaans
export HUMAANS_API_TOKEN=$(get_credential "humaans-api-token")

# Incident.io
export INCIDENTIO_API_KEY=$(get_credential "incidentio-api-key")

echo "✓ Credentials exported from Keychain"
