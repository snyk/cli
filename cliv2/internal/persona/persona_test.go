package persona

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/analytics"
)

// fakeAnalytics records the extension values written by Report. It embeds
// analytics.Analytics (left nil) only to satisfy the full GAF interface; the
// four methods below are the only ones Report ever calls.
type fakeAnalytics struct {
	analytics.Analytics
	ci       bool
	bools    map[string]bool
	integers map[string]int
	strings  map[string]string
}

func newFakeAnalytics() *fakeAnalytics {
	return &fakeAnalytics{
		bools:    map[string]bool{},
		integers: map[string]int{},
		strings:  map[string]string{},
	}
}

func (f *fakeAnalytics) IsCiEnvironment() bool                          { return f.ci }
func (f *fakeAnalytics) AddExtensionBoolValue(key string, value bool)   { f.bools[key] = value }
func (f *fakeAnalytics) AddExtensionIntegerValue(key string, value int) { f.integers[key] = value }
func (f *fakeAnalytics) AddExtensionStringValue(key, value string)      { f.strings[key] = value }

// TestReport verifies that the public entrypoint wires the interactive and
// mode signals onto the analytics instance. The per-mode and per-agent
// behaviour is exercised in the interactive and agent subpackages.
func TestReport(t *testing.T) {
	a := newFakeAnalytics()
	Report(a)

	if _, ok := a.bools[keyInteractive]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractive)
	}
	if _, ok := a.integers[keyInteractiveMode]; !ok {
		t.Fatalf("expected %q to be reported", keyInteractiveMode)
	}
}

// TestReport_Agent covers every real-world AI_AGENT shape observed in
// production analytics, plus the signature-detection and edge-case paths:
// the environment goes in, the recorded persona.agent / persona.agent_version
// values come out, and everything in between (detection, version split,
// canonicalisation) is free to change.
func TestReport_Agent(t *testing.T) {
	cases := []struct {
		name        string
		env         map[string]string
		wantAgent   string
		wantVersion string
	}{
		{
			name:        "fused underscore, agent role",
			env:         map[string]string{"AI_AGENT": "claude-code_2-1-233_agent"},
			wantAgent:   "claude_code",
			wantVersion: "2.1.233",
		},
		{
			name:        "fused underscore, harness role",
			env:         map[string]string{"AI_AGENT": "claude-code_2-1-229_harness"},
			wantAgent:   "claude_code",
			wantVersion: "2.1.229",
		},
		{
			// Different literal shape, same version, to prove both normalise
			// to the identical bucket rather than merely similar ones.
			name:        "legacy slash format normalises to the same bucket",
			env:         map[string]string{"AI_AGENT": "claude-code/2.1.233/agent"},
			wantAgent:   "claude_code",
			wantVersion: "2.1.233",
		},
		{
			// Same canonical name as the fused AI_AGENT cases above, proving
			// Claude Code converges to one bucket regardless of which
			// detection path (declaration vs. signature) produced it.
			name:        "bare signature detection, no explicit declaration",
			env:         map[string]string{"AI_AGENT": "", "CLAUDECODE": "1"},
			wantAgent:   "claude_code",
			wantVersion: "",
		},
		{
			name:        "harness that already groups correctly",
			env:         map[string]string{"AI_AGENT": "cursor-cli"},
			wantAgent:   "cursor-cli",
			wantVersion: "",
		},
		{
			name:        "fused identifier with no version-shaped segment",
			env:         map[string]string{"AI_AGENT": "github_copilot_vscode_agent"},
			wantAgent:   "github_copilot_vscode_agent",
			wantVersion: "",
		},
		{
			name:        "version-shaped but unrecognised harness",
			env:         map[string]string{"AI_AGENT": "mystery-tool_9-1_agent"},
			wantAgent:   "mystery-tool_9-1_agent",
			wantVersion: "",
		},
		{
			name:        "redacted identifier",
			env:         map[string]string{"AI_AGENT": "***"},
			wantAgent:   "***",
			wantVersion: "",
		},
		{
			name:        "version-shaped run with no trailing role segment",
			env:         map[string]string{"AI_AGENT": "claude-code_2-1-233"},
			wantAgent:   "claude_code",
			wantVersion: "2.1.233",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for k, v := range tc.env {
				t.Setenv(k, v)
			}

			a := newFakeAnalytics()
			Report(a)

			if got := a.strings[keyAgent]; got != tc.wantAgent {
				t.Fatalf("%s = %q, want %q", keyAgent, got, tc.wantAgent)
			}
			if tc.wantVersion == "" {
				if v, ok := a.strings[keyAgentVersion]; ok {
					t.Fatalf("expected %q to be absent, got %q", keyAgentVersion, v)
				}
				return
			}
			if got := a.strings[keyAgentVersion]; got != tc.wantVersion {
				t.Fatalf("%s = %q, want %q", keyAgentVersion, got, tc.wantVersion)
			}
		})
	}
}
