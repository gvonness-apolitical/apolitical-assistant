#!/bin/bash
#
# Install launchd plist files for scheduled tasks
#
# Usage:
#   ./scripts/setup/install-launchd.sh          # Install all
#   ./scripts/setup/install-launchd.sh install  # Install all
#   ./scripts/setup/install-launchd.sh uninstall # Uninstall all
#   ./scripts/setup/install-launchd.sh status   # Check status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAUNCHD_DIR="$PROJECT_ROOT/launchd"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$PROJECT_ROOT/logs/launchd"

# Plist files to manage
PLISTS=(
    "com.apolitical.assistant.backfill"
    "com.apolitical.assistant.morning-briefing"
    "com.apolitical.assistant.eod-summary"
    "com.apolitical.assistant.weekly-summary"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print status message
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create log directory
create_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        info "Creating log directory: $LOG_DIR"
        mkdir -p "$LOG_DIR"
    fi
}

# Create plist directory
create_plist_dir() {
    if [ ! -d "$PLIST_DIR" ]; then
        info "Creating LaunchAgents directory: $PLIST_DIR"
        mkdir -p "$PLIST_DIR"
    fi
}

# Install a single plist
install_plist() {
    local plist_name="$1"
    local src="$LAUNCHD_DIR/${plist_name}.plist"
    local dst="$PLIST_DIR/${plist_name}.plist"

    if [ ! -f "$src" ]; then
        error "Source plist not found: $src"
        return 1
    fi

    # Unload if already loaded
    if launchctl list | grep -q "$plist_name"; then
        info "Unloading existing $plist_name..."
        launchctl unload "$dst" 2>/dev/null || true
    fi

    # Copy and substitute paths
    info "Installing $plist_name..."
    sed "s|APOLITICAL_ASSISTANT_PATH|$PROJECT_ROOT|g" "$src" > "$dst"

    # Load the plist
    info "Loading $plist_name..."
    launchctl load "$dst"

    info "$plist_name installed successfully"
}

# Uninstall a single plist
uninstall_plist() {
    local plist_name="$1"
    local dst="$PLIST_DIR/${plist_name}.plist"

    if [ -f "$dst" ]; then
        # Unload if loaded
        if launchctl list | grep -q "$plist_name"; then
            info "Unloading $plist_name..."
            launchctl unload "$dst" 2>/dev/null || true
        fi

        info "Removing $plist_name..."
        rm "$dst"
        info "$plist_name uninstalled successfully"
    else
        warn "$plist_name is not installed"
    fi
}

# Check status of a single plist
check_status() {
    local plist_name="$1"
    local dst="$PLIST_DIR/${plist_name}.plist"

    if [ -f "$dst" ]; then
        if launchctl list | grep -q "$plist_name"; then
            echo -e "  ${GREEN}[ACTIVE]${NC} $plist_name"
        else
            echo -e "  ${YELLOW}[INSTALLED]${NC} $plist_name (not loaded)"
        fi
    else
        echo -e "  ${RED}[NOT INSTALLED]${NC} $plist_name"
    fi
}

# Install all plists
install_all() {
    info "Installing launchd tasks..."
    create_log_dir
    create_plist_dir

    local success=0
    local failed=0

    for plist in "${PLISTS[@]}"; do
        if install_plist "$plist"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    echo ""
    info "Installation complete: $success succeeded, $failed failed"
    echo ""
    info "View status with: launchctl list | grep apolitical"
    info "View logs in: $LOG_DIR"
}

# Uninstall all plists
uninstall_all() {
    info "Uninstalling launchd tasks..."

    for plist in "${PLISTS[@]}"; do
        uninstall_plist "$plist"
    done

    info "Uninstallation complete"
}

# Show status of all plists
show_status() {
    echo "Scheduled Tasks Status:"
    echo ""

    for plist in "${PLISTS[@]}"; do
        check_status "$plist"
    done

    echo ""
    echo "Schedule:"
    echo "  - backfill: Daily at midnight (00:00)"
    echo "  - morning-briefing: Daily at 7:30 AM"
    echo "  - eod-summary: Daily at 5:30 PM"
    echo "  - weekly-summary: Mondays at 8:00 AM"
}

# Main
case "${1:-install}" in
    install)
        install_all
        ;;
    uninstall)
        uninstall_all
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 [install|uninstall|status]"
        exit 1
        ;;
esac
