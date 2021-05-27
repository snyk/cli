## EXAMPLES

- `Authenticate in your CI without user interaction`:
  \$ snyk auth MY_API_TOKEN
- `Test a project in current folder for known vulnerabilities`:
  \$ snyk test
- `Test a specific dependency for vulnerabilities`:
  \$ snyk test ionic@1.6.5

More examples:

    $ snyk test --show-vulnerable-paths=false
    $ snyk monitor --org=my-team
    $ snyk monitor --project-name=my-project

### Container scanning

See `snyk container --help` for more details and examples:

    $ snyk container test ubuntu:18.04 --org=my-team
    $ snyk container test app:latest --file=Dockerfile --policy-path=path/to/.snyk

### Infrastructure as Code (IAC) scanning

See `snyk iac --help` for more details and examples:

    $ snyk iac test /path/to/cloudformation_file.yaml
    $ snyk iac test /path/to/kubernetes_file.yaml
    $ snyk iac test /path/to/terraform_file.tf
    $ snyk iac test /path/to/tf-plan.json
