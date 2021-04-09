#shellcheck shell=sh

Describe "Snyk iac test --experimental command"
  Skip if "execute only in regression test" check_if_regression_test

  Before snyk_login
  After snyk_logout

  Describe "basic usage"
    It "outputs an error if the --experimental flag is mistyped"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml --experimentl
      The status should be failure
      The output should include "Unsupported flag"
    End
  End

  Describe "logging regression tests"
    It "does not include file content in analytics logs"
      # Run with the -d flag on directory to output network requests and analytics data.
      When run snyk iac test ../fixtures/iac/file-logging -d --experimental
      # We expect the output, specifically the analytics block not to include
      # the following text from the file.
      The status should be failure  # issues found
      The output should not include "PRIVATE_FILE_CONTENT_CHECK"
      The error should not include "PRIVATE_FILE_CONTENT_CHECK"
    End
  End

  Describe "k8s single file scan"
    It "finds issues in k8s file"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental
      The status should be failure # issues found
      The output should include "Testing pod-privileged.yaml..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode"
      The output should include "  introduced by"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --experimental --severity-threshold=high
      The status should be failure # one issue found
      The output should include "Testing pod-privileged.yaml..."

      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
    End

    It "outputs an error for files with no valid k8s objects"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml --experimental
      The status should be failure
      The output should include "We were unable to detect whether the YAML file"
    End

    It "outputs an error for Helm files"
      When run snyk iac test ../fixtures/iac/kubernetes/helm-config.yaml --experimental
      The status should be failure
      The output should include "We were unable to parse the YAML file"
      The output should include "do not support scanning of Helm files"
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
    It "finds issues in terraform file"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental
      The status should be failure # issues found
      The output should include "Testing sg_open_ssh.tf..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "  introduced by"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --experimental --severity-threshold=high
      The status should be success # no issues found
      The output should include "Testing sg_open_ssh.tf..."

      The output should include "Infrastructure as code issues:"
      The output should include "Tested sg_open_ssh.tf for known issues, found"
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
    It "finds issues in a directory with Terraform files"
      When run snyk iac test ../fixtures/iac/terraform/ --experimental
      The status should be failure # issues found
      # First File
      The output should include "Testing sg_open_ssh.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
      The output should include "Tested sg_open_ssh.tf for known issues, found"

      # Second File (the parser used in local-exec doesn't fail on invalid HCL! will be fixed soon)
      The output should include "Testing sg_open_ssh_invalid_hcl2.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
      The output should include "Tested sg_open_ssh_invalid_hcl2.tf for known issues, found"

      # Directory scan summary
      The output should include "Tested 3 projects, 2 contained issues."
    End

    It "finds issues in a directory with Kubernetes files"
      When run snyk iac test ../fixtures/iac/kubernetes/ --experimental
      The status should be failure # issues found
      # First File
      The output should include "Testing pod-privileged.yaml..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
      The output should include "Tested pod-privileged.yaml for known issues, found"

      # Second File
      The output should include "Testing pod-invalid.yaml..."
      The output should include "Failed to detect Kubernetes file, missing required fields"
    End

    It "limits the depth of the directories"
      When run snyk iac test ../fixtures/iac/depth_detection/ --experimental --detection-depth=2
      The status should be success # no issues found
      # Only File
      The output should include "Testing one.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "Tested one.tf for known issues, found 0 issues"

      # Second File
      The output should include "Testing root.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "Tested root.tf for known issues, found 0 issues"

      # Directory scan summary
      The output should include "Tested 2 projects, no vulnerable paths were found."
    End
  End

  Describe "Terraform plan scanning"
    # Note that this now defaults to the delta scan, not the full scan.
    # in the future a flag will be added to control this functionality.
    It "finds issues in a Terraform plan file"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan.json --experimental
      The status should be failure # issues found
      The output should include "Testing tf-plan.json"

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      # Root module
      The output should include "✗ "
      The output should include "  introduced by"

      The output should include "tf-plan.json for known issues, found"
    End

    # The test below should be enabled once we add the full scan flag
    xIt "finds issues in a Terraform plan file - full scan flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan.json --experimental
      The status should be failure # issues found
      The output should include "Testing tf-plan.json"

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      # Root module
      The output should include "✗ "
      The output should include "  introduced by"

      The output should include "tf-plan.json for known issues, found"
    End
  End
End
