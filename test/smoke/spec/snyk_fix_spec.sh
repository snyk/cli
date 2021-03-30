#shellcheck shell=sh

Describe "Snyk fix command"
  Describe "supported only with FF"

    It "by default snyk fix is not supported"
      When run snyk fix
      The status should be failure
      The output should include "is not supported"
      The stderr should equal ""
    End
  End
End
