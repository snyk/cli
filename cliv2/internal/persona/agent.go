package persona

import (
	"os"
	"strings"
)

// Agent is the canonical name of a known AI coding agent / harness.
type Agent string

const (
	AgentCursor        Agent = "cursor"
	AgentCursorCLI     Agent = "cursor-cli"
	AgentClaude        Agent = "claude"
	AgentCowork        Agent = "cowork"
	AgentDevin         Agent = "devin"
	AgentReplit        Agent = "replit"
	AgentGemini        Agent = "gemini"
	AgentCodex         Agent = "codex"
	AgentAntigravity   Agent = "antigravity"
	AgentAugmentCLI    Agent = "augment-cli"
	AgentOpenCode      Agent = "opencode"
	AgentGitHubCopilot Agent = "github-copilot"
	AgentV0            Agent = "v0"
)

// devinMarkerPath is a filesystem marker present inside the Devin sandbox.
const devinMarkerPath = "/opt/.devin"

// lookup abstracts the environment so detection can be tested without mutating
// the real process environment.
type lookup struct {
	getenv     func(string) string
	fileExists func(string) bool
}

func osLookup() lookup {
	return lookup{
		getenv: os.Getenv,
		fileExists: func(path string) bool {
			_, err := os.Stat(path)
			return err == nil
		},
	}
}

// signature describes how a single agent is recognised from the environment.
type signature struct {
	agent Agent
	match func(l lookup) bool
}

// anySet reports true if any of the given environment variables is set to a
// non-empty value.
func anySet(l lookup, keys ...string) bool {
	for _, k := range keys {
		if l.getenv(k) != "" {
			return true
		}
	}
	return false
}

// signatures is the ordered list of agent detectors. Order matters: the first
// match wins, so more specific signatures must precede more generic ones.
//
// Kept in sync with the Snyk CLI agent-detection logic (index.ts).
var signatures = []signature{
	{AgentCursor, func(l lookup) bool { return anySet(l, "CURSOR_TRACE_ID") }},
	{AgentCursorCLI, func(l lookup) bool {
		return anySet(l, "CURSOR_AGENT") || l.getenv("CURSOR_EXTENSION_HOST_ROLE") == "agent-exec"
	}},
	{AgentGemini, func(l lookup) bool { return anySet(l, "GEMINI_CLI") }},
	{AgentCodex, func(l lookup) bool { return anySet(l, "CODEX_SANDBOX", "CODEX_CI", "CODEX_THREAD_ID") }},
	{AgentAntigravity, func(l lookup) bool { return anySet(l, "ANTIGRAVITY_AGENT") }},
	{AgentAugmentCLI, func(l lookup) bool { return anySet(l, "AUGMENT_AGENT") }},
	{AgentOpenCode, func(l lookup) bool { return anySet(l, "OPENCODE_CLIENT") }},
	// Claude Code: the "cowork" surface is a more specific variant and must be
	// checked first.
	{AgentCowork, func(l lookup) bool {
		return anySet(l, "CLAUDECODE", "CLAUDE_CODE") && anySet(l, "CLAUDE_CODE_IS_COWORK")
	}},
	{AgentClaude, func(l lookup) bool { return anySet(l, "CLAUDECODE", "CLAUDE_CODE") }},
	{AgentReplit, func(l lookup) bool { return anySet(l, "REPL_ID") }},
	{AgentGitHubCopilot, func(l lookup) bool {
		return anySet(l, "COPILOT_MODEL", "COPILOT_ALLOW_ALL", "COPILOT_GITHUB_TOKEN")
	}},
	{AgentDevin, func(l lookup) bool { return l.fileExists(devinMarkerPath) }},
}

// DetectAgent resolves the active AI agent, if any, from the current process
// environment.
func DetectAgent() (Agent, bool) {
	return detectAgent(osLookup())
}

// detectAgent resolves the active AI agent, if any.
//
// The AI_AGENT environment variable is the explicit, highest-priority signal:
// when set it is trusted verbatim (with a couple of canonicalisations). When it
// is absent, detection falls back to per-agent environment / filesystem
// signatures.
func detectAgent(l lookup) (Agent, bool) {
	if name := strings.TrimSpace(l.getenv("AI_AGENT")); name != "" {
		return canonicalAgent(name), true
	}

	for _, s := range signatures {
		if s.match(l) {
			return s.agent, true
		}
	}

	return "", false
}

// canonicalAgent normalises an explicitly declared AI_AGENT value onto the set
// of canonical agent names.
func canonicalAgent(name string) Agent {
	switch Agent(name) {
	case "github-copilot-cli":
		return AgentGitHubCopilot
	default:
		return Agent(name)
	}
}
