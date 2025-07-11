# CLI help

Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.

For more information, visit the [Snyk website](https://snyk.io)

For details, see the [CLI documentation](https://docs.snyk.io/snyk-cli)

## How to get started

1. Authenticate by running `snyk auth`.
2. Test your local project with `snyk test`.
3. Get alerted for new vulnerabilities with `snyk monitor`.

## Available commands

To learn more about each Snyk CLI command, use the `--help` option, for example, `snyk auth --help`.

**Note:** The help on the docs site is the same as the `--help` in the CLI.

### [`snyk auth`](auth.md)

Authenticate Snyk CLI with a Snyk account.

### [`snyk test`](test.md)

Test a project for open-source vulnerabilities and license issues.

**Note**: Use `snyk test --unmanaged` to scan all files for known open-source dependencies (C/C++ only).

### [`snyk monitor`](monitor.md)

Snapshot and continuously monitor a project for open-source vulnerabilities and license issues.

### [`snyk container`](container.md)

These commands test and continuously monitor container images for vulnerabilities and generate an SBOM for a container image.

### [`snyk iac`](iac.md)

These commands find and report security issues in Infrastructure as Code files; detect, track, and alert on unmanaged resources; and create a .driftignore file.

### [`snyk code`](code.md)

The `snyk code test` command finds security issues using Static Code Analysis.

### [`snyk sbom`](sbom.md)

Generate or test an SBOM document in ecosystems supported by Snyk.

### [`snyk aibom`](aibom.md)

Generates an AIBOM for a local software project that is written in Python, to understand what AI models, datasets, tools, and so on are used in that project.

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

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)
