#shellcheck shell=sh


Describe "Snyk CLI basics"
  Describe "snyk version"
    It "prints version"
      When run "snyk" version
      The output should include "1.362.0" # TODO: get version from env
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  End

  Describe "snyk help"
    It "prints help info"
      When run snyk help
      The output should include "$ snyk [command] [options] [package]"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  End

  Describe "snyk auth"
    It "fails if given bogus token"
      When run snyk auth abc123
      The output should include "Authentication failed. Please check the API token"
      The status should be failure
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  
    It "updates config file if given legit token"
      When run snyk auth "${SMOKE_TESTS_SNYK_TOKEN}"
      The output should include "Your account has been authenticated. Snyk is now ready to be used."
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
      The result of "print_snyk_config()" should include "api: ${SMOKE_TESTS_SNYK_TOKEN}"
    End
  End

End
