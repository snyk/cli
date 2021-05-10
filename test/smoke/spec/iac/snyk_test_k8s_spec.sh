#shellcheck shell=sh

Describe "Snyk iac test command"
  Before snyk_login
  After snyk_logout

  Describe "k8s single file scan"
    Skip if "execute only in regression test" check_if_regression_test
    It "finds issues in k8s file"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --legacy
      The status should be failure # issues found
      The output should include "Testing pod-privileged.yaml..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "  introduced by "

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Kubernetes"
      The output should include "Target file:       ../fixtures/iac/kubernetes/pod-privileged.yaml"
      The output should include "Project name:      kubernetes"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/kubernetes/pod-privileged.yaml"
      The output should include "Tested pod-privileged.yaml for known issues, found"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --severity-threshold=high --legacy
      The status should be failure # one issue found
      The output should include "Testing pod-privileged.yaml..."

      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"

      The output should include "Organization:"
      The output should include "Type:              Kubernetes"
      The output should include "Target file:       ../fixtures/iac/kubernetes/pod-privileged.yaml"
      The output should include "Project name:      kubernetes"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/kubernetes/pod-privileged.yaml"
      The output should include "Tested pod-privileged.yaml for known issues, found"
    End

    It "outputs an error for files with no valid k8s objects"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml --legacy
      The status should be failure
      The output should include "Illegal infrastructure as code target file pod-invalid.yaml"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --sarif --legacy
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"ruleId": "SNYK-CC-K8S-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --json --legacy
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"packageManager": "k8sconfig",'
      The result of function check_valid_json should be success
    End
  End
End
