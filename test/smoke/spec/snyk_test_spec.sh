#shellcheck shell=sh

Describe "Snyk test command"
  Describe "basic npm test"
    It "finds vulns in a project"
      When run snyk test "../fixtures/basic-npm"
      The status should be failure
      The output should include "https://snyk.io/vuln/npm:minimatch:20160620"
      The stderr should equal ""
    End
  End

  Describe "basic npm test with JSON output"
    It "finds vulns in a project"
      When run snyk test "../fixtures/basic-npm" --json
      The status should be failure
      The output should include "npm:minimatch:20160620"
      The output should include '"vulnerabilities": [' # TODO: check valid JSON? With jq?
      The stderr should equal ""
    End
  End
End
