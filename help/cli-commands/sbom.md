# SBOM

## Prerequisites

**Feature availability:** This feature is available to customers on Snyk Enterprise plans.

**Note:** In order to run the SBOM generation feature, you must use a minimum of CLI version 1.1071.0.

The `snyk sbom` feature requires an internet connection.

## Usage

`$ snyk sbom --format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json> [--file=<FILE>] [--unmanaged] [--org=<ORG_ID>] [--dev] [--all-projects] [--name=<NAME>] [--version=<VERSION>] [--exclude=<NAME>[,<NAME>...]] [--detection-depth=<DEPTH>] [--prune-repeated-subdependencies|-p] [--json-file-output=<OUTPUT_FILE_PATH>] [<TARGET_DIRECTORY>]`

## Description

The `snyk sbom` command generates an SBOM for a local software project in an ecosystem supported by Snyk.

Supported formats include CycloneDX v1.4 (JSON or XML) and SPDX v2.3 (JSON).

An SBOM can be generated for all supported Open Source package managers as well as unmanaged software projects.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run command

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## Options

### `--format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json>`

Required. Specify the output format for the SBOM to be produced.

Set the desired SBOM output format. Available options are `cyclonedx1.4+json`, `cyclonedx1.4+xml`, and `spdx2.3+json`

### `[--org=<ORG_ID>]`

Specify the `<ORG_ID>` (name or UUID) to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

Use this option when your default organization does not have API entitlement.

If this option is omitted, the default organization for your account will be used.

This is the `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)&#x20;

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `[--file=<file>] or [--f=<file>]`

Specify the desired manifest file on which the SBOM will be based.&#x20;

By default, the `sbom` command detects a supported manifest file in the current working directory.

### `[--unmanaged]`

Generate an SBOM for unmanaged software projects.

### `[--dev]`

Include development-only dependencies in the SBOM output.

Applicable only for some package managers, for example, `devDependencies` in npm or `:development` dependencies in Gemfile.&#x20;

When `--dev` is used with the SPDX format, the development-only dependencies are included in the `DEV_DEPENDENCY_OF` relationship.

When `--dev` is used with the CycloneDX format, development-only dependencies are not labeled differently from non-development dependencies.

**Note**: This option can be used with Maven, npm, and Yarn projects.&#x20;

### `[--all-projects]`

Optional. Use for monorepos and directories with multiple projects or manifest files.

Auto-detect all projects in the working directory (including Yarn workspaces) and generate a single SBOM based on their contents.

### `[--name=<NAME>]`

Use in combination with `--all-projects` to provide the name of the software which the SBOM describes. If not specified, this defaults to the name of current working directory.

### `[--version=<VERSION>]`

Use in combination with `--all-projects` to provide the version of the software which the SBOM describes. This is omitted if not set explicitly.

### `[--exclude=<NAME>[,<NAME>...]]`

Can be used with `--all-projects` to indicate directory names and file names to exclude. Must be comma separated.

Example: `$ snyk sbom --all-projects --exclude=dir1,file2`

This will exclude any directories named `dir1` and `file2` when scanning for project manifest files.

### `[--detection-depth=<DEPTH>]`

Use with `--all-projects` to indicate how many subdirectories to search. `DEPTH` must be a number, 1 or greater; zero (0) is the current directory.

Default: 4

### `[--prune-repeated-subdependencies|-p]`

Prune dependency trees, removing duplicate sub-dependencies.

### `[<TARGET_DIRECTORY>]`

Optional. Instruct the CLI to autodetect a package manager manifest file to use within the specified directory. If `--file` is set, this option will be ignored.

### `[--json-file-output]`

Optional. Save the SBOM output as a JSON data structure directly to the specified file. This requires the SBOM `--format` to include `+json`.

## Examples for the snyk sbom command

### Create a CycloneDX JSON document for a local software project

`$ snyk sbom --format=cyclonedx1.4+json`

### Create a CycloneDX JSON document and redirect stdout to a file

`$ snyk sbom --format=cyclonedx1.4+json > mySBOM.json`

### Create an SPDX JSON document and write it to a file

`$ snyk sbom --format spdx2.3+json --json-file-output mySBOM.json`

### Create an SPDX 2.3 JSON document for an unmanaged software project

`$ snyk sbom --unmanaged --format=spdx2.3+json`

### Create a CycloneDX XML document for a Maven project

`$ snyk sbom --file=pom.xml --format=cyclonedx1.4+xml`

### Create a CycloneDX JSON document for a monorepo

`$ snyk sbom --format=cyclonedx1.4+json --all-projects`
