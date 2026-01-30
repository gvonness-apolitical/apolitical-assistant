#!/bin/bash
# git-crypt-check.sh - Verify git-crypt is properly configured and unlocked
#
# Usage:
#   ./scripts/git-crypt-check.sh        # Check status
#   ./scripts/git-crypt-check.sh --fix  # Attempt to fix issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENCRYPTED_PATHS=("context/" "briefings/" "work/" "reviews/" "investigations/" "rubberduck/" "meetings/" "121/")

check_git_crypt_installed() {
    if ! command -v git-crypt &> /dev/null; then
        echo -e "${RED}ERROR: git-crypt is not installed${NC}"
        echo "Install with: brew install git-crypt"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} git-crypt installed"
}

check_key_exists() {
    if [ ! -d ".git/git-crypt/keys" ]; then
        echo -e "${RED}ERROR: git-crypt keys not found${NC}"
        echo "Run: git-crypt unlock"
        return 1
    fi
    echo -e "${GREEN}✓${NC} git-crypt keys present"
}

check_unlocked() {
    # Check if a known encrypted file is readable as text
    local test_file=""
    for path in "${ENCRYPTED_PATHS[@]}"; do
        test_file=$(find "$path" -name "*.md" -type f 2>/dev/null | head -1)
        if [ -n "$test_file" ]; then
            break
        fi
    done

    if [ -z "$test_file" ]; then
        echo -e "${YELLOW}⚠${NC}  No encrypted files found to test"
        return 0
    fi

    # Check if file starts with GITCRYPT (encrypted) or readable text
    if head -c 10 "$test_file" 2>/dev/null | grep -q "GITCRYPT"; then
        echo -e "${RED}ERROR: Repository is LOCKED${NC}"
        echo "File $test_file is still encrypted"
        echo "Run: git-crypt unlock"
        return 1
    fi

    echo -e "${GREEN}✓${NC} Repository is unlocked (files are decrypted)"
}

check_filter_configured() {
    local smudge=$(git config --get filter.git-crypt.smudge 2>/dev/null || echo "")
    local clean=$(git config --get filter.git-crypt.clean 2>/dev/null || echo "")

    if [ -z "$smudge" ] || [ -z "$clean" ]; then
        echo -e "${RED}ERROR: git-crypt filters not configured${NC}"
        echo "This can happen after bypassing filters"
        echo "Run: git-crypt unlock (will reconfigure filters)"
        return 1
    fi

    if [[ "$smudge" == "cat" ]] || [[ "$clean" == "cat" ]]; then
        echo -e "${RED}ERROR: git-crypt filters are bypassed!${NC}"
        echo "Filters are set to 'cat' which bypasses encryption"
        echo "Run: git-crypt unlock (will fix filters)"
        return 1
    fi

    echo -e "${GREEN}✓${NC} git-crypt filters configured correctly"
}

check_working_tree_clean() {
    # Check for modified files in encrypted paths that might cause issues
    local dirty_encrypted=""
    for path in "${ENCRYPTED_PATHS[@]}"; do
        dirty=$(git status --porcelain "$path" 2>/dev/null | grep -v "^??" || true)
        if [ -n "$dirty" ]; then
            dirty_encrypted="${dirty_encrypted}${dirty}\n"
        fi
    done

    if [ -n "$dirty_encrypted" ]; then
        echo -e "${YELLOW}⚠${NC}  Modified files in encrypted paths:"
        echo -e "$dirty_encrypted"
        return 0
    fi

    echo -e "${GREEN}✓${NC} No modified encrypted files"
}

fix_issues() {
    echo "Attempting to fix git-crypt issues..."
    echo ""

    # Re-unlock to fix filters
    if git-crypt unlock 2>/dev/null; then
        echo -e "${GREEN}✓${NC} git-crypt unlock successful"
    else
        echo -e "${RED}✗${NC} git-crypt unlock failed"
        echo "You may need to:"
        echo "  1. Ensure you have the GPG key that was used to encrypt"
        echo "  2. Or obtain the symmetric key file"
        exit 1
    fi
}

main() {
    echo "git-crypt Status Check"
    echo "======================"
    echo ""

    check_git_crypt_installed
    check_key_exists || exit 1
    check_filter_configured || {
        if [ "$1" == "--fix" ]; then
            fix_issues
        else
            echo ""
            echo "Run with --fix to attempt repair"
            exit 1
        fi
    }
    check_unlocked || {
        if [ "$1" == "--fix" ]; then
            fix_issues
        else
            echo ""
            echo "Run with --fix to attempt repair"
            exit 1
        fi
    }
    check_working_tree_clean

    echo ""
    echo -e "${GREEN}All checks passed!${NC}"
}

main "$@"
