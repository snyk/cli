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
