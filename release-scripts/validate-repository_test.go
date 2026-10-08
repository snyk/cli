package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// writeFakeNpm writes a fake npm to dir that reports no published versions, so
// validate-repository.sh's npm-already-released check always passes and the
// test can focus on the git tag check.
func writeFakeNpm(t *testing.T, dir string) {
	t.Helper()

	script := "#!/usr/bin/env bash\necho \"[ '0.0.0' ]\"\n"
	if err := os.WriteFile(filepath.Join(dir, "npm"), []byte(script), 0755); err != nil {
		t.Fatal(err)
	}
}

func runValidateRepository(t *testing.T, dir string, version string) (string, error) {
	t.Helper()

	binaryReleasesDir := filepath.Join(dir, "binary-releases")
	if err := os.MkdirAll(binaryReleasesDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binaryReleasesDir, "version"), []byte(version), 0644); err != nil {
		t.Fatal(err)
	}

	fakeBinDir := t.TempDir()
	writeFakeNpm(t, fakeBinDir)

	cmd := exec.Command(repoPath(t, "release-scripts", "validate-repository.sh"))
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(), "PATH="+fakeBinDir+":"+os.Getenv("PATH"))
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

// TestValidateRepositoryIgnoresPreviewTagOfSameVersion is a regression test
// for a false positive that would have blocked stable releases: the "already
// released" check used to be an unanchored `git tag | grep v$VERSION_TAG`,
// so a preview tag like v1.3.0-preview.abc123 (created by publishing a
// preview GitHub release for the same upcoming version) matched as if the
// stable v1.3.0 tag already existed, failing the release before it could
// ship. The check must require an exact tag match.
func TestValidateRepositoryIgnoresPreviewTagOfSameVersion(t *testing.T) {
	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.3.0-preview.abc123")
	newCommit(t, dir, "chore: release prep")

	got, err := runValidateRepository(t, dir, "1.3.0")
	if err != nil {
		t.Fatalf("expected success despite preview tag for the same version, got error: %v\noutput: %s", err, got)
	}
	if !strings.Contains(got, "The version is new!") {
		t.Fatalf("expected validation to pass, got:\n%s", got)
	}
}

// TestValidateRepositoryFailsWhenExactStableTagAlreadyExists ensures the
// exact-match fix did not weaken the original check: a real, already-created
// stable tag must still block re-releasing the same version.
func TestValidateRepositoryFailsWhenExactStableTagAlreadyExists(t *testing.T) {
	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.3.0")
	newCommit(t, dir, "chore: release prep")

	got, err := runValidateRepository(t, dir, "1.3.0")
	if err == nil {
		t.Fatalf("expected failure when the exact stable tag already exists, got success:\n%s", got)
	}
	if !strings.Contains(got, "already been released to github") {
		t.Fatalf("expected github-already-released failure, got:\n%s", got)
	}
}
