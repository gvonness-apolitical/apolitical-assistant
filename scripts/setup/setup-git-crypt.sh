#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}Setting up git-crypt...${NC}"

# Check if git-crypt is installed
if ! command -v git-crypt &> /dev/null; then
    echo -e "${RED}Error: git-crypt is not installed.${NC}"
    echo "Install with: brew install git-crypt"
    exit 1
fi

# Initialize git-crypt if not already
if [ ! -d ".git/git-crypt" ]; then
    git-crypt init
    echo -e "${GREEN}✓${NC} git-crypt initialized"
else
    echo -e "${GREEN}git-crypt already initialized${NC}"
fi

# Create backup of the key
BACKUP_DIR="$HOME/.apolitical-assistant-backup"
mkdir -p "$BACKUP_DIR"
KEY_BACKUP="$BACKUP_DIR/git-crypt-key-$(date +%Y%m%d%H%M%S)"

git-crypt export-key "$KEY_BACKUP"
chmod 600 "$KEY_BACKUP"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  git-crypt Setup Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: Your encryption key has been backed up to:${NC}"
echo -e "  ${KEY_BACKUP}"
echo ""
echo -e "Store this key securely! Without it, you cannot decrypt the context/ directory."
echo ""
echo -e "Files in the following directories will be encrypted:"
echo -e "  - context/"
echo ""
echo -e "To add another user's GPG key to access encrypted files:"
echo -e "  git-crypt add-gpg-user USER_ID"
echo ""
