#shellcheck shell=sh

Describe "Snyk iac test command"
  Before snyk_login
  After snyk_logout

  Describe "terraform single file scan"
    Skip if "execute only in regression test" check_if_regression_test
    It "finds issues in terraform file"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --legacy
      The status should be failure # issues found
      The output should include "Testing sg_open_ssh.tf..."
      # Outputs issues   
      The output should include "Infrastructure as code issues:"
      The output should include "✗ "
      The output should include "introduced by"

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Terraform"
      The output should include "Target file:       ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Project name:      terraform"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Tested sg_open_ssh.tf for known issues, found"
    End

    It "filters out issues when using severity threshold"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --severity-threshold=high --legacy
      The status should be success # no issues found
      The output should include "Testing sg_open_ssh.tf..."
      # Outputs issues   
      The output should include "Infrastructure as code issues:"

      # Outputs Summary
      The output should include "Organization:"
      The output should include "Type:              Terraform"
      The output should include "Target file:       ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Project name:      terraform"
      The output should include "Open source:       no"
      The output should include "Project path:      ../fixtures/iac/terraform/sg_open_ssh.tf"
      The output should include "Tested sg_open_ssh.tf for known issues, found"
    End

    It "outputs an error for invalid hcl2 tf files"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh_invalid_hcl2.tf --legacy
      The status should be failure
      The output should include "Illegal Terraform target file sg_open_ssh_invalid_hcl2.tf "
      The output should include "Validation Error Reason: Invalid HCL2 Format."
    End

    It "outputs the expected text when running with --sarif flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --sarif --legacy
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"ruleId": "SNYK-CC-TF-1",'
    End

    It "outputs the expected text when running with --json flag"
      When run snyk iac test ../fixtures/iac/terraform/sg_open_ssh.tf --json --legacy
      The status should be failure
      The output should include '"id": "SNYK-CC-TF-1",'
      The output should include '"packageManager": "terraformconfig",'
      The result of function check_valid_json should be success
    End
  End
End
