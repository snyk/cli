# Container SBOM

## Prerequisites

**Feature availability:** This feature is currently in Early Access and is available to customers on Snyk Enterprise plans.

**Note:** In order to use the SBOM generation feature, you must use a minimum of CLI version 1.1226.0.

The `snyk container sbom` feature requires an internet connection.

## Usage

`$ snyk container sbom --format=<cyclonedx1.4+json|cyclonedx1.4+xml|cyclonedx1.5+json|cyclonedx1.5+xml|cyclonedx1.6+json|cyclonedx1.6+xml|spdx2.3+json> [--org=<ORG_ID>] [--platform=<PLATFORM>] [--exclude-app-vulns] <IMAGE>`

## Description

The `snyk container sbom` command generates an SBOM for a container image.

Supported formats include CycloneDX v1.4 (JSON or XML), CycloneDX v1.5 (JSON or XML), CycloneDX v1.6 (JSON or XML), and SPDX v2.3 (JSON).

An SBOM can be generated for operating system dependencies as well as application dependencies within the image. Unmanaged dependencies are not supported.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## Options

### `--format=<cyclonedx1.4+json|cyclonedx1.4+xml|cyclonedx1.5+json|cyclonedx1.5+xml|cyclonedx1.6+json|cyclonedx1.6+xml|spdx2.3+json>`

Required. Specify the output format for the SBOM to be produced.

Set the desired SBOM output format. Available options are `cyclonedx1.4+json`, `cyclonedx1.4+xml`, `cyclonedx1.5+json`, `cyclonedx1.5+xml`, `cyclonedx1.6+json`, `cyclonedx1.6+xml`, and `spdx2.3+json`

### `[--org=<ORG_ID>]`

Specify the `<ORG_ID>` (name or UUID) to run Snyk commands tied to a specific Snyk Organization. The `<ORG_ID>` influences some features availability and private test limits.

Use this option when your default Organization does not have API entitlement.

If this option is omitted, the default Organization for your account will be used.

This is the `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)&#x20;

Set a default to ensure all newly tested projects are tested under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The Organization slug name works in the CLI, but not in the API.

For more information, see the article [How to select the Organization to use in the CLI](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/how-to-select-the-organization-to-use-in-the-cli)

#### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform for the container image.

Supported platforms are: `linux/amd64`, `linux/arm64`, `linux/riscv64`, `linux/ppc64le`, `linux/s390x`, `linux/386`, `linux/arm/v6` or `linux/arm/v7`.

### `[--exclude-app-vulns]`

Snyk scans and generates an SBOM for operating system dependencies and application dependencies in your image by default.

You can disable generation for application dependencies by adding `--exclude-app-vulns`.

For more information about application scanning, see [Detect application vulnerabilities in container images](https://docs.snyk.io/scan-using-snyk/snyk-container/use-snyk-container-from-the-web-ui/detect-application-vulnerabilities-in-container-images)

### `<IMAGE>`

Required. The image for which you will generate an SBOM document.

**Note:** The image should be specified in the format of `repo:tag`.

## Examples for the snyk container sbom command

### Create a CycloneDX JSON document for an image

`$ snyk container sbom --format=cyclonedx1.6+json redis:latest`

### Create a CycloneDX JSON document for an image and redirect stdout to a file

`$ snyk container sbom --format=cyclonedx1.6+json redis:latest > mySBOM.json`

### Create a SPDX JSON document for an image while excluding application dependencies

`$ snyk container sbom --format=spdx2.3+json redis:latest --exclude-app-vulns`

### Refer to a container image by its digest

`$ snyk container sbom --format=cyclonedx1.6+xml alpine@sha256:c5c5fda71656f28e49ac9c5416b3643eaa6a108a8093151d6d1afc9463be8e33`
