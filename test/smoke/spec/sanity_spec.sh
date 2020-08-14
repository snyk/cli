#shellcheck shell=sh

: '
  Since we are dealing with multiple utilities and environments
  we should have a sanity test in place to test them
'

Describe "Snyk CLI"
  It "have Snyk CLI available"
    When run which snyk
    The output should include "/snyk"
    The status should be success
    The stderr should equal ""
  End
End

Describe "sanity checks for tooling"
  Describe "timeout"
    It "have timeout available"
      When run which timeout
      The output should include "/timeout"
      The status should be success
      The stderr should equal ""
    End
  End

  Describe "jq"
    It "have jq available"
      When run which jq
      The output should include "/jq"
      The status should be success
      The stderr should equal ""
    End

    It "validates JSON"
      When run echo '{"k": [1,2]}'
      The result of function check_valid_json should be success
    End

    It "validates JSON when called as When-function"
      When run check_valid_json '{"k": [1,2]}'
      The status should be success
      The stdout should equal 0
      The stderr should equal ""
    End

    # Only way to capture parse error
    It "fails on invalid JSON"
      When run check_valid_json '{"k": [1,2'
      The status should be failure
      The stderr should include "parse error"
    End
  End
End
