package persona

import "testing"

func newLookup(env map[string]string, files map[string]bool) lookup {
	return lookup{
		getenv:     func(k string) string { return env[k] },
		fileExists: func(p string) bool { return files[p] },
	}
}

func TestDetectAgent_Signatures(t *testing.T) {
	tests := []struct {
		name  string
		env   map[string]string
		files map[string]bool
		want  Agent
	}{
		{name: "none", want: ""},
		{name: "explicit AI_AGENT", env: map[string]string{"AI_AGENT": "  windsurf  "}, want: "windsurf"},
		{name: "AI_AGENT overrides signatures", env: map[string]string{"AI_AGENT": "v0", "CLAUDECODE": "1"}, want: AgentV0},
		{name: "github-copilot-cli canonicalised", env: map[string]string{"AI_AGENT": "github-copilot-cli"}, want: AgentGitHubCopilot},
		{name: "cursor", env: map[string]string{"CURSOR_TRACE_ID": "x"}, want: AgentCursor},
		{name: "cursor-cli via CURSOR_AGENT", env: map[string]string{"CURSOR_AGENT": "1"}, want: AgentCursorCLI},
		{name: "cursor-cli via host role", env: map[string]string{"CURSOR_EXTENSION_HOST_ROLE": "agent-exec"}, want: AgentCursorCLI},
		{name: "cursor-cli host role mismatch", env: map[string]string{"CURSOR_EXTENSION_HOST_ROLE": "editor"}, want: ""},
		{name: "gemini", env: map[string]string{"GEMINI_CLI": "1"}, want: AgentGemini},
		{name: "codex", env: map[string]string{"CODEX_THREAD_ID": "abc"}, want: AgentCodex},
		{name: "antigravity", env: map[string]string{"ANTIGRAVITY_AGENT": "1"}, want: AgentAntigravity},
		{name: "augment", env: map[string]string{"AUGMENT_AGENT": "1"}, want: AgentAugmentCLI},
		{name: "opencode", env: map[string]string{"OPENCODE_CLIENT": "1"}, want: AgentOpenCode},
		{name: "claude", env: map[string]string{"CLAUDECODE": "1"}, want: AgentClaude},
		{name: "cowork", env: map[string]string{"CLAUDE_CODE": "1", "CLAUDE_CODE_IS_COWORK": "1"}, want: AgentCowork},
		{name: "replit", env: map[string]string{"REPL_ID": "1"}, want: AgentReplit},
		{name: "github copilot", env: map[string]string{"COPILOT_MODEL": "gpt"}, want: AgentGitHubCopilot},
		{name: "devin via marker file", files: map[string]bool{devinMarkerPath: true}, want: AgentDevin},
		{name: "empty AI_AGENT falls through", env: map[string]string{"AI_AGENT": "   ", "GEMINI_CLI": "1"}, want: AgentGemini},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := detectAgent(newLookup(tt.env, tt.files))
			if (tt.want != "") != ok {
				t.Fatalf("ok = %v, want %v (agent %q)", ok, tt.want != "", tt.want)
			}
			if got != tt.want {
				t.Fatalf("agent = %q, want %q", got, tt.want)
			}
		})
	}
}
