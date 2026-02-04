#!/bin/bash
# ci-check-encrypted.sh - CI validation for git-crypt encrypted files
#
# This script verifies that files in encrypted directories have proper GITCRYPT
# headers when checked out in CI (where git-crypt is not unlocked).
#
# Usage:
#   ./scripts/ci-check-encrypted.sh
#
# In CI, encrypted files should appear as binary blobs starting with "GITCRYPT".
# If they appear as plain text, it means they were committed unencrypted.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENCRYPTED_PATHS=("context/" "briefings/" "work/" "reviews/" "investigations/" "rubberduck/" "meetings/" "121/")
ERRORS=0
CHECKED=0

echo "Checking encrypted file headers..."
echo ""

for path in "${ENCRYPTED_PATHS[@]}"; do
    if [ ! -d "$path" ]; then
        continue
    fi

    # Find all files (not directories) in the encrypted path
    while IFS= read -r -d '' file; do
        CHECKED=$((CHECKED + 1))

        # Check if file starts with GITCRYPT header (0x00 GITCRYPT 0x00)
        # The header is: \x00GITCRYPT\x00
        header=$(head -c 10 "$file" 2>/dev/null | cat -v || echo "")

        file_size=$(wc -c < "$file" 2>/dev/null | tr -d '[:space:]')

        if [[ "$header" == *"GITCRYPT"* ]] || [[ "$header" == "^@GITCRYPT"* ]]; then
            # File has correct header — verify it's at least 10 bytes (header size)
            if [ "$file_size" -lt 10 ]; then
                echo -e "${RED}ERROR: Encrypted file too small ($file_size bytes): $file${NC}"
                echo "  Encrypted files must be at least 10 bytes (GITCRYPT header)."
                ERRORS=$((ERRORS + 1))
            fi
        elif [[ -z "$header" ]]; then
            # Empty file - this is fine
            :
        else
            # File appears to be plaintext - this is bad in CI!
            echo -e "${RED}ERROR: File appears unencrypted: $file${NC}"
            echo "  Header: $header"
            ERRORS=$((ERRORS + 1))
        fi
    done < <(find "$path" -type f -print0 2>/dev/null)
done

echo ""
echo "Checked $CHECKED files in encrypted directories"

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo -e "${RED}FAILED: $ERRORS file(s) appear to be committed unencrypted!${NC}"
    echo ""
    echo "This usually means files were committed when git-crypt was not properly"
    echo "configured. To fix:"
    echo "  1. Ensure git-crypt is unlocked locally: git-crypt unlock"
    echo "  2. Re-add the affected files: git add <files>"
    echo "  3. Commit with proper encryption"
    echo ""
    exit 1
fi

echo -e "${GREEN}All encrypted files have proper GITCRYPT headers${NC}"
exit 0
