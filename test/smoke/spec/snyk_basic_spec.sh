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

  Describe "snyk help"
    It "prints help info"
      When run snyk help
      The output should include "CLI and build-time tool to find & fix known vulnerabilities in"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End
  End

  Describe "extensive snyk help"
    Skip if "execute only in regression test" check_if_regression_test

    It "prints help info when called with unknown argument"
      When run snyk help hello
      The output should include "CLI and build-time tool to find & fix known vulnerabilities in"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints help info when called with flag and unknown argument"
      When run snyk --help hello
      The output should include "CLI and build-time tool to find & fix known vulnerabilities in"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints specific help info"
      When run snyk woof --help
      The output should include "W00f"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints specific help info for container"
      When run snyk -h container
      The output should include "Test container images for vulnerabilities"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints specific help info for iac"
      When run snyk iac -help
      The output should include "Find security issues in your Infrastructure as Code files"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints specific help info when called with flag and equals sign"
      When run snyk --help=woof
      The output should include "W00f"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    It "prints help info for argument with mode"
      When run snyk --help container test
      The output should include "Test container images for vulnerabilities"
      The status should be success
      # TODO: unusable with our current docker issues
      The stderr should equal ""
    End

    Describe "prints help info without ascii escape sequences"
      It "has NO_COLOR set"
        snyk_help_no_color() {
          NO_COLOR='' snyk help
        }

        When run snyk_help_no_color
        The output should not include "[1mN"
        The output should not include "[0m"
        The output should not include "[4mC"
      End

      It "is not tty"
        snyk_help_no_tty() {
          snyk help | cat
        }

        When run snyk_help_no_tty
        The output should not include "[1mN"
        The output should not include "[0m"
        The output should not include "[4mC"
      End
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
