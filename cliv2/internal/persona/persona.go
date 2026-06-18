package persona

import (
	"github.com/snyk/cli/cliv2/internal/persona/agent"
	"github.com/snyk/cli/cliv2/internal/persona/interactive"
	"github.com/snyk/go-application-framework/pkg/analytics"
)

const (
	// keyInteractive reports whether stdin is attached to a terminal.
	keyInteractive = "persona.interactive"
	// keyInteractiveMode is the bitmask of which standard streams are attached to
	// a terminal (StdinTTY | StdoutTTY | StderrTTY).
	keyInteractiveMode = "persona.interactive_mode"
	// keyAgent reports the canonical name of the AI coding agent driving the
	// invocation, when one is detected.
	keyAgent = "persona.agent"
)

// Report adds the persona extension values to the given analytics instance.
func Report(a analytics.Analytics) {
	mode := interactive.GetInteractiveMode(a.IsCiEnvironment())
	// A terminal on stdin is our signal that a human is driving the session.
	a.AddExtensionBoolValue(keyInteractive, mode.Has(interactive.StdinTTY))
	a.AddExtensionIntegerValue(keyInteractiveMode, int(mode))
	if agent, ok := agent.DetectAgent(); ok {
		a.AddExtensionStringValue(keyAgent, string(agent))
	}
}
