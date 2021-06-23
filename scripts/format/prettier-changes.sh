#!/usr/bin/env bash
FILES=$({ git diff --name-only --diff-filter=ACMR "*.js" "*.ts"; git diff --name-only --staged --diff-filter=ACMR "*.js" "*.ts"; } | sort | uniq)
[ -z "$FILES" ] && exit 0

echo Changed files:
echo "$FILES"

echo Prettify files:
# Prettify all selected files
echo "$FILES" | xargs ./node_modules/.bin/prettier --write

# Add back the modified/prettified files to staging
# echo "$FILES" | xargs git add

exit 0
