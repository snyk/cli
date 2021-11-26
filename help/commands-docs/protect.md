# snyk protect -- Applies the patches specified in your .snyk file to the local file system

## Usage

`snyk protect [<OPTIONS>]`

## Description

`$ snyk protect` is used to apply patches to your vulnerable dependencies. It's useful after opening a fix pull request from our website (GitHub only) or after running snyk wizard on the CLI. snyk protect reads a .snyk policy file to determine what patches to apply.

## Deprecation notice

This command is deprecated and was replaced by a faster, smaller and more secure package `@snyk/protect`.

See the official guide for the usage: https://github.com/snyk/snyk/tree/master/packages/snyk-protect

## Options

### `--dry-run`

Don't apply updates or patches when running.
