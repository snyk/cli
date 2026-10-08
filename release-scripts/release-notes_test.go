package main

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

// generateReleaseNotes runs the same generator as `make binary-releases/RELEASE_NOTES.md`.
func generateReleaseNotes(t *testing.T, dir string) string {
	t.Helper()

	bin := repoPath(t, "node_modules", ".bin", "conventional-changelog")
	if _, err := os.Stat(bin); err != nil {
		t.Skipf("conventional-changelog is not installed (run npm ci): %v", err)
	}

	cmd := exec.Command(bin, "-l", "-r", "1", "--skip-unstable", "-n", repoPath(t, "release-scripts", "conventional-changelog-cli-config.js"))
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generating release notes failed: %v\n%s", err, output)
	}
	return string(output)
}

// Preview tags (vX.Y.Z-preview.<sha>) accumulate on main and a release candidate is cut from it.
// The release notes must still cover every change since the last stable release.
func TestReleaseNotesCoverEverythingSinceLastStableRelease(t *testing.T) {
	dir := newTagTestRepo(t)
	newCommit(t, dir, "feat: shipped already")
	tagCommit(t, dir, "v1.0.0")
	newCommit(t, dir, "feat: before first preview")
	tagCommit(t, dir, "v1.1.0-preview.a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0")
	newCommit(t, dir, "fix: between previews")
	tagCommit(t, dir, "v1.1.0-preview.0123456789abcdef0123456789abcdef01234567")
	newCommit(t, dir, "feat: after last preview")

	notes := generateReleaseNotes(t, dir)

	for _, want := range []string{"before first preview", "between previews", "after last preview"} {
		if !strings.Contains(notes, want) {
			t.Errorf("release notes are missing %q:\n%s", want, notes)
		}
	}
	if strings.Contains(notes, "shipped already") {
		t.Errorf("release notes must not repeat changes of the previous stable release:\n%s", notes)
	}
	if strings.Contains(notes, "-preview.") {
		t.Errorf("release notes must not be split at or link to preview tags:\n%s", notes)
	}
}

func TestReleaseNotesWithoutAnyStableTag(t *testing.T) {
	dir := newTagTestRepo(t)
	newCommit(t, dir, "feat: first change")

	notes := generateReleaseNotes(t, dir)
	if !strings.Contains(notes, "first change") {
		t.Fatalf("expected the change in the release notes:\n%s", notes)
	}
}
