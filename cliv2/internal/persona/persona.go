package persona

const (
	// keyInteractive reports whether at least one standard stream is attached to
	// a terminal.
	keyInteractive = "persona.interactive"
	// keyInteractiveMode is the bitmask of which standard streams are attached to
	// a terminal (StdinTTY | StdoutTTY | StderrTTY).
	keyInteractiveMode = "persona.interactive_mode"
	// keyAgent reports the canonical name of the AI coding agent driving the
	// invocation, when one is detected.
	keyAgent = "persona.agent"
)

// Analytics is the subset of the analytics sink that persona reporting needs.
type Analytics interface {
	AddExtensionBoolValue(key string, value bool)
	AddExtensionIntegerValue(key string, value int)
	AddExtensionStringValue(key string, value string)
}

// Report adds the persona extension values to the given analytics sink.
func Report(a Analytics) {
	mode := GetInteractiveMode()
	a.AddExtensionBoolValue(keyInteractive, mode != 0)
	a.AddExtensionIntegerValue(keyInteractiveMode, int(mode))
	if agent, ok := DetectAgent(); ok {
		a.AddExtensionStringValue(keyAgent, string(agent))
	}
}
