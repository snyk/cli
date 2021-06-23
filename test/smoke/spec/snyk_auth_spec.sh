#shellcheck shell=sh

Describe "Snyk CLI Authorization"
  After snyk_logout

  It "fails when run in CI without token set"
    When run snyk auth
    The output should include "Snyk is missing auth token in order to run inside CI"
    The status should be failure
    # TODO: unusable with our current docker issues
    The stderr should equal ""
  End

  Describe "auth outside of CI environment"
    Before disable_is_ci_flags
    After restore_is_ci_flags

    It "fails when run without token set"
      # Alpine can't open browser, misses xdg-open utility and errors out
      is_alpine_or_disabled() {
        if [ -n "$SMOKE_TESTS_SKIP_TEST_THAT_OPENS_BROWSER" ]; then
          echo "Won't test auth command that opens browser" >&2
          exit 0
        fi
        grep "Alpine Linux" /etc/os-release > /dev/null 2>&1
        return $?
      }
      Skip if "test is disabled" is_alpine_or_disabled

      # Using timeout to not wait for browser confirmation
      When run timeout 5 snyk auth
      The result of function check_auth_output should be success
      The result of function verify_login_url should include "snyk.io/login?token=" # URL found
      The status should be failure
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  End


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
