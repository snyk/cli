#!/usr/bin/env bash

set -euo pipefail

# Test script for strip-yaml-frontmatter.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRIP_SCRIPT="$SCRIPT_DIR/strip-yaml-frontmatter.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

test_case() {
  local test_name="$1"
  local input="$2"
  local expected="$3"
  
  local tmpfile=$(mktemp)
  echo -n "$input" > "$tmpfile"
  
  "$STRIP_SCRIPT" "$tmpfile"
  
  local actual=$(cat "$tmpfile")
  rm "$tmpfile"
  
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name"
    echo "  Expected:"
    echo "$expected" | sed 's/^/    /'
    echo "  Got:"
    echo "$actual" | sed 's/^/    /'
    ((TESTS_FAILED++))
  fi
}

# Test 1: File with front matter
test_case "Strip basic front matter" \
"---
description: Test description
---

# Header

Content" \
"
# Header

Content"

# Test 2: File with multi-field front matter
test_case "Strip multi-field front matter" \
"---
description: Test description
last_reviewed: 2026-05-15
last_reviewed_source: bulk-sync
---

# Header

Content" \
"
# Header

Content"

# Test 3: File without front matter
test_case "Leave file without front matter unchanged" \
"# Header

Content" \
"# Header

Content"

# Test 4: File with --- in content (not at start)
test_case "Leave --- in content unchanged" \
"# Header

Some content
---
More content" \
"# Header

Some content
---
More content"

# Test 5: File with only front matter (edge case)
test_case "Handle file with only front matter" \
"---
description: Test
---" \
""

# Test 6: Empty file
test_case "Handle empty file" \
"" \
""

# Summary
echo ""
echo "=============================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo "=============================="

if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi
