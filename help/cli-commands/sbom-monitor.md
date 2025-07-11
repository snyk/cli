# SBOM monitor

**Feature availability:** SBOM monitor is in Closed Beta for Snyk Open Source and Snyk Container, available through the Snyk CLI `sbom monitor` command. This feature is available only with Enterprise plans. If you want to get the feature up and running in your Group or Organization, contact your Snyk account team.

**Note:** In order to use the SBOM monitoring feature, you must use a minimum of CLI version 1.1297.0.

## Usage

`snyk sbom monitor --experimental [<OPTIONS>]`

## Description

The `snyk sbom monitor` command creates a target and projects in your Snyk account to be continuously monitored for open-source vulnerabilities and license issues, sending the results to [snyk.io](https://snyk.io)

Use the `sbom monitor` command to take a snapshot of dependencies detected in your SBOM to be monitored. Choose a test frequency in your Settings if you want to change the frequency from the default, which is daily.

After running the `snyk sbom monitor` command, log in to the Snyk website and view your projects to see the monitor and related issues.

If you make changes to your SBOM, you must run the `sbom monitor` command again.&#x20;

## Exit codes

Possible exit codes and their meaning:

**0**: success, snapshot created\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--experimental`

Required. Use experimental command features. This option is required because the command is in its experimental phase.

### `--file=<FILE_PATH>`

Required. Specify the file path of the SBOM document.

The `snyk sbom monitor` command accepts the following file formats:

- CycloneDX: JSON version 1.4, 1.5, and 1.6
- SPDX: JSON version 2.3

Packages and components within the provided SBOM file must be identified by a Package URL (`purl`).

Supported purl types are: `apk`, `cargo`, `cocoapods`, `conan`, `composer`, `deb`, `gem`, `generic`, `golang`, `hex`, `maven`, `npm`, `nuget`, `pub`, `pypi`, `rpm`, `swift`

Example: `$ snyk sbom monitor --experimental --file=bom.cdx.json`&#x20;

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository.

Example: `--remote-repo-url=https://gitlab.com/example/project` will create a target for given URL, and on the UI it would be visible as `/example/project/` .

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference that differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference.&#x20;

For more information, see [Group projects by branch or version for monitoring](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/group-projects-by-branch-or-version-for-monitoring)

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific Snyk Organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple Organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly monitored projects are created under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The Organization slug name works in the CLI, but not in the API.

`orgslugname` must match the slug name as displayed in the URL of your org in the Snyk UI: `https://app.snyk.io/org/[orgslugname]`. The orgname does not work.

For more information, see the article [How to select the Organization to use in the CLI](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/how-to-select-the-organization-to-use-in-the-cli).
