## Examples

[For more information see IaC help page](https://snyk.co/ucT6Q)

### `Test CloudFormation file`

\$ snyk iac test /path/to/cloudformation_file.yaml

### `Test kubernetes file`

\$ snyk iac test /path/to/kubernetes_file.yaml

### `Test terraform file`

\$ snyk iac test /path/to/terraform_file.tf

### `Test terraform plan file`

\$ snyk iac test /path/to/tf-plan.json

### `Test ARM file`

\$ snyk iac test /path/to/arm_file.json

### `Test matching files in a directory`

\$ snyk iac test /path/to/directory

### `Test matching files in a directory using a local custom rules bundle`

\$ snyk iac test /path/to/directory --rules=bundle.tar.gz
