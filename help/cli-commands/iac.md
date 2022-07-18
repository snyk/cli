# IaC

## Usage

`snyk iac <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac` commands find and report security issues in Infrastructure as Code files; detect, track, and alert on infrastructure drift and unmanaged resources; and create a .driftigore file.

For more information see [Snyk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)

## `snyk iac` commands and the help docs

All the `snyk iac` commands are listed here with the help options:

- [iac test](iac-test.md); `iac test --help`: tests for any known security issue
- [iac update-exclude-policy](iac-update-exclude-policy.md); `iac update-exclude-policy --help`: auto-generates `.snyk` exclusions for cloud resources\
  Example: `snyk iac describe --json --all | snyk iac update-exclude-policy`
- [iac describe](iac-describe.md); `iac describe --help`: detects infrastructure drift and unmanaged cloud resources\
  Example: `snyk iac describe --only-unmanaged`
