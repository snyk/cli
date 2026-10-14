package main

import (
	"os/exec"
	"strings"
	"testing"
)

func runSkipDeployment(t *testing.T, dir string, scriptDir string, testChannel string) (string, error) {
	t.Helper()

	cmd := exec.Command(scriptDir+"/skip-deployment.sh", testChannel)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

func TestSkipDeploymentRunsOnlyForMatchingChannel(t *testing.T) {
	dir := newTagTestRepo(t)
	scriptDir := repoPath(t, "release-scripts")

	for _, testChannel := range []string{"stable", "rc", "preview", "dev"} {
		wantSkip := "true"
		if testChannel == "preview" {
			wantSkip = "false"
		}

		got, err := runSkipDeployment(t, dir, scriptDir, testChannel)
		if err != nil {
			t.Fatalf("channel %q: expected success, got error: %v\noutput: %s", testChannel, err, got)
		}
		if got != wantSkip {
			t.Fatalf("channel %q on branch main (actual channel preview): expected skip=%s, got %q", testChannel, wantSkip, got)
		}
	}
}

func TestSkipDeploymentLegacyPreviewMapsToStable(t *testing.T) {
	scriptDir := legacyScriptsDir(t)
	dir := newTagTestRepo(t)

	got, err := runSkipDeployment(t, dir, scriptDir, "preview")
	if err != nil {
		t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
	}
	if got != "false" {
		t.Fatalf("expected legacy preview request (remapped to stable) to run on main, got skip=%q", got)
	}

	got, err = runSkipDeployment(t, dir, scriptDir, "dev")
	if err != nil {
		t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
	}
	if got != "true" {
		t.Fatalf("expected dev channel request to be skipped on main (legacy channel is stable), got skip=%q", got)
	}
}
