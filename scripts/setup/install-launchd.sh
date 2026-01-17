#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LAUNCHD_DIR="$PROJECT_ROOT/launchd"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Installing launchd Agents${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

# Function to install a plist
install_plist() {
    local plist_name="$1"
    local source="$LAUNCHD_DIR/$plist_name"
    local dest="$LAUNCH_AGENTS_DIR/$plist_name"

    echo -e "${YELLOW}Installing $plist_name...${NC}"

    # Unload existing agent if present
    if launchctl list | grep -q "${plist_name%.plist}"; then
        echo "  Unloading existing agent..."
        launchctl unload "$dest" 2>/dev/null || true
    fi

    # Copy and modify the plist with actual paths
    sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$source" > "$dest"

    # Load the agent
    launchctl load "$dest"

    echo -e "  ${GREEN}✓${NC} Installed and loaded"
}

# Function to uninstall a plist
uninstall_plist() {
    local plist_name="$1"
    local dest="$LAUNCH_AGENTS_DIR/$plist_name"

    echo -e "${YELLOW}Uninstalling $plist_name...${NC}"

    if [ -f "$dest" ]; then
        launchctl unload "$dest" 2>/dev/null || true
        rm "$dest"
        echo -e "  ${GREEN}✓${NC} Uninstalled"
    else
        echo -e "  ${YELLOW}!${NC} Not installed"
    fi
}

# Handle command line arguments
case "${1:-install}" in
    install)
        install_plist "com.apolitical.morning-briefing.plist"
        install_plist "com.apolitical.eod-summary.plist"
        # Note: email-cleanup is interactive, so we don't schedule it by default
        echo ""
        echo -e "${YELLOW}Note: Email cleanup is interactive and not scheduled.${NC}"
        echo -e "Run it manually with: ${BLUE}npm run email-cleanup${NC}"
        ;;

    uninstall)
        uninstall_plist "com.apolitical.morning-briefing.plist"
        uninstall_plist "com.apolitical.email-cleanup.plist"
        uninstall_plist "com.apolitical.eod-summary.plist"
        ;;

    status)
        echo "Checking agent status..."
        echo ""
        for plist in com.apolitical.morning-briefing com.apolitical.eod-summary; do
            if launchctl list | grep -q "$plist"; then
                echo -e "  ${GREEN}✓${NC} $plist is loaded"
            else
                echo -e "  ${RED}✗${NC} $plist is not loaded"
            fi
        done
        ;;

    *)
        echo "Usage: $0 [install|uninstall|status]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Done!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Schedule:"
echo "  - Morning Briefing: 8:00 AM (Mon-Sun)"
echo "  - EOD Summary: 5:00 PM (Mon-Sun)"
echo ""
echo "To check status: $0 status"
echo "To uninstall: $0 uninstall"
echo ""
echo "Logs are written to: $PROJECT_ROOT/logs/"
echo ""
