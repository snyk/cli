package main

import (
	"os/exec"
	"strings"
	"testing"
)

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

func lastLine(output string) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	return lines[len(lines)-1]
}

// Stable tags live on release/* branches and are merged back to release-candidate and main.
// Previews built on main must be versioned above the stable release once that merge-back happened.
func TestNextVersionAcrossReleaseBranchMergeBack(t *testing.T) {
	requireConvco(t)

	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.2.0")
	newCommit(t, dir, "feat: work for 1.3")
	tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")

	runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
	newCommit(t, dir, "fix: release fix")

	got, err := runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("release branch: %v\n%s", err, got)
	}
	if v := lastLine(got); v != "1.3.0" {
		t.Fatalf("release/1.3 should produce stable 1.3.0 (preview tag ignored), got %q\n%s", v, got)
	}
	tagCommit(t, dir, "v1.3.0")

	runGit(t, dir, "checkout", "-q", "main")
	newCommit(t, dir, "feat: more work on main")
	got, err = runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("main before merge-back: %v\n%s", err, got)
	}
	if v := lastLine(got); !strings.HasPrefix(v, "1.3.0-preview.") {
		t.Fatalf("documents the known gap: before merge-back main still bumps from v1.2.0, got %q\n%s", v, got)
	}

	runGit(t, dir, "merge", "-q", "--no-ff", "-m", "chore: merge release/1.3 back", "release/1.3")
	got, err = runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("main after merge-back: %v\n%s", err, got)
	}
	if v := lastLine(got); !strings.HasPrefix(v, "1.4.0-preview.") {
		t.Fatalf("after merge-back main previews must be above 1.3.0, got %q\n%s", v, got)
	}
	if !strings.Contains(got, "Current version: 1.3.0") {
		t.Fatalf("expected current version 1.3.0, got:\n%s", got)
	}
}

// Flow: main -> release-candidate -> release/*. Hotfixes may land directly on release/* and
// release branches are always merged back to the other branches.
func TestNextVersionPerBranchInReleaseFlow(t *testing.T) {
	requireConvco(t)

	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.2.0")
	newCommit(t, dir, "feat: work for 1.3")
	tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")

	// promote main -> release-candidate -> release/1.3 and ship stable
	runGit(t, dir, "checkout", "-q", "-b", "release-candidate")
	got, err := runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("release-candidate: %v\n%s", err, got)
	}
	if v := lastLine(got); !strings.HasPrefix(v, "1.3.0-rc.") {
		t.Fatalf("release-candidate should produce 1.3.0-rc.<sha>, got %q\n%s", v, got)
	}
	runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
	tagCommit(t, dir, "v1.3.0")

	// main moves on and publishes previews for the next minor
	runGit(t, dir, "checkout", "-q", "main")
	newCommit(t, dir, "feat: work for 1.4")
	tagCommit(t, dir, "v1.4.0-preview.bbbbbbb")

	// hotfix directly on the release branch
	runGit(t, dir, "checkout", "-q", "release/1.3")
	newCommit(t, dir, "fix: hotfix")
	got, err = runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("release/1.3 hotfix: %v\n%s", err, got)
	}
	if v := lastLine(got); v != "1.3.1" {
		t.Fatalf("hotfix on release/1.3 should produce 1.3.1 despite 1.4.0 previews on main, got %q\n%s", v, got)
	}
	tagCommit(t, dir, "v1.3.1")

	// main is promoted to release-candidate, then the release branch is merged back everywhere
	runGit(t, dir, "checkout", "-q", "release-candidate")
	runGit(t, dir, "merge", "-q", "--no-ff", "-m", "chore: promote main to release-candidate", "main")
	for _, branch := range []string{"release-candidate", "main"} {
		runGit(t, dir, "checkout", "-q", branch)
		runGit(t, dir, "merge", "-q", "--no-ff", "-m", "chore: merge release/1.3 back", "release/1.3")
	}

	got, err = runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("main after merge-back: %v\n%s", err, got)
	}
	if v := lastLine(got); !strings.HasPrefix(v, "1.4.0-preview.") {
		t.Fatalf("main after hotfix merge-back should stay on 1.4.0-preview.<sha>, got %q\n%s", v, got)
	}
	if !strings.Contains(got, "Current version: 1.3.1") {
		t.Fatalf("expected current version 1.3.1, got:\n%s", got)
	}

	runGit(t, dir, "checkout", "-q", "release-candidate")
	got, err = runNextVersion(t, dir, "BUILD_MODE=private")
	if err != nil {
		t.Fatalf("release-candidate after merge-back: %v\n%s", err, got)
	}
	if v := lastLine(got); !strings.HasPrefix(v, "1.4.0-rc.") {
		t.Fatalf("release-candidate carrying main's 1.4 work should produce 1.4.0-rc.<sha>, got %q\n%s", v, got)
	}
}
