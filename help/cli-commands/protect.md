# snyk protect -- apply the patches specified in your `.snyk` file to the local file system

## Usage

`snyk protect [<OPTIONS>]`

## Description

The `snyk protect` command applies patches to your vulnerable dependencies. This is useful after you open a fix pull request from the Snyk website (GitHub only) or after you run `snyk wizard` with the CLI. `snyk protect` reads a `.snyk` policy file to determine what patches to apply.

## Deprecation notice

The `snyk protect` command is deprecated and has been replaced by a faster, smaller, and more secure package `@snyk/protect`. Refer to the information on usage in the repository: https://github.com/snyk/snyk/tree/master/packages/snyk-protect

## Option: `--dry-run`

Do not apply updates or patches when running.

## Debug

Use `-d` option to output the debug logs.
