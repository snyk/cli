#shellcheck shell=sh

Describe "Snyk CLI basics"
  Describe "snyk version"
    It "prints version"
      When run snyk version
      The output should include "1." # Version should start with a (major) 1
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints version with --version flag"
      When run snyk --version
      The output should include "1." # Version should start with a (major) 1
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  End

  Describe "snyk config"
    It "prints config"
      When run snyk config
      The stdout should equal ""
      The status should be success
    End

    It "sets config"
      When run snyk config set newkey=newvalue
      The output should include "newkey updated"
      The status should be success
      The result of "print_snyk_config()" should include "newkey: newvalue"
    End

    It "unsets config"
      When run snyk config unset newkey
      The output should include "newkey deleted"
      The status should be success
      The result of "print_snyk_config()" should not include "newkey"
      The result of "print_snyk_config()" should not include "newvalue"
    End
  End

  Describe "snyk --about"
    It "prints license attributions"
      When run snyk --about
      The output should include "Snyk CLI Open Source Attributions" # Version should start with a (major) 1
      The status should be success
      The stderr should equal ""
    End
  End
End
