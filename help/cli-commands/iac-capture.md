# IaC capture

## Usage

**Feature availability:** This feature is available in Snyk CLI version v1.1117.0 or greater.

`snyk iac capture [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac capture` command generates a mapping artifact that contains the minimum amount of information needed to generate, from Terraform state files, resource mappings from code to Cloud, such as resource IDs and names, and sends the mapping artifact to Snyk.

Snyk uses this information to link Cloud issues to their originating IaC files. The links can be viewed in the Snyk Web UI.

For more information, see [Fix Cloud issues in IaC](https://docs.snyk.io/scan-cloud-deployment/snyk-cloud/snyk-cloud-issues/fix-cloud-issues-in-iac)

For a list of related commands see the [snyk iac](iac.md) help; `iac --help`

## Exit codes

Possible exit codes and their meaning:

**0**: success\
**1**: failed to capture one or more Terraform states

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. Overrides the default `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/how-to-select-the-organization-to-use-in-the-cli)

### `--stdin`

Generate the mapping artifact from Terraform state in the standard input instead of looking for state files in the `PATH`.

```
$ terraform pull | snyk iac capture --stdin
```

### `PATH`

Optional argument to generate the mapping artifact from Terraform state file(s) in the PATH. Can either be a path to a directory, a path to a file, or a glob pattern.

```
$ snyk iac capture /path/to/states/**/*.tfstate
```

## Examples for snyk iac capture command

### Capture from all states in the current working directory

```
$ snyk iac capture
```

### Capture from all files ending with .tfstate in a directory

```
$ snyk iac capture /path/to/states/**/*.tfstate
```

### Capture from a single state file

```
$ snyk iac capture /path/to/state.tfstate
```

### Capture from states pulled with Terraform in the standard input

```
$ terraform pull | snyk iac capture --stdin
```
