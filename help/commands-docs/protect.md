# snyk-protect(1) -- Applies the patches specified in your .snyk file to the local file system

## SYNOPSIS

`snyk` `protect` \[<OPTIONS>\]

## DESCRIPTION

`$ snyk protect` is used to apply patches to your vulnerable dependencies. It's useful after opening a fix pull request from our website (GitHub only) or after running snyk wizard on the CLI. snyk protect reads a .snyk policy file to determine what patches to apply.

## OPTIONS

- `--dry-run`:
  Don't apply updates or patches when running.
