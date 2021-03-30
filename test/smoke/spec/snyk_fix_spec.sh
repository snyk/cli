#shellcheck shell=sh

Describe "Snyk fix command"
  Describe "supported only with FF"
    Skip if "execute only in regression test" check_if_regression_test
    It "by default snyk fix is not supported"
      When run snyk fix
      The status should be failure
      The output should include "is not supported"
      The stderr should equal ""
    End
  End
End
