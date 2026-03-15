package legacy

import (
	"fmt"
	"os"
	"strings"

	snyk_cli_errors "github.com/snyk/error-catalog-golang-public/cli"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
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
		primaryFlag:      "--maven-aggregate-project",
		incompatibleWith: []string{"--project-name"},
	},
	{
		primaryFlag:      "--json",
		incompatibleWith: []string{"--sarif"},
	},
}

func validateFlags(flags *pflag.FlagSet) error {

	for _, rule := range incompatibleFlagRules {
		if ok := flags.Changed(rule.primaryFlag); !ok {
			continue
		}

		for _, incompatibleFlag := range rule.incompatibleWith {
			if ok := flags.Changed(incompatibleFlag); ok {
				return snyk_cli_errors.NewInvalidFlagOptionError(fmt.Sprintf("The following option combination is not currently supported: %s + %s", incompatibleFlag, rule.primaryFlag))
			}
		}
	}

	if excludePresent := flags.Changed("--exclude"); excludePresent {
		allProjectsPresent := flags.Changed("--all-projects")
		yarnWorkspacesPresent := flags.Changed("--yarn-workspaces")
		if !allProjectsPresent && !yarnWorkspacesPresent {
			return snyk_cli_errors.NewInvalidFlagOptionError("The --exclude option can only be use in combination with --all-projects or --yarn-workspaces.")
		}

		excludeValue, err := flags.GetString("--exclude")
		if err != nil {
			return err
		}

		if excludeValue == "" {
			return snyk_cli_errors.NewEmptyFlagOptionError("Empty --exclude argument. Did you mean --exclude=subdirectory ?")
		}

		if strings.ContainsRune(excludeValue, os.PathSeparator) {
			return snyk_cli_errors.NewInvalidFlagOptionError("The --exclude argument must be a comma separated list of directory or file names and cannot contain a path.")
		}
	}

	fileValue, err := flags.GetString("--file")
	if err != nil {
		return err
	}

	if strings.HasSuffix(fileValue, ".sln") {
		if projectNamePresent := flags.Changed("--project-name"); projectNamePresent {
			return snyk_cli_errors.NewInvalidFlagOptionError(fmt.Sprintf("The following option combination is not currently supported: %s + %s", "file=*.sln", "project-name"))
		}
	}

	if detectionDepthValue, err := flags.GetInt("--detection-depth"); err != nil || detectionDepthValue <= 0 {
		return snyk_cli_errors.NewInvalidFlagOptionError("Unsupported value for --detection-depth flag. Expected a positive integer.")
	}

	jsonFileOutputValue, err := flags.GetString("--json-file-output")
	if err != nil {
		return err
	}
	if flags.Changed("--json-file-output") && jsonFileOutputValue == "" {
		return snyk_cli_errors.NewEmptyFlagOptionError("Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?")
	}

	sarifFileOutputValue, err := flags.GetString("--sarif-file-output")
	if err != nil {
		return err
	}
	if flags.Changed("--sarif-file-output") && sarifFileOutputValue == "" {
		return snyk_cli_errors.NewEmptyFlagOptionError("Empty --sarif-file-output argument. Did you mean --file=path/to/output-file.json ?")
	}

	return nil
}

// SetupTestMonitorCommand configures command for test/monitor to ensure parity with legacy behavior
func SetupTestMonitorCommand(cmd *cobra.Command) {
	cmd.FParseErrWhitelist.UnknownFlags = true
	cmd.PreRunE = func(c *cobra.Command, args []string) error {
		if err := validateFlags(c.Flags()); err != nil {
			return err
		}
		return nil
	}
}
