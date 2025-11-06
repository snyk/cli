package legacy

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

type unsupportedFlagCombinationError struct {
	flag1 string
	flag2 string
}

func (e *unsupportedFlagCombinationError) Error() string {
	return fmt.Sprintf("The following option combination is not currently supported: %s + %s", e.flag1, e.flag2)
}

type flagCombinationRule struct {
	primaryFlag      string
	incompatibleWith []string
}

var incompatibleFlagRules = []flagCombinationRule{
	{
		primaryFlag: "--all-projects",
		incompatibleWith: []string{
			"--file",
			"--package-manager",
			"--project-name",
			"--docker",
			"--all-sub-projects",
			"--yarn-workspaces",
		},
	},
	{
		primaryFlag: "--yarn-workspaces",
		incompatibleWith: []string{
			"--file",
			"--package-manager",
			"--project-name",
			"--docker",
			"--all-sub-projects",
		},
	},
	{
		primaryFlag:      "--scan-all-unmanaged",
		incompatibleWith: []string{"--file"},
	},
	{
		primaryFlag:      "--maven-aggregate-project",
		incompatibleWith: []string{"--project-name"},
	},
}

func validateFlagsCompatibilityWithLegacy(args []string) error {
	presentFlags := parseFlagsFromArgs(args)

	for _, rule := range incompatibleFlagRules {
		if !presentFlags[rule.primaryFlag] {
			continue
		}

		for _, incompatibleFlag := range rule.incompatibleWith {
			if presentFlags[incompatibleFlag] {
				return &unsupportedFlagCombinationError{
					flag1: extractFlagName(incompatibleFlag),
					flag2: extractFlagName(rule.primaryFlag),
				}
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

func unknownCommandError(details string) error {
	if details == "" {
		return fmt.Errorf("unknown command")
	}
	return fmt.Errorf("unknown command %s", details)
}

// SetupTestMonitorCommand configures command for test/monitor to ensure parity with legacy behavior
func SetupTestMonitorCommand(cmd *cobra.Command) {
	// Relax flag validation for backwards compatibility by suppressing cobra's default error
	cmd.SetFlagErrorFunc(func(_ *cobra.Command, _ error) error {
		return unknownCommandError("")
	})

	cmd.PreRunE = func(c *cobra.Command, args []string) error {
		if err := validateFlagsCompatibilityWithLegacy(os.Args[1:]); err != nil {
			return unknownCommandError(err.Error())
		}
		return nil
	}
}
