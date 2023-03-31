# SBOM

## Usage

**Feature availability:** This feature is available to customers on Snyk Enterprise plans.

**Note:** In order to run the SBOM generation feature, you must use a minimum of CLI version 1.1071.0.

`$ snyk sbom --format=<cyclonedx1.4+json|spdx2.3+json|cyclonedx1.4+xml> [--file=<file>] [--unmanaged] [--org=<ORG_ID>] [<TARGET_DIRECTORY>]`

## Description

The `snyk sbom` command enables you to produce an SBOM for a local software project in an ecosystem supported by Snyk.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run command

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json>`

Specify the output format for the SBOM to be produced.

The supported formats are CycloneDX 1.4 JSON or XML and SPDX 2.3 JSON.

### `[--file=<file>]`

Optional. Select the package manager manifest file to use as the basis for the SBOM to be produced.

### `[--unmanaged]`

Optional. Instruct the CLI to build an SBOM based on the unmanaged C/C++ source libraries that are locally available.

### `[--org=<ORG_ID>]`

Optional. Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `[<TARGET_DIRECTORY>]`

Optional. Instruct the CLI to autodetect a package manager manifest file to use within the specified directory. If `--file` is set, this option will be ignored.

**Note:** Support for the `--all-projects` option is planned for later versions.

## Examples for the snyk sbom command

Generate an SBOM and display it in the local console.

`$ snyk sbom --format=cyclonedx1.4+json`

Generate an SBOM and write it to a local file.

`$ snyk sbom --format=cyclonedx1.4+json > mySBOM.json`
