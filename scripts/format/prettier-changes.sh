#!/usr/bin/env bash
set -euo pipefail

FILES=$(
    { 
        git diff --name-only --diff-filter=ACMR          '*.js' '*.ts' '*.json' '*.yaml' '*.yml' '*.md'
        git diff --name-only --diff-filter=ACMR --staged '*.js' '*.ts' '*.json' '*.yaml' '*.yml' '*.md'
    } \
    | sort \
    | uniq
)
[ -z "$FILES" ] && exit 0

echo Changed Files:
echo "$FILES"

echo
echo Prettify Files:
echo "$FILES" | xargs ./node_modules/.bin/prettier --write

# Add back the modified/prettified files to staging
# echo
# echo "$FILES" | xargs git add

echo
echo "Done."
