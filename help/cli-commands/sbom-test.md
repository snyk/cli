# SBOM test

**Feature availability:** This feature is available to customers on Snyk Enterprise plans.

## Usage

`snyk sbom test --experimental --file=<FILE_PATH> [<options>]`

## Description

The `snyk sbom test` command checks SBOM files for vulnerabilities in open-source packages.

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), no vulnerabilities found\
**1**: action_needed (scan completed), vulnerabilities found\
**2**: failure, try to re-run the command

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## Options

### `--experimental`

Required. Use experimental command features. This option is currently required as the command is in its experimental phase.

### `--file=<FILE_PATH>`

Required. Specify the file path of the SBOM document.

The `snyk sbom test` command accepts the following file formats:

- **CycloneDX:** JSON version 1.4, 1.5, and 1.6
- **SPDX:** JSON version 2.3

Packages and components within the provided SBOM file must be identified by a PackageURL (purl).

Supported purl types are: `apk`, `cargo`, `cocoapods`, `composer`, `deb`, `gem`, `generic`, `golang`, `hex`, `maven`, `npm`, `nuget`, `pub`, `pypi`, `rpm`, `swift`.

Example: `$ snyk sbom test --experimental --file=bom.cdx.json`

### `--json`

Print results on the console as a JSON data structure.

Example: `$ snyk sbom test --experimental --file=bom.cdx.json --json`
