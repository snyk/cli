## Examples

[For more information see IaC help page](https://snyk.co/ucT6Q)

### `Test a CloudFormation file`

\$ snyk iac test /path/to/cloudformation_file.yaml

### `Test a Kubernetes file`

\$ snyk iac test /path/to/kubernetes_file.yaml

### `Test a Terraform file`

\$ snyk iac test /path/to/terraform_file.tf

### `Test a Terraform plan file`

\$ terraform plan -out=tfplan.binary
\$ terraform show -json tfplan.binary > tf-plan.json
\$ snyk iac test tf-plan.json

### `Test an ARM file`

\$ snyk iac test /path/to/arm_file.json

### `Test matching files in a directory`

\$ snyk iac test /path/to/directory

### `Test matching files in a directory using a local custom rules bundle`

\$ snyk iac test /path/to/directory --rules=bundle.tar.gz
