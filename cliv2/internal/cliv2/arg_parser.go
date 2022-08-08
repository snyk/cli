package cliv2

import (
	"fmt"
	"github.com/snyk/cli-extension-lib-go/extension"
	"github.com/spf13/cobra"
	"log"
)

func MakeArgParserConfig(extensions []*extension.Extension, debugLogger *log.Logger) *cobra.Command {
	var rootCmd = &cobra.Command{
		Use:   "snyk",
		Short: "Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.",
		Long:  `Snyk CLI scans and monitors your projects for security vulnerabilities and license issues.`,
	}

	// add a command for each of the extensions
	for _, x := range extensions {
		debugLogger.Println("adding extension to arg parser:", x.Metadata.Name)
		c := cobraCommandFromExtensionMetadataCommand(x.Metadata.Command)
		rootCmd.AddCommand(c)
	}

	// add top-level commands for CLIv1
	addV1TopLevelCommands(rootCmd)

	return rootCmd
}

var v1Commands = []string{
	"test",
	"monitor",
	"code",
	"iac",
	"container",
	"auth",
	// TODO: what else?
}

func addV1TopLevelCommands(rootCmd *cobra.Command) {
	for _, command := range v1Commands {
		c := &cobra.Command{
			Use:   command,
			Short: "todo: command description",
			Long:  "todo: command description",
			Run: func(cmd *cobra.Command, args []string) {
				fmt.Printf("v1 command %s called\n", command)
				fmt.Println("args:", args)
			},
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
