#shellcheck shell=sh

Describe "Snyk iac test --experimental command"
  Before snyk_login
  After snyk_logout

  Describe "k8s single file scan"
    Skip if "execute only in regression test" check_if_regression_test
    It "finds issues in k8s file"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental
      The status should be failure # issues found
      The output should include "Testing ../fixtures/iac/kubernetes/pod-privileged.yaml..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode [High Severity] [SNYK-CC-K8S-1] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > securityContext > privileged"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental --severity-threshold=high
      The status should be failure # one issue found
      The output should include "Testing ../fixtures/iac/kubernetes/pod-privileged.yaml..."

      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode [High Severity] [SNYK-CC-K8S-1] in Deployment"
      The output should include "introduced by input > spec > containers[example] > securityContext > privileged"
    End

    It "outputs an error for files with no valid k8s objects"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml --experimental
      The status should be failure
      The output should include "Invalid K8s File!"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental --sarif
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"ruleId": "SNYK-CC-K8S-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental --json
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"packageManager": "k8sconfig",'
      The result of function check_valid_json should be success
    End
  End

  Describe "terraform single file scan"
    Skip if "execute only in regression test" check_if_regression_test
    It "finds issues in terraform file"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental
      The status should be failure # issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Security Group allows open ingress [Medium Severity] [SNYK-CC-TF-1] in Security Group"
      The output should include "  introduced by resource > aws_security_group[allow_ssh] > ingress"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental --severity-threshold=high
      The status should be success # no issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."

      The output should include "Infrastructure as code issues:"
      The output should include "Tested ../fixtures/iac/terraform/sg_open_ssh.tf for known issues, found 0 issues"
    End

    # TODO: currently skipped because the parser we're using doesn't fail on invalid terraform
    # will be fixed before beta 
    xIt "outputs an error for invalid terraforom files"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh_invalid_hcl2.tf --experimental
      The status should be failure
      The output should include "Invalid Terraform File!"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental --sarif
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"ruleId": "SNYK-CC-TF-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental --json
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"packageManager": "terraformconfig",'
      The result of function check_valid_json should be success
    End
  End

  Describe "directory scanning"
    Skip if "execute only in regression test" check_if_regression_test

    It "finds issues in a directory with Terraform files"
      When run snyk iac test ../fixtures/iac/terraform/ --experimental
      The status should be failure # issues found
      # First File
      The output should include "Testing sg_open_ssh.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Security Group allows open ingress [Medium Severity] [SNYK-CC-TF-1] in Security Group"
      The output should include "introduced by resource > aws_security_group[allow_ssh] > ingress"
      The output should include "Tested sg_open_ssh.tf for known issues, found 1 issues"

      # Second File (the parser used in local-exec doesn't fail on invalid HCL! will be fixed soon)
      The output should include "Testing sg_open_ssh_invalid_hcl2.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Security Group allows open ingress [Medium Severity] [SNYK-CC-TF-1] in Security Group"
      The output should include "introduced by resource > aws_security_group[allow_ssh] > ingress"
      The output should include "Tested sg_open_ssh_invalid_hcl2.tf for known issues, found 1 issues"

      # Directory scan summary
      The output should include "Tested 3 projects, 2 contained issues."
    End

    It "finds issues in a directory with Kubernetes files"
      When run snyk iac test ../fixtures/iac/kubernetes/ --experimental
      The status should be failure # issues found
      # First File
      The output should include "Testing pod-privileged.yaml..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode [High Severity] [SNYK-CC-K8S-1] in Deployment"
      The output should include "introduced by input > spec > containers[example] > securityContext > privileged"
      The output should include "Tested pod-privileged.yaml for known issues, found 1 issues"

      # Second File
      The output should include "Testing pod-invalid.yaml..."
      The output should include "Invalid K8s File!"
    End
  End
End
