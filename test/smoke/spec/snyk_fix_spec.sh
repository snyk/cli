#shellcheck shell=sh

Describe "Snyk fix command logged in"
  Before snyk_login
  After snyk_logout

  Describe "supported only with FF"

    It "by default snyk fix is not supported"
      When run snyk fix
      The status should be failure
      The output should include "is not supported"
      The stderr should equal ""
    End
  End
End

Describe "Snyk fix command logged out"
  Before snyk_logout

  Describe "Bubbles up auth error"

    It "not authed"
      When run snyk fix
      The status should be failure
      The output should include "Not authorised"
      The stderr should equal ""
    End
  End
End
