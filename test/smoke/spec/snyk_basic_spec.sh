#shellcheck shell=sh

Describe "Snyk CLI basics"
  Describe "snyk version"
    It "prints version"
      When run snyk version
      The output should include "${EXPECTED_SNYK_VERSION}"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints version with --version flag"
      When run snyk --version
      The output should include "${EXPECTED_SNYK_VERSION}"
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

  Describe "snyk woof"
    It "Woofs in English by default"
      When run snyk woof
      The output should include "Woof!"
      The status should be success
      The stderr should equal ""
    End

    It "Woofs in English when passed unsopported language"
      When run snyk woof --language=blalbla
      The output should include "Woof!"
      The status should be success
      The stderr should equal ""
    End

    It "Woofs in Czech when passed 'cs'"
      When run snyk woof --language=cs
      The output should include "Haf!"
      The status should be success
      The stderr should equal ""
    End
  End
End
