package persona

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/stretchr/testify/require"
)

//go:generate go run github.com/golang/mock/mockgen -destination=analytics_generated_mock_test.go -package=persona github.com/snyk/go-application-framework/pkg/analytics Analytics

type reported struct {
	collector analytics.InstrumentationCollector
	bools     map[string]bool
	integers  map[string]int
	strings   map[string]string
}

func runReport(t *testing.T) *reported {
	t.Helper()
	r := &reported{
		collector: analytics.NewInstrumentationCollector(),
		bools:     map[string]bool{},
		integers:  map[string]int{},
		strings:   map[string]string{},
	}
	a := NewMockAnalytics(gomock.NewController(t))
	a.EXPECT().IsCiEnvironment().Return(false)
	a.EXPECT().GetInstrumentation().Return(r.collector)
	a.EXPECT().AddExtensionBoolValue(keyInteractive, gomock.Any()).Do(func(k string, v bool) { r.bools[k] = v })
	a.EXPECT().AddExtensionIntegerValue(keyInteractiveMode, gomock.Any()).Do(func(k string, v int) { r.integers[k] = v })
	a.EXPECT().AddExtensionStringValue(gomock.Any(), gomock.Any()).Do(func(k, v string) { r.strings[k] = v }).AnyTimes()
	Report(a)
	return r
}

// typedPersona returns interaction.persona as GAF serializes it, or nil when Report didn't set it.
func (r *reported) typedPersona(t *testing.T) map[string]any {
	t.Helper()
	body, err := analytics.GetV2InstrumentationObject(r.collector)
	require.NoError(t, err)
	encoded, err := json.Marshal(body.Data.Attributes.Interaction.Persona)
	require.NoError(t, err)
	var persona map[string]any
	require.NoError(t, json.Unmarshal(encoded, &persona))
	return persona
}

// isolateEnv wipes the entire process environment for the duration of t and
// restores it on cleanup. detect-agent's signature list (which env vars each
// Harness is recognised by) lives in a third-party vendored agents.json we
// don't own; naming those vars here would drift the moment they add one. A
// full wipe needs no such list: whatever ambient markers the shell actually
// running `go test` happens to set (CLAUDECODE, CURSOR_TRACE_ID, ...) are
// gone regardless of what detect-agent looks for, now or in the future.
func isolateEnv(t *testing.T) {
	t.Helper()
	saved := os.Environ()
	os.Clearenv()
	t.Cleanup(func() {
		os.Clearenv()
		for _, kv := range saved {
			k, v, _ := strings.Cut(kv, "=")
			// t.Setenv would register its own cleanup here, which runs
			// immediately after this loop and unsets the var we just
			// restored. os.Setenv writes it back for good.
			//nolint:usetesting // restoring the caller's real env from within a Cleanup, not setting up a test's env
			if err := os.Setenv(k, v); err != nil {
				t.Errorf("failed to restore env var %q: %v", k, err)
			}
		}
	})
}

// TestIsolateEnvRestoresCallerEnvironment guards against isolateEnv's cleanup
// wiping out variables it was supposed to restore: t.Setenv registers its own
// unset-cleanup, so calling it from inside isolateEnv's t.Cleanup would undo
// the restore it just performed.
func TestIsolateEnvRestoresCallerEnvironment(t *testing.T) {
	t.Setenv("ISOLATE_ENV_SENTINEL", "outer")

	t.Run("inner", func(t *testing.T) {
		isolateEnv(t)
		t.Setenv("SOME_TEST_VAR", "whatever")
	})

	require.Equal(t, "outer", os.Getenv("ISOLATE_ENV_SENTINEL"), "sentinel env var not restored after isolateEnv cleanup")
}

// TestReport verifies that the public entrypoint wires the interactive and
// mode signals onto the analytics instance. The per-mode and per-agent
// behaviour is exercised in the interactive and agent subpackages.
func TestReport(t *testing.T) {
	a := runReport(t)

	require.Contains(t, a.bools, keyInteractive)
	require.Contains(t, a.integers, keyInteractiveMode)
}

// TestReport_TypedPersona verifies that Report sets interaction.persona to the
// same values it writes to the persona extension keys.
func TestReport_TypedPersona(t *testing.T) {
	isolateEnv(t)
	t.Setenv("AI_AGENT", "claude-code_2-1-233_agent")

	a := runReport(t)

	persona := a.typedPersona(t)
	require.Equal(t, map[string]any{
		"agent":            a.strings[keyAgent],
		"agent_version":    a.strings[keyAgentVersion],
		"interactive":      a.bools[keyInteractive],
		"interactive_mode": strconv.Itoa(a.integers[keyInteractiveMode]),
	}, persona)
	require.Equal(t, "claude_code", persona["agent"])
	require.Equal(t, "2.1.233", persona["agent_version"])
}

// TestReport_TypedPersona_noAgent verifies that the typed persona leaves out
// the agent fields, rather than sending them empty, when no agent is detected.
func TestReport_TypedPersona_noAgent(t *testing.T) {
	isolateEnv(t)

	persona := runReport(t).typedPersona(t)
	require.NotContains(t, persona, "agent")
	require.NotContains(t, persona, "agent_version")
	require.Equal(t, "0", persona["interactive_mode"])
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
		{
			// detect-agent's own README recommends '@' for custom AI_AGENT
			// declarations (e.g. "custom-agent@2.0"); the split must honour
			// that convention alongside Snyk's '_' and '/' formats.
			name:        "at-separated version, detect-agent's documented convention",
			env:         map[string]string{"AI_AGENT": "devin@2.1"},
			wantAgent:   "devin",
			wantVersion: "2.1",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			isolateEnv(t)
			for k, v := range tc.env {
				t.Setenv(k, v)
			}

			a := runReport(t)

			require.Equal(t, tc.wantAgent, a.strings[keyAgent])
			if tc.wantVersion == "" {
				require.NotContains(t, a.strings, keyAgentVersion)
				return
			}
			require.Equal(t, tc.wantVersion, a.strings[keyAgentVersion])
		})
	}
}
