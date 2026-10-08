package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func runDetermineReleaseChannel(t *testing.T, dir string, scriptDir string) (string, error) {
	t.Helper()

	cmd := exec.Command(filepath.Join(scriptDir, "determine-release-channel.sh"))
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

func TestDetermineReleaseChannelMapsBranchesWithStableChannelsEnabled(t *testing.T) {
	testCases := []struct {
		branch  string
		channel string
	}{
		{branch: "main", channel: "preview"},
		{branch: "release-candidate", channel: "rc"},
		{branch: "release/1.0", channel: "stable"},
		{branch: "chore/some-feature", channel: "dev"},
	}

	for _, tc := range testCases {
		t.Run(tc.branch, func(t *testing.T) {
			dir := newTagTestRepo(t)
			runGit(t, dir, "checkout", "-q", "-b", tc.branch)

			got, err := runDetermineReleaseChannel(t, dir, repoPath(t, "release-scripts"))
			if err != nil {
				t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
			}
			if got != tc.channel {
				t.Fatalf("branch %q: expected channel %q, got %q", tc.branch, tc.channel, got)
			}
		})
	}
}

// legacyScriptsDir copies the release scripts into a throwaway directory with
// enable-stable-release-channels.sh overridden to print false, so the legacy
// branch of determine-release-channel.sh (and skip-deployment.sh) can be
// exercised even though the real script is hardcoded to true today.
func legacyScriptsDir(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, name := range []string{"determine-release-channel.sh", "skip-deployment.sh"} {
		contents, err := os.ReadFile(repoPath(t, "release-scripts", name))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), contents, 0755); err != nil {
			t.Fatal(err)
		}
	}

	fakeEnableScript := "#!/usr/bin/env bash\necho false\n"
	if err := os.WriteFile(filepath.Join(dir, "enable-stable-release-channels.sh"), []byte(fakeEnableScript), 0755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestDetermineReleaseChannelUsesLegacyMappingWhenStableChannelsDisabled(t *testing.T) {
	scriptDir := legacyScriptsDir(t)

	testCases := []struct {
		branch  string
		channel string
	}{
		{branch: "main", channel: "stable"},
		{branch: "release-candidate", channel: "dev"},
		{branch: "release/1.0", channel: "dev"},
		{branch: "chore/some-feature", channel: "dev"},
	}

	for _, tc := range testCases {
		t.Run(tc.branch, func(t *testing.T) {
			dir := newTagTestRepo(t)
			runGit(t, dir, "checkout", "-q", "-b", tc.branch)

			got, err := runDetermineReleaseChannel(t, dir, scriptDir)
			if err != nil {
				t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
			}
			if got != tc.channel {
				t.Fatalf("branch %q: expected legacy channel %q, got %q", tc.branch, tc.channel, got)
			}
		})
	}
}
