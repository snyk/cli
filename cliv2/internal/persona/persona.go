package persona

import (
	"github.com/snyk/cli/cliv2/internal/persona/agent"
	"github.com/snyk/cli/cliv2/internal/persona/interactive"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
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
	// keyAgentSessionId reports the Harness session ID, when one can be
	// determined. Absent rather than empty when unknown.
	keyAgentSessionId = "persona.agent_session_id"

	// AgentSessionIdConfigKey is the config key the agent hook sets (via the
	// INTERNAL_SNYK_AGENT_SESSION_ID env var) must exclude this value from its sweep, or
	// the scrub chokepoint replaces it with "***" in the studio.agent.session.id
	// extension it's meant to carry.
	AgentSessionIdConfigKey = "internal_snyk_agent_session_id"
)

// Report adds the persona extension values to the given analytics instance.
func Report(a analytics.Analytics, config configuration.Configuration) {
	mode := interactive.GetInteractiveMode(a.IsCiEnvironment())
	// A terminal on stdin is our signal that a human is driving the session.
	a.AddExtensionBoolValue(keyInteractive, mode.Has(interactive.StdinTTY))
	a.AddExtensionIntegerValue(keyInteractiveMode, int(mode))
	if raw, ok := agent.DetectAgent(); ok {
		name, version := agent.SplitVersion(raw)
		a.AddExtensionStringValue(keyAgent, name)
		if version != "" {
			a.AddExtensionStringValue(keyAgentVersion, version)
		}
	}
	if id := config.GetString(AgentSessionIdConfigKey); id != "" {
		a.AddExtensionStringValue(keyAgentSessionId, id)
	}
}
