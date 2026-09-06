---
description: The snyk ignore create command that creates a Snyk Code ignore
hidden: true
noIndex: true
---

# Ignore create

## Usage and description

`snyk ignore create --finding-id=<FINDING_ID> --ignore-type=<not-vulnerable|wont-fix|temporary-ignore> --reason=<REASON> --expiration=<YYYY-MM-DD|never> [--org=<ORG_ID>] [--remote-repo-url=<URL>] [OPTIONS]`

The `snyk ignore create` command creates an ignore for a Snyk Code finding using Consistent Ignores for Snyk Code. Snyk stores the ignore on the finding and applies it consistently across the CLI, IDE, and other integrations on the next test.

**Note:** This command applies only to Snyk Code. To ignore Snyk Open Source or Snyk IaC issues, use the [`snyk ignore`](ignore.md) command without the `create` subcommand.

Creating ignores from the command line is an Early Access feature of the Ignore Approval Workflow. It applies to `snyk code test` runs from the CLI and IDE. It does not apply to SCM (stateful) tests run through the Import API, and it does not support CLI Upload projects.

## Prerequisites

Complete the following before you create an ignore:

- Install Snyk CLI v1.1297.1 or later. Visit [Install or update the Snyk CLI](https://docs.snyk.io/developer-tools/snyk-cli/install-the-snyk-cli).
- Enable Consistent Ignores for Snyk Code for your Group or Organization. Visit [Consistent Ignores for Snyk Code](https://docs.snyk.io/scan-fix-and-prevent/fix/prioritize-issues-for-fixing/ignore-issues/consistent-ignores-for-snyk-code).
- Set the Organization that holds the ignores. Visit [How to select the Organization to use in the CLI](https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli/how-to-select-the-organization-to-use-in-the-cli).
- Commit and push your code to the remote repository so that reviewers can locate the finding.

This command identifies a finding by its finding identifier. To obtain it, run `snyk code test --json` and locate `runs.results[n].fingerprints.snyk/assets/finding/v1` in the output. Visit [Consistent Ignores for Snyk Code CLI](https://docs.snyk.io/scan-fix-and-prevent/fix/prioritize-issues-for-fixing/ignore-issues/consistent-ignores-for-snyk-code/snyk-cli#access-the-finding-identifier-in-json-and-sarif-output).

## Interactive and non-interactive modes

By default, `snyk ignore create` runs interactively and prompts for each value. Run the command without options to use interactive mode.

To run non-interactively, for example in a script or CI/CD pipeline, provide all required options.

## Options

### `--finding-id=<FINDING_ID>`

Finding to ignore. Required.

Obtain the finding identifier from the JSON output of `snyk code test --json`.

### `--ignore-type=<not-vulnerable|wont-fix|temporary-ignore>`

Reason category for the ignore. Required.

### `--reason=<REASON>`

Human-readable justification for the ignore. Required and must not be empty.

### `--expiration=<YYYY-MM-DD|never>`

Expiration date in `YYYY-MM-DD` format, or `never`. Required in non-interactive mode.

### `--org=<ORG_ID>`

Organization that holds the ignore. The value must be a valid Organization ID.

Default: the Organization set in your CLI configuration

### `--remote-repo-url=<URL>`

Repository URL for the finding. Snyk detects this automatically when a .git directory is present. Specify it explicitly when the repository has a different Git URL. To verify the URL, run `git remote -v`.

## Examples for the `snyk ignore create` command

### Create an ignore interactively

```
$ snyk ignore create
```

### Create an ignore non-interactively

```
$ snyk ignore create \
  --finding-id=<FINDING_ID> \
  --ignore-type=wont-fix \
  --reason="Not exploitable in this context" \
  --expiration=2026-12-31 \
  --org=<ORG_ID>
```
