#!/usr/bin/env bash

set -euo pipefail

# Strip YAML front matter from markdown files
# Front matter must be at the very start of the file, delimited by --- lines

strip_frontmatter() {
  local file="$1"
  
  # Check if file starts with ---
  if ! head -n 1 "$file" | grep -qx -- '---'; then
    # No front matter, nothing to strip
    return 0
  fi
  
  # Read file and strip front matter
  # Strategy: skip lines from first --- to second ---, then output the rest
  awk '
    BEGIN { in_frontmatter = 0; frontmatter_ended = 0; }
    
    # First line: if it is ---, we are entering front matter
    NR == 1 && /^---$/ {
      in_frontmatter = 1;
      next;
    }
    
    # If we are in front matter and hit another ---, front matter has ended
    in_frontmatter && /^---$/ {
      in_frontmatter = 0;
      frontmatter_ended = 1;
      next;
    }
    
    # Skip lines while in front matter
    in_frontmatter {
      next;
    }
    
    # Output everything else (content after front matter, or entire file if no front matter)
    {
      print;
    }
  ' "$file" > "$file.tmp"
  
  mv "$file.tmp" "$file"
}

# Process all markdown files passed as arguments
for file in "$@"; do
  if [[ -f "$file" ]]; then
    strip_frontmatter "$file"
  fi
done
