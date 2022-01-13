# snyk wizard -- configure your `.snyk` policy file to update, auto patch, and ignore vulnerabilities

## Usage

`snyk wizard [<OPTIONS>]`

## Description

The `snyk wizard` command does the following:

- Enumerates your local dependencies and queries the Snyk servers for vulnerabilities
- Guides you through fixing found vulnerabilities
- Creates a `.snyk` policy file to guide commands such as `snyk test`
- Remembers your dependencies to alert you when new vulnerabilities are disclosed

For more information see [Manage vulnerability results with the Snyk CLI wizard](https://docs.snyk.io/features/snyk-cli/fix-vulnerabilities-from-the-cli/manage-vulnerability-results-with-the-snyk-cli-wizard).

## Debug

Use the `-d` option to output the debug logs.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found<br />
**1**: action_needed, vulnerabilities found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).
