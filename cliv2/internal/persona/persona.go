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
	// keyAgent reports the canonical name of the Harness driving the
	// invocation, when one is detected.
	keyAgent = "persona.agent"
	// keyAgentVersion reports the Harness version, when one can be
	// determined. Absent rather than empty when unknown.
	keyAgentVersion = "persona.agent_version"
)

// Report sets interaction.persona and the persona extension values on the given analytics instance.
func Report(a analytics.Analytics) {
	mode := interactive.GetInteractiveMode(a.IsCiEnvironment())
	// A terminal on stdin is our signal that a human is driving the session.
	p := analytics.Persona{Interactive: mode.Has(interactive.StdinTTY), InteractiveMode: int(mode)}
	if raw, ok := agent.DetectAgent(); ok {
		p.Agent, p.AgentVersion = agent.SplitVersion(raw)
	}

	// SetPersona only fails for a collector GAF didn't create; the extension values are still written.
	_ = analytics.SetPersona(a.GetInstrumentation(), p)

	a.AddExtensionBoolValue(keyInteractive, p.Interactive)
	a.AddExtensionIntegerValue(keyInteractiveMode, p.InteractiveMode)
	if p.Agent != "" {
		a.AddExtensionStringValue(keyAgent, p.Agent)
	}
	if p.AgentVersion != "" {
		a.AddExtensionStringValue(keyAgentVersion, p.AgentVersion)
	}
}
