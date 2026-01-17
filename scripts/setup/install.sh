#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Apolitical Assistant Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo "Please install $1 and try again."
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} $1"
}

check_command "node"
check_command "npm"
check_command "git"

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js version 20 or higher is required.${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check for optional dependencies
echo ""
echo -e "${YELLOW}Checking optional dependencies...${NC}"

if command -v git-crypt &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} git-crypt"
else
    echo -e "  ${YELLOW}!${NC} git-crypt not found (optional - install with: brew install git-crypt)"
fi

if command -v claude &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Claude CLI"
else
    echo -e "  ${YELLOW}!${NC} Claude CLI not found (required for assistant features)"
fi

# Initialize git repository if not already
echo ""
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    echo -e "  ${GREEN}✓${NC} Git repository initialized"
else
    echo -e "${GREEN}Git repository already initialized${NC}"
fi

# Install npm dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "  ${GREEN}✓${NC} Dependencies installed"

# Build the project
echo ""
echo -e "${YELLOW}Building packages...${NC}"
npm run build

echo -e "  ${GREEN}✓${NC} Packages built"

# Create required directories
echo ""
echo -e "${YELLOW}Creating directory structure...${NC}"

mkdir -p context/meeting-notes
mkdir -p output/briefings
mkdir -p logs

echo -e "  ${GREEN}✓${NC} Directories created"

# Create initial preferences file
if [ ! -f "context/preferences.json" ]; then
    echo '{
  "userEmail": "",
  "userName": "",
  "timezone": "Europe/London",
  "workingHours": {
    "start": "09:00",
    "end": "18:00"
  },
  "briefingTime": "08:00",
  "eodSummaryTime": "17:00",
  "slackChannels": [],
  "githubRepos": [],
  "linearTeams": []
}' > context/preferences.json
    echo -e "  ${GREEN}✓${NC} Default preferences created"
fi

# Setup git-crypt if available
echo ""
if command -v git-crypt &> /dev/null; then
    if [ ! -f ".git/git-crypt/keys/default" ]; then
        echo -e "${YELLOW}Setting up git-crypt encryption...${NC}"
        bash "$SCRIPT_DIR/setup-git-crypt.sh"
    else
        echo -e "${GREEN}git-crypt already initialized${NC}"
    fi
else
    echo -e "${YELLOW}Skipping git-crypt setup (not installed)${NC}"
fi

# Run credential setup
echo ""
echo -e "${YELLOW}Setting up credentials...${NC}"
echo -e "You can run the credential setup wizard now or later."
echo ""
read -p "Run credential setup wizard now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx tsx scripts/setup/setup-keychain.ts
fi

# Final instructions
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Configure credentials: ${BLUE}npm run setup${NC}"
echo -e "  2. Install launchd agents: ${BLUE}bash scripts/setup/install-launchd.sh${NC}"
echo -e "  3. Test with Claude: ${BLUE}claude mcp list${NC}"
echo ""
echo -e "Useful commands:"
echo -e "  ${BLUE}npm run morning-briefing${NC}  - Generate morning briefing"
echo -e "  ${BLUE}npm run email-cleanup${NC}     - Run email cleanup workflow"
echo -e "  ${BLUE}npm run eod-summary${NC}       - Generate end-of-day summary"
echo ""
