package extensions

import (
	"fmt"
)

func MatchExtension(args []string, extensions []Extension) *Extension {
	fmt.Println("args:", args)

	if len(args) > 0 {
		maybeCommand := args[0]
		for _, extension := range extensions {
			if extension.ExtensionMetadata.Command == maybeCommand {
				return &extension
			}
		}
	}

	return nil
}
