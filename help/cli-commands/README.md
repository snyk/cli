# CLI help

Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.

For more information visit the [Snyk website](https://snyk.io)

For details see the [CLI documentation](https://docs.snyk.io/features/snyk-cli)

## How to get started

1. Authenticate by running `snyk auth`
2. Test your local project with `snyk test`
3. Get alerted for new vulnerabilities with `snyk monitor`

## Available commands

To learn more about each Snyk CLI command, use the `--help` option, for example, `snyk auth --help` or `snyk container --help`

**Note:** The help on the docs site is the same as the `--help` in the CLI.

### [`snyk auth`](auth.md)

Authenticate Snyk CLI with a Snyk account.

### [`snyk test`](test.md)

Test a project for open source vulnerabilities and license issues.

**Note**: Use `snyk test --unmanaged` to scan all files for known open source dependencies (C/C++ only).

### [`snyk monitor`](monitor.md)

Snapshot and continuously monitor a project for open source vulnerabilities and license issues.

### [`snyk container`](container.md)

Test container images for vulnerabilities.

### [`snyk iac`](iac.md)

Commands to find and manage security issues in Infrastructure as Code files.

### [`snyk code`](code.md)

Find security issues using static code analysis.

### [`snyk log4shell`](log4shell.md)

Find Log4Shell vulnerability.

### [`snyk config`](config.md)

Manage Snyk CLI configuration.

### [`snyk policy`](policy.md)

Display the `.snyk` policy for a package.

### [`snyk ignore`](ignore.md)

Modify the `.snyk` policy to ignore stated issues.

## Debug

Use `-d` option to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)
