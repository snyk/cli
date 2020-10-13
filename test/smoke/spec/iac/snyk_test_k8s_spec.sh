#shellcheck shell=sh

Describe "Snyk iac test command"
  Before snyk_login
  After snyk_logout

  Describe "k8s single file scan"
    It "finds issues in k8s file"
      When run snyk iac test ../fixtures/iac/pod-privileged.yaml
      The status should be failure # issues found
      The output should include "Testing ../fixtures/iac/pod-privileged.yaml..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode [High Severity] [SNYK-CC-K8S-1] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > securityContext > privileged"
      The output should include "✗ Containers should ideally be explicit about required capabilities [Medium Severity] [SNYK-CC-K8S-6] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > securityContext > capabilities > drop"
      The output should include "✗ Container can run as the root [Medium Severity] [SNYK-CC-K8S-10] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > securityContext > runAsNonRoot"
      The output should include "✗ Memory limits not set [Low Severity] [SNYK-CC-K8S-4] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > resources > limits > memory"
      The output should include "✗ CPU limits not set [Low Severity] [SNYK-CC-K8S-5] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > resources > limits > cpu"
      The output should include "✗ Container not using a read-only root filesystem [Low Severity] [SNYK-CC-K8S-8] in Deployment"
      The output should include "  introduced by input > spec > containers[example] > securityContext > readOnlyRootFilesystem"

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Kubernetes"
      The output should include "Target file:       ../fixtures/iac/pod-privileged.yaml"
      The output should include "Project name:      iac"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/pod-privileged.yaml"
      The output should include "Tested ../fixtures/iac/pod-privileged.yaml for known issues, found"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/pod-privileged.yaml --severity-threshold=high
      The status should be failure # one issue found
      The output should include "Testing ../fixtures/iac/pod-privileged.yaml..."

      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode [High Severity] [SNYK-CC-K8S-1] in Deployment"
      The output should include "introduced by input > spec > containers[example] > securityContext > privileged"

      The output should include "Organization:"
      The output should include "Type:              Kubernetes"
      The output should include "Target file:       ../fixtures/iac/pod-privileged.yaml"
      The output should include "Project name:      iac"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/pod-privileged.yaml"
      The output should include "Tested ../fixtures/iac/pod-privileged.yaml for known issues, found"
    End

    It "outputs an error for files with no valid k8s objects"
      When run snyk iac test ../fixtures/iac/pod-invalid.yaml
      The status should be failure
      The output should include "Illegal infrastructure as code target file ../fixtures/iac/pod-invalid.yaml"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/pod-privileged.yaml --sarif
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"ruleId": "SNYK-CC-K8S-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/pod-privileged.yaml --json
      The status should be failure
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"packageManager": "k8sconfig",'
      The result of function check_valid_json should be success
    End
  End
End
