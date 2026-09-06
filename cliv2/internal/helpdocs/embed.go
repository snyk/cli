package helpdocs

import "embed"

const cliCommandsDir = "cli-commands"

//go:embed cli-commands
var cliCommands embed.FS

var defaultCommandHelp *CommandHelp

// DefaultCommandHelp returns the compile-time embedded CLI command help lookup.
func DefaultCommandHelp() *CommandHelp {
	if defaultCommandHelp == nil {
		var err error
		if defaultCommandHelp, err = NewCommandHelp(cliCommands, cliCommandsDir); err != nil {
			panic("helpdocs: index cli-commands: " + err.Error())
		}
	}
	return defaultCommandHelp
}
