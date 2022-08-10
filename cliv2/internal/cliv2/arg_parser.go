package cliv2

import (
	"fmt"

	"github.com/snyk/cli-extension-lib-go/extension"
	"github.com/snyk/cli/cliv2/internal/httpauth"
	"github.com/spf13/cobra"
)

const (
	CMDARG_PROXY_NO_AUTH string = "proxy-noauth"
)

func MakeArgParserConfig(extensions []*extension.Extension, config *CliConfiguration) *cobra.Command {
	var rootCmd = &cobra.Command{
		Use:   "snyk",
		Short: "Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.",
		Long:  `Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.`,
	}

	rootCmd.Flags().BoolP("version", "v", false, "Show Snyk CLI version.")

	// Put these here to make it NOT show the usage when you do `snyk --version` or `snyk -v`
	rootCmd.SilenceUsage = true
	rootCmd.SilenceErrors = true

	rootCmd.PersistentFlags().BoolVarP(&config.Debug, "debug", "d", false, "Enable debug logging.")
	rootCmd.PersistentFlags().BoolVar(&config.Insecure, "insecure", false, "Disable secure communication protocols.")
	rootCmd.PersistentFlags().Bool(CMDARG_PROXY_NO_AUTH, false, "Disable all proxy authentication.")
	rootCmd.PersistentFlags().StringVar(&config.ProxyAddr, "proxy", "", "Configure an http/https proxy. Overriding environment variables.")

	// add a command for each of the extensions
	for _, x := range extensions {
		config.DebugLogger.Println("adding extension to arg parser:", x.Metadata.Name)
		c := cobraCommandFromExtensionMetadataCommand(x.Metadata.Command)
		rootCmd.AddCommand(c)
	}

	// add top-level commands for CLIv1
	addV1TopLevelCommands(rootCmd)

	// version command
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Show Snyk CLI version.",
		Long:  "Show Snyk CLI version.",
		Run:   func(cmd *cobra.Command, args []string) {},
	}
	rootCmd.AddCommand(versionCmd)

	return rootCmd
}

type NodeCLICommandMeta struct {
	name        string
	description string
}

var v1Commands = []NodeCLICommandMeta{
	{
		name:        "auth",
		description: "Authenticate Snyk CLI with a Snyk account.",
	},
	{
		name:        "test",
		description: "Test a project for open source vulnerabilities and license issues.\n\t\tNote: Use snyk test --unmanaged to scan all files for known open source dependencies (C/C++ only).",
	},
	{
		name:        "monitor",
		description: "Snapshot and continuously monitor a project for open source vulnerabilities and license issues.",
	},
	{
		name:        "container",
		description: "Test container images for vulnerabilities.",
	},
	{
		name:        "iac",
		description: "Commands to find and manage security issues in Infrastructure as Code files.",
	},
	{
		name:        "code",
		description: "Find security issues using static code analysis.",
	},
	{
		name:        "log4shell",
		description: "Find Log4Shell vulnerability.",
	},
	{
		name:        "config",
		description: "Manage Snyk CLI configuration.",
	},
	{
		name:        "policy",
		description: "Display the .snyk policy for a package.",
	},
	{
		name:        "ignore",
		description: "Modify the .snyk policy to ignore stated issues.",
	},
}

func addV1TopLevelCommands(rootCmd *cobra.Command) {
	for _, command := range v1Commands {
		c := &cobra.Command{
			Use:   command.name,
			Short: command.description,
			Long:  command.description,
			Run:   func(cmd *cobra.Command, args []string) {},
		}

		// c.SilenceUsage = true
		// c.SilenceErrors = true

		// because we don't know anything about the command internals - they are all handled by v1
		c.DisableFlagParsing = true

		rootCmd.AddCommand(c)
	}
}

func cobraCommandFromExtensionMetadataCommand(cmd *extension.Command) *cobra.Command {
	cobraCommand := &cobra.Command{
		Use:   cmd.Name,
		Short: cmd.Description,
		Long:  cmd.Description,
		// this `Run` field is required in order to make this command show in the "available commands" list in the usage
		Run: func(cmd *cobra.Command, args []string) {},
	}

	// Add options
	if cmd.Options != nil {
		for _, o := range cmd.Options {
			if o.Type == "string" {
				cobraCommand.Flags().StringP(o.Name, o.Shorthand, "", o.Description)
			} else if o.Type == "bool" {
				cobraCommand.Flags().BoolP(o.Name, o.Shorthand, false, o.Description)
			}
		}
	}

	// Add debug option
	cobraCommand.Flags().BoolP("debug", "d", false, "debug mode")

	// Add subcommands
	if cmd.Subcommands != nil {
		for _, sc := range cmd.Subcommands {
			cobraSubcommand := cobraCommandFromExtensionMetadataCommand(sc)
			cobraCommand.AddCommand(cobraSubcommand)
		}
	}

	return cobraCommand
}

func ExecuteArgumentParser(argParserRootCmd *cobra.Command, config *CliConfiguration) (err error) {
	err = argParserRootCmd.Execute()
	if err != nil {
		fmt.Println(err)
		return err
	}

	if isSet, _ := argParserRootCmd.PersistentFlags().GetBool(CMDARG_PROXY_NO_AUTH); isSet {
		config.ProxyAuthenticationMechanism = httpauth.NoAuth
	}
	return err
}
