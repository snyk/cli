#shellcheck shell=sh

Describe "Snyk Code test command"
  Before snyk_login
  After snyk_logout

  Describe "snyk code test"
    run_test_in_subfolder() {
      cd ../fixtures/sast/shallow_sast_webgoat || return
      snyk code test .
    }

    It "finds vulns in a project in the same folder"
      When run run_test_in_subfolder
      The output should be present
      The status should be failure # issues found
    End
  End

  Describe "code test with SARIF output"
    It "outputs a valid SARIF with vulns"
      When run snyk code test ../fixtures/sast/shallow_sast_webgoat --sarif
      The status should be failure # issues found
      The result of function check_valid_json should be success
    End
  End

End
