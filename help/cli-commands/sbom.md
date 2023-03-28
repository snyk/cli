# SBOM (beta)

## Usage

**Note:** In order to try out the SBOM generation feature, you must use a minimum of CLI version 1.1071.0.

`snyk sbom --experimental [--file=<file>] --format=<cyclonedx1.4+json|spdx2.3+json|cyclonedx1.4+xml> [--unmanaged] [--targetDirectory=<targetDirectory>]`

## Description

The `snyk sbom` command enables you to produce an SBOM for a local software project in an ecosystem supported by Snyk.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--experimental`

Specify while the `snyk sbom` command is in beta.

### `[--file=<file>]`

Optional. Select the package manager manifest file to use as the basis for the SBOM to be produced.

### `--format=<cyclonedx1.4+json|spdx2.3+json|cyclonedx1.4+xml>`

Optional. Specify the output format for the SBOM to be produced.

The supported formats are CycloneDX 1.4 JSON or XML and SPDX 2.3 JSON.

### `[--unmanaged]`

Optional. Instruct the CLI to build an SBOM based on the unmanaged C/C++ source libraries that are locally available.

### `[--targetDirectory=<targetDirectory]`

Optional. Instruct the CLI to autodetect the package manager manifest file to use within the specified directory.

**Note:** Support for the `--all-projects` option is planned for later versions.

## Examples for the snyk sbom command

Generate an SBOM and display it in the local console.

`snyk sbom --format=cyclonedx+json`

Generate an SBOM and write it to a local file.

`snyk sbom --format=cyclonedx+json > mySBOM.json`

## Share your feedback

The `snyk sbom` command is offered in beta in order to gather feedback, so your comments are welcome.

Snyk wants to hear what works or does not work with the current options, and what else you would like to see in the future in this area.

If you have a shared Slack channel with Snyk, an account team, or contact with the product team, you are welcome to provide feedback directly. Otherwise you may submit feedback through a request to [Snyk Support](https://support.snyk.io/hc/en-us/requests/new)
