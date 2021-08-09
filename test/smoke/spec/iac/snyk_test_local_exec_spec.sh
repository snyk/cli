#shellcheck shell=sh

Describe "Snyk iac local test command"
  Skip if "execute only in regression test" check_if_regression_test

  Before snyk_login
  After snyk_logout

  Describe "basic usage"
    It "outputs an error if the flag is not supported or mistyped"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml --experimental
      The status should equal 2
      The output should include "Unsupported flag"
    End
  End

  Describe "logging regression tests"
    It "does not include file content in analytics logs"
      # Run with the -d flag on directory to output network requests and analytics data.
      When run snyk iac test ../fixtures/iac/file-logging -d
      # We expect the output, specifically the analytics block not to include
      # the following text from the file.
      The status should equal 1 # issues found
      The output should not include "PRIVATE_FILE_CONTENT_CHECK"
      The error should not include "PRIVATE_FILE_CONTENT_CHECK"
    End
  End

  Describe "k8s single file scan"
    It "finds issues in k8s YAML file"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml
      The status should equal 1 # issues found
      The output should include "Testing ../fixtures/iac/kubernetes/pod-privileged.yaml..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ Container is running in privileged mode"
      The output should include "  introduced by"
    End

    It "finds issues in k8s JSON file"
          When run snyk iac test ../fixtures/iac/kubernetes/pod-valid.json
          The status should equal 1 # issues found
          The output should include "Testing ../fixtures/iac/kubernetes/pod-valid.json..."

          # Outputs issues
          The output should include "Infrastructure as code issues:"
          The output should include "✗ Container is running in privileged mode"
          The output should include "  introduced by"
        End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml  --severity-threshold=high
      The status should equal 1 # one issue found
      The output should include "Testing ../fixtures/iac/kubernetes/pod-privileged.yaml..."

      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
    End

    It "ignores files with no recognised config types"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-invalid.yaml
      The status should equal 2
      The output should include "Could not find any valid infrastructure as code files."
    End

    It "outputs an error for Helm files"
      When run snyk iac test ../fixtures/iac/kubernetes/helm-config.yaml
      The status should equal 2
      The output should include "We were unable to parse the YAML file"
      The output should include "without any template directives"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --sarif
      The status should equal 1
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"ruleId": "SNYK-CC-K8S-1",'
      The output should not include '"startLine": "-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/kubernetes/pod-privileged.yaml --json
      The status should equal 1
      The output should include '"id": "SNYK-CC-K8S-1",'
      The output should include '"packageManager": "k8sconfig",'
      The output should include '"projectType": "k8sconfig",'
      The result of function check_valid_json should be success
    End
  End

  Describe "CloudFormation single file scan"
      It "finds issues in CloudFormation YAML file"
        When run snyk iac test ../fixtures/iac/cloudformation/aurora-valid.yml
        The status should equal 1 # issues found
        The output should include "Testing ../fixtures/iac/cloudformation/aurora-valid.yml..."

        # Outputs issues
        The output should include "Infrastructure as code issues:"
        The output should include "✗ Non-Encrypted SNS Topic"
        The output should include "  introduced by"
      End

      It "finds issues in CloudFormation JSON file"
              When run snyk iac test ../fixtures/iac/cloudformation/fargate-valid.json
              The status should equal 1 # issues found
              The output should include "Testing ../fixtures/iac/cloudformation/fargate-valid.json..."

              # Outputs issues
              The output should include "Infrastructure as code issues:"
              The output should include "✗ S3 bucket versioning disabled"
              The output should include "  introduced by"
            End

      It "filters out issues when using severity threshold"
        When run snyk iac test ../fixtures/iac/cloudformation/aurora-valid.yml  --severity-threshold=high
        The status should equal 0 # no issues found
        The output should include "Testing ../fixtures/iac/cloudformation/aurora-valid.yml..."

        The output should include "Infrastructure as code issues:"
        The output should include "Tested ../fixtures/iac/cloudformation/aurora-valid.yml for known issues, found"
      End

      It "outputs an error for files with no valid YAML"
        When run snyk iac test ../fixtures/iac/cloudformation/invalid-cfn.yml
        The status should equal 2
        The output should include "We were unable to parse the YAML file"
      End

      It "outputs the expected text when running with --sarif flag"
        When run snyk iac test ../fixtures/iac/cloudformation/aurora-valid.yml --sarif
        The status should equal 1
        The output should include '"id": "SNYK-CC-TF-55",'
        The output should include '"ruleId": "SNYK-CC-TF-55",'
      End

      It "outputs the expected text when running with --json flag"
        When run snyk iac test ../fixtures/iac/cloudformation/aurora-valid.yml --json
        The status should equal 1
        The output should include '"id": "SNYK-CC-TF-55",'
        The output should include '"packageManager": "cloudformationconfig",'
        The output should include '"projectType": "cloudformationconfig",'
        The result of function check_valid_json should be success
      End
    End

  Describe "terraform single file scan"
    It "finds issues in terraform file"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf
      The status should equal 1 # issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "  introduced by"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf  --severity-threshold=high
      The status should equal 0 # no issues found
      The output should include "Testing ../fixtures/iac/terraform/sg_open_ssh.tf..."

      The output should include "Infrastructure as code issues:"
      The output should include "Tested ../fixtures/iac/terraform/sg_open_ssh.tf for known issues, found"
    End

    # TODO: currently skipped because the parser we're using doesn't fail on invalid terraform
    # will be fixed before beta
    It "outputs an error for invalid terraforom files"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh_invalid_hcl2.tf
      The status should equal 2
      The output should include "We were unable to parse the Terraform file"
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf  --sarif
      The status should equal 1
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"ruleId": "SNYK-CC-TF-1",'
      The output should not include '"startLine": "-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf  --json
      The status should equal 1
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"packageManager": "terraformconfig",'
      The output should include '"projectType": "terraformconfig",'
      The output should not include '"startLine": "-1",'
      The result of function check_valid_json should be success
    End

    It "outputs the expected text when running with --json flag and getting no vulnerabilities"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf  --severity-threshold=high --json
      The status should equal 0 # no issues found
      The output should not include '"id": "SNYK-CC-TF-1",'
      The output should include '"packageManager": "terraformconfig",'
      The output should not include '"startLine": "-1",'
      The result of function check_valid_json should be success
    End
  End

  Describe "directory scanning"
    It "finds issues in a directory with Terraform files"
      When run snyk iac test ../fixtures/iac/terraform/
      The status should equal 1 # issues found
      # First File
      The output should include "Testing sg_open_ssh.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
      The output should include "Tested sg_open_ssh.tf for known issues, found"

      # Second File
      The output should include "Testing sg_open_ssh_invalid_hcl2.tf..."
      The output should include "Failed to parse Terraform file"
    End

    It "finds issues in a directory with Kubernetes files, ignoring unrecognised config types"
      When run snyk iac test ../fixtures/iac/kubernetes/
      The status should equal 1 # issues found
      # First File
      The output should include "Testing pod-privileged.yaml..."
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"
      The output should include "Tested pod-privileged.yaml for known issues, found"

      # pod-invalid.yaml, in the fixture directory, is not detected as
      # Kubernetes and produces no output.
    End

    It "limits the depth of the directories"
      When run snyk iac test ../fixtures/iac/depth_detection/  --detection-depth=2
      The status should equal 1 #  issues found
      # Only File
      The output should include "Testing one/one.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "Tested one/one.tf for known issues, found"

      # Second File
      The output should include "Testing root.tf..."
      The output should include "Infrastructure as code issues:"
      The output should include "Tested root.tf for known issues, found"

      # Directory scan summary
      The output should include "Tested 2 projects"
    End

    Describe "Testing status code when issues found"
      Describe "Using the --json flag"
        It "returns 1 even if some files failed to parse"
          When run snyk iac test ../fixtures/iac/kubernetes/  --json
          The status should equal 1
          The output should not equal ""
          The stderr should equal ""
        End
      End

      Describe "Not using the --json flag"
        It "returns 1 even if some files failed to parse"
          When run snyk iac test ../fixtures/iac/kubernetes/
          The status should equal 1
          The output should not equal ""
          The stderr should equal ""
        End
      End
    End

    Describe "Testing status code when no issues found"
      Describe "Using the --json flag"
        It "returns 0 even if some files failed to parse"
          When run snyk iac test ../fixtures/iac/no_vulnerabilities/  --severity-threshold=high --json
          The status should equal 0
          The output should not equal ""
          The stderr should equal ""
        End
      End

      Describe "Not using the --json flag"
        It "returns 0 even if some files failed to parse"
          When run snyk iac test ../fixtures/iac/no_vulnerabilities/  --severity-threshold=high
          The status should equal 0
          The output should not equal ""
          The stderr should equal ""
        End
      End
    End
  End

  Describe "Terraform plan scanning"
    # Note that this now defaults to the delta scan, not the full scan.
    # in the future a flag will be added to control this functionality.
    It "finds issues in a Terraform plan file"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json
      The status should equal 1 # issues found
      The output should include "tf-plan-create.json"

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      # Root module
      The output should include "✗ "
      The output should include "  introduced by"

      The output should include "tf-plan-create.json for known issues, found"
    End

    It "finds issues in a Terraform plan file - full scan flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json  --scan=planned-values
      The status should equal 1 # issues found
      The output should include "Testing ../fixtures/iac/terraform-plan/tf-plan-create.json"

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      # Root module
      The output should include "✗ "
      The output should include "  introduced by"

      The output should include "tf-plan-create.json for known issues, found"
    End

    It "finds issues in a Terraform plan file - explicit delta scan with flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json  --scan=resource-changes
      The status should equal 1 # issues found
      The output should include "Testing ../fixtures/iac/terraform-plan/tf-plan-create.json"

      # Outputs issues
      The output should include "Infrastructure as code issues:"
      # Root module
      The output should include "✗ "
      The output should include "  introduced by"

      The output should include "tf-plan-create.json for known issues, found"
    End

    It "errors when a wrong value is passed to the --scan flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json.json  --scan=rsrc-changes
      The status should equal 2 # failure
      The output should include "Unsupported value"
    End

    It "errors when no value is provided to the --scan flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json.json  --scan
      The status should equal 2 # failure
      The output should include "Unsupported value"
    End

    It "succesfully scans a TF-Plan with the --json output flag"
      When run snyk iac test ../fixtures/iac/terraform-plan/tf-plan-create.json --json
      The status should equal 1
      The output should include '"packageManager": "terraformconfig",'
      The output should include '"projectType": "terraformconfig",'
      The output should not include '"startLine": "-1",'
      The result of function check_valid_json should be success
    End
  End
End
