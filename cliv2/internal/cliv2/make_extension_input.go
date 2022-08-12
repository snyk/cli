package cliv2

import (
	"fmt"
	"os"

	cli_extension_lib_go "github.com/snyk/cli-extension-lib-go"
	"github.com/snyk/cli-extension-lib-go/extension"
	"github.com/snyk/cli/cliv2/internal/configuration"
	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/spf13/cobra"
)

func MakeExtensionInput(extensionMetadata *extension.ExtensionMetadata, matchedCobraCommand *cobra.Command, args []string, debugMode bool, proxyPort int) *cli_extension_lib_go.ExtensionInput {
	// traverse up the command tree to get each command/subcommand
	cobraCommands := []*cobra.Command{}
	cmd := matchedCobraCommand
	for cmd.Name() != "snyk" {
		cobraCommands = append(cobraCommands, cmd)
		cmd = cmd.Parent()
	}

	// reverse the commands list so it's ordered from root to leaf
	cobraCommands = utils.GetReverseSlice(cobraCommands)

	var topLevelExtInputCommand *cli_extension_lib_go.ExtensionInputCommand
	var currentExtInputCommand *cli_extension_lib_go.ExtensionInputCommand

	extMetadataCmd := extensionMetadata.Command

	// traverse commands list from root to leaf
	for i_cobraCommand := 0; i_cobraCommand < len(cobraCommands); i_cobraCommand++ {
		if cobraCommands[i_cobraCommand].Name() != extMetadataCmd.Name {
			panic(fmt.Sprintf("command names don't match: %s from cobra and %s from extension metadata\n", cobraCommands[i_cobraCommand].Name(), extMetadataCmd.Name))
		}

		// ready to get the options and add the next command to the ExtensionInput
		optionsMap := GetOptionsFromSubcommand(extMetadataCmd, cobraCommands[i_cobraCommand])

		// var positionals []string // this will make a null in the ext input json
		positionals := []string{}

		isLeafCommand := i_cobraCommand == len(cobraCommands)-1

		// if this is the leaf command, include the positionals
		if isLeafCommand {
			positionals = cobraCommands[i_cobraCommand].Flags().Args()
		}

		newExtensionInputCommand := &cli_extension_lib_go.ExtensionInputCommand{
			Name:        extMetadataCmd.Name,
			Subcommand:  nil,
			Options:     optionsMap,
			Positionals: positionals,
		}

		if currentExtInputCommand == nil {
			// this is the top-level command
			topLevelExtInputCommand = newExtensionInputCommand
		} else {
			// add it as a sub command
			currentExtInputCommand.Subcommand = newExtensionInputCommand
		}

		// update the currentExtInputCommand pointer
		currentExtInputCommand = newExtensionInputCommand

		// get ready for the next iteration
		// need to set extMetadataCmd to the next subcommand. But in order to do this, we need to get peek at the next command in commands
		// if this is not the leaf subcommand
		if !isLeafCommand {
			nextCommandName := cobraCommands[i_cobraCommand+1].Name()
			extMetadataCmd = extMetadataCmd.Subcommands[nextCommandName]
		}
	}

	token := getToken()

	return &cli_extension_lib_go.ExtensionInput{
		Debug:   debugMode,
		Command: topLevelExtInputCommand,
		Token:   token,
	}
}

func GetOptionsFromSubcommand(extMetaCmd *extension.Command, cobraCmd *cobra.Command) map[string]any {
	optionsMap := map[string]any{}

	for _, opt := range extMetaCmd.Options {
		optionName := opt.Name
		if opt.Type == "string" {
			optionStringValue, error := cobraCmd.Flags().GetString(optionName)
			if error != nil || optionStringValue == "" {
				optionStringValue = opt.Default.(string)
			}
			optionsMap[optionName] = optionStringValue
		}
		if opt.Type == "bool" {
			optionBoolValue, error := cobraCmd.Flags().GetBool(optionName)
			if error != nil {
				optionBoolValue = opt.Default.(bool)
			}
			optionsMap[optionName] = optionBoolValue
		}
	}

	return optionsMap
}

func getToken() string {
	var token string

	envAsMap := utils.ToKeyValueMap(os.Environ(), "=")
	token = envAsMap["SNYK_TOKEN"]

	if len(token) == 0 {
		config := configuration.NewConfigstore()
		token, _ = config.Get("api")
	}

	return token
}
