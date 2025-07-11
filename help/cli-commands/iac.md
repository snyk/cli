# IaC

## Usage

`snyk iac <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac` commands find and report security issues in Infrastructure as Code files; detect, track, and alert on unmanaged resources; and create a .driftignore file.

For more information see [Snyk CLI for IaC](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-iac)

## `snyk iac` commands and the help docs

All the `snyk iac` commands are listed here with the help options:

- [iac test](iac-test.md); `iac test --help`: tests for any known security issue
- [iac describe](iac-describe.md); `iac describe --help`: detects unmanaged cloud resources\
  Example: `snyk iac describe`
- [iac update-exclude-policy](iac-update-exclude-policy.md); `iac update-exclude-policy --help`: auto-generates `.snyk` exclusions for cloud resources
