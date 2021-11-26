## Examples

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
    $ snyk iac test /path/to/arm_file.json

To use your own custom rules to scan IaC configuration files, download the `snyk-iac-rules` SDK from https://github.com/snyk/snyk-iac-rules. Follow the
instructions there to write, build, and push a custom rules bundle and then
either use the Snyk UI to configure your custom rules settings or configure
a remote OCI registry locally by running the following commands:

    $ snyk config set oci-registry-url=https://registry-1.docker.io/username/repo:tag
    $ snyk config set oci-registry-username=username
    $ snyk config set oci-registry-password=password

### Static code analysis (SAST) scanning

See `snyk code --help` for more details and examples:

    $ snyk code test /path/to/project
