package main

import (
	"os/exec"
	"strings"
	"testing"
)

// requireConvco fails the test if convco isn't on PATH. CI installs it via
// .circleci/Dockerfile and dev machines via scripts/Brewfile; it isn't part of
// this Go module's own dependencies.
func requireConvco(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("convco"); err != nil {
		t.Fatal("convco is required but not installed (see scripts/Brewfile, .circleci/Dockerfile)")
	}
}

func runNextVersion(t *testing.T, dir string, env ...string) (string, error) {
	t.Helper()

	cmd := exec.Command(repoPath(t, "release-scripts", "next-version.sh"))
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(), env...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// TestNextVersionBumpIgnoresPreviewTags is a regression test for the claim
// that `convco version --bump` could pick up a preview prerelease tag as its
// base and under-count commits since the last stable release. convco forces
// ignore_prereleases=true whenever --bump is passed (see convco's
// get_semver), so the bump is computed from the last *stable* tag regardless
// of any preview tags created after it.
func TestNextVersionBumpIgnoresPreviewTags(t *testing.T) {
	requireConvco(t)

	dir := newTagTestRepo(t)
	runGit(t, dir, "checkout", "-q", "-b", "release/1.0")
	tagCommit(t, dir, "v1.0.0")
	newCommit(t, dir, "fix: preview fix 1")
	tagCommit(t, dir, "v1.0.1-preview.deadbeef")
	newCommit(t, dir, "fix: preview fix 2")
	tagCommit(t, dir, "v1.0.1-preview.cafebabe")

	output, err := runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("expected success, got error: %v\noutput: %s", err, output)
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	nextVersion := lines[len(lines)-1]
	if nextVersion != "1.0.1" {
		t.Fatalf("expected next version 1.0.1 (bumped from the stable v1.0.0, ignoring preview tags), got %q\nfull output:\n%s", nextVersion, output)
	}
	if !strings.Contains(output, "Current version: 1.0.0") {
		t.Fatalf("expected logged current version to be the stable tag, got:\n%s", output)
	}
}

// runNextVersionVerify invokes next-version.sh --verify, which only checks
// consistency between BUILD_MODE and an oss suffix; it needs no git repo or
// convco, so it's run directly from a plain temp dir.
func runNextVersionVerify(t *testing.T, version string, buildMode string) (string, error) {
	t.Helper()

	cmd := exec.Command(repoPath(t, "release-scripts", "next-version.sh"), "--verify", version)
	cmd.Dir = t.TempDir()
	if buildMode != "" {
		cmd.Env = append(cmd.Environ(), "BUILD_MODE="+buildMode)
	}
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func TestNextVersionVerifyAcceptsConsistentVersions(t *testing.T) {
	testCases := []struct {
		name      string
		version   string
		buildMode string
	}{
		{name: "private without oss suffix", version: "1.2.3", buildMode: "private"},
		{name: "private prerelease without oss suffix", version: "1.2.3-preview.deadbeef", buildMode: "private"},
		{name: "default build mode behaves like private", version: "1.2.3", buildMode: ""},
		{name: "public stable with oss suffix", version: "1.2.3-oss", buildMode: "public"},
		{name: "public prerelease with oss identifier", version: "1.2.3-preview.deadbeef.oss", buildMode: "public"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := runNextVersionVerify(t, tc.version, tc.buildMode)
			if err != nil {
				t.Fatalf("expected %q (BUILD_MODE=%q) to verify as consistent, got error: %v\noutput: %s", tc.version, tc.buildMode, err, output)
			}
		})
	}
}

func TestNextVersionVerifyRejectsInconsistentVersions(t *testing.T) {
	testCases := []struct {
		name      string
		version   string
		buildMode string
	}{
		{name: "private build with oss suffix", version: "1.2.3-oss", buildMode: "private"},
		{name: "public build missing oss suffix", version: "1.2.3", buildMode: "public"},
		{name: "public prerelease missing oss identifier", version: "1.2.3-preview.deadbeef", buildMode: "public"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := runNextVersionVerify(t, tc.version, tc.buildMode)
			if err == nil {
				t.Fatalf("expected %q (BUILD_MODE=%q) to be rejected as inconsistent, got success:\n%s", tc.version, tc.buildMode, output)
			}
		})
	}
}
