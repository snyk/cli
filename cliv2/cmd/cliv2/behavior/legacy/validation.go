package legacy

import (
	"fmt"
	"os"
	"strings"

	snyk_cli_errors "github.com/snyk/error-catalog-golang-public/cli"
	"github.com/spf13/cobra"
)

type flagCombinationRule struct {
	primaryFlag      string
	incompatibleWith []string
}

var incompatibleFlagRules = []flagCombinationRule{
	{
		primaryFlag: "--all-projects",
		incompatibleWith: []string{
			"--project-name",
			"--file",
			"--yarn-workspaces",
			"--package-manager",
			"--docker",
			"--all-sub-projects",
		},
	},
	{
		primaryFlag: "--yarn-workspaces",
		incompatibleWith: []string{
			"--project-name",
			"--file",
			"--package-manager",
			"--docker",
			"--all-sub-projects",
		},
	},
	{
		primaryFlag:      "--scan-all-unmanaged",
		incompatibleWith: []string{"--file"},
	},
	{
		primaryFlag:      "--project-name",
		incompatibleWith: []string{"--maven-aggregate-project"},
	},
	{
		primaryFlag:      "--json",
		incompatibleWith: []string{"--sarif"},
	},
}

func validateFlags(args []string) error {
	presentFlags := parseFlagsFromArgs(args)

	for _, rule := range incompatibleFlagRules {
		if !presentFlags[rule.primaryFlag] {
			continue
		}

		for _, incompatibleFlag := range rule.incompatibleWith {
			if presentFlags[incompatibleFlag] {
				return snyk_cli_errors.NewInvalidFlagOptionError(
					fmt.Sprintf("The following option combination is not currently supported: %s + %s", extractFlagName(incompatibleFlag), extractFlagName(rule.primaryFlag)),
				)
			}
		}
	}

	return nil
}

func parseFlagsFromArgs(args []string) map[string]bool {
	flags := make(map[string]bool)
	for _, arg := range args {
		if !strings.HasPrefix(arg, "--") {
			continue
		}
		flagName := strings.SplitN(arg, "=", 2)[0]
		flags[flagName] = true
	}
	return flags
}

func extractFlagName(flag string) string {
	return strings.TrimPrefix(flag, "--")
}

// SetupTestMonitorCommand configures command for test/monitor to ensure parity with legacy behavior
func SetupTestMonitorCommand(cmd *cobra.Command) {
	cmd.FParseErrWhitelist.UnknownFlags = true
	cmd.PreRunE = func(c *cobra.Command, args []string) error {
		if err := validateFlags(os.Args[1:]); err != nil {
			return err
		}
		return nil
	}
}
