# IaC

## Usage

`snyk iac <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac` commands find and report security issues in Infrastructure as Code files; detect, track, and alert on infrastructure drift and unmanaged resources; and create a .driftigore file.

For more information see [Snyk CLI for Infrastructure as Code](https://docs.snyk.io/scan-cloud-deployment/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)

## `snyk iac` commands and the help docs

All the `snyk iac` commands are listed here with the help options:

- [iac test](iac-test.md); `iac test --help`: tests for any known security issue
- [iac capture](iac-capture.md); `iac capture --help`: generates mapping artifacts by accessing Terraform state configurations&#x20;
- [iac describe](iac-describe.md); `iac describe --help`: detects infrastructure drift and unmanaged cloud resources\
  Example: `snyk iac describe --only-unmanaged`
- [iac update-exclude-policy](iac-update-exclude-policy.md); `iac update-exclude-policy --help`: auto-generates `.snyk` exclusions for cloud resources
- [iac rules init](iac-rules-init.md); `iac rules init --help`: initializes a new custom rules project structure, a new rule in an existing custom rules project, or a new spec in an existing custom rules project, or a new relation in an existing custom rules project
- [iac rules test](iac-rules-test.md); `iac rules test --help`: runs all the tests written in Rego
- [iac rules push](iac-rules-push.md); `iac rules push --help`: bundles rules written in Rego and uploads changes to the Snyk platform
