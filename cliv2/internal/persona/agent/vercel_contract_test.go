package agent

import (
	"os"
	"strings"
	"testing"

	detectagent "github.com/vercel/detect-agent"
)

// isolateEnv wipes the entire process environment for the duration of t and
// restores it on cleanup, so ambient markers from the shell actually running
// `go test` (CLAUDECODE, CURSOR_TRACE_ID, ...) can't leak into detectagent's
// signature detection. See persona_test.go's copy for the full rationale.
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
		t.Setenv("AI_AGENT", "whatever")
	})

	if got := os.Getenv("ISOLATE_ENV_SENTINEL"); got != "outer" {
		t.Fatalf("sentinel env var not restored after isolateEnv cleanup: got %q, want %q", got, "outer")
	}
}

// TestVercelDetectDoesNotNormalizeExplicitAIAgent proves the vercel package's
// contract directly, independent of our own split/canonicalise code: an
// explicit AI_AGENT declaration is returned byte-for-byte, version and role
// still fused in, while the signature-fallback path (no AI_AGENT) returns
// vercel's own clean vocabulary name. This is why SplitVersion exists.
func TestVercelDetectDoesNotNormalizeExplicitAIAgent(t *testing.T) {
	t.Run("explicit AI_AGENT is returned verbatim, not standardised", func(t *testing.T) {
		isolateEnv(t)
		t.Setenv("AI_AGENT", "claude-code_2-1-233_agent")

		details, err := detectagent.Detect()
		if err != nil {
			t.Fatalf("Detect() error = %v", err)
		}
		if details.Name != "claude-code_2-1-233_agent" {
			t.Fatalf("Name = %q, want raw AI_AGENT value unchanged", details.Name)
		}
	})

	t.Run("signature fallback returns vercel's own clean name", func(t *testing.T) {
		isolateEnv(t)
		t.Setenv("CLAUDECODE", "1")

		details, err := detectagent.Detect()
		if err != nil {
			t.Fatalf("Detect() error = %v", err)
		}
		if details.Name != "claude_code" {
			t.Fatalf("Name = %q, want vercel's canonical %q", details.Name, "claude_code")
		}
		if want := KnownAgentsName("CLAUDE"); details.Name != want {
			t.Fatalf("Name = %q does not match KnownAgents[%q] = %q", details.Name, "CLAUDE", want)
		}
	})
}

// KnownAgentsName is a tiny test-only accessor so the assertion above reads
// against the vocabulary directly rather than a hardcoded duplicate string.
func KnownAgentsName(key string) string {
	return detectagent.KnownAgents[key]
}

// TestSplitVersionReconcilesBothPaths feeds SplitVersion the raw, unprocessed
// output vercel actually returns for each path proven above, and shows both
// converge on the same canonical name despite vercel returning two different
// strings for the same tool.
func TestSplitVersionReconcilesBothPaths(t *testing.T) {
	explicitName, explicitVersion := SplitVersion("claude-code_2-1-233_agent")
	fallbackName, fallbackVersion := SplitVersion("claude_code")

	if explicitName != "claude_code" {
		t.Fatalf("explicit path: name = %q, want %q", explicitName, "claude_code")
	}
	if explicitVersion != "2.1.233" {
		t.Fatalf("explicit path: version = %q, want %q", explicitVersion, "2.1.233")
	}
	if fallbackName != "claude_code" {
		t.Fatalf("fallback path: name = %q, want %q", fallbackName, "claude_code")
	}
	if fallbackVersion != "" {
		t.Fatalf("fallback path: version = %q, want empty (signature path never carries one)", fallbackVersion)
	}
	if explicitName != fallbackName {
		t.Fatalf("paths diverged: %q != %q", explicitName, fallbackName)
	}
}

// TestSplitVersion_AtSeparator covers detect-agent's own documented
// name@version convention for custom AI_AGENT declarations (see the
// "Recommended Naming Convention" section of the vercel/detect-agent
// README), which '_' and '/' alone did not handle.
func TestSplitVersion_AtSeparator(t *testing.T) {
	cases := []struct {
		name        string
		raw         string
		wantName    string
		wantVersion string
	}{
		{
			name:        "known harness, dotted version",
			raw:         "devin@2.1",
			wantName:    "devin",
			wantVersion: "2.1",
		},
		{
			name:        "known harness, three-component version",
			raw:         "claude_code@2.1.233",
			wantName:    "claude_code",
			wantVersion: "2.1.233",
		},
		{
			// detect-agent's README uses this exact string ("devin@1") as its
			// example of the convention; '@' is never part of a Harness name,
			// so the separator alone is enough signal — no minimum digit-group
			// count is needed the way there is for '_'/'/'.
			name:        "single-component version, detect-agent's own README example",
			raw:         "devin@1",
			wantName:    "devin",
			wantVersion: "1",
		},
		{
			// '_' and '/' remain ordinary characters that can end a real name
			// on their own, so the ambiguity guard still applies to them.
			name:        "single-component underscore version still does not split",
			raw:         "devin_1",
			wantName:    "devin_1",
			wantVersion: "",
		},
		{
			name:        "unrecognised harness is never guessed",
			raw:         "custom-agent@2.0",
			wantName:    "custom-agent@2.0",
			wantVersion: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotName, gotVersion := SplitVersion(tc.raw)
			if gotName != tc.wantName {
				t.Errorf("name = %q, want %q", gotName, tc.wantName)
			}
			if gotVersion != tc.wantVersion {
				t.Errorf("version = %q, want %q", gotVersion, tc.wantVersion)
			}
		})
	}
}
