package extensions

func MatchExtension(args []string, extensions []Extension) *Extension {
	if len(args) > 0 {
		maybeCommand := args[0]
		for _, extension := range extensions {
			if extension.Metadata.Command == maybeCommand {
				return &extension
			}
		}
	}

	return nil
}
