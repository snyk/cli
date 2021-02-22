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
End
