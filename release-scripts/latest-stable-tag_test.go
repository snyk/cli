package main

import (
	"bytes"
	"os/exec"
	"strconv"
	"strings"
	"testing"
)

// newTagTestRepo creates a throwaway git repo and returns its path.
func newTagTestRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	runGit(t, dir, "init", "-q")
	runGit(t, dir, "-c", "user.email=test@example.com", "-c", "user.name=Test User", "commit", "--allow-empty", "-q", "-m", "initial")
	return dir
}

func tagCommit(t *testing.T, dir string, tag string) {
	t.Helper()
	runGit(t, dir, "tag", tag)
}

func newCommit(t *testing.T, dir string, message string) {
	t.Helper()
	runGit(t, dir, "-c", "user.email=test@example.com", "-c", "user.name=Test User", "commit", "--allow-empty", "-q", "-m", message)
}

func runLatestStableTag(t *testing.T, dir string) (string, error) {
	t.Helper()

	cmd := exec.Command(repoPath(t, "release-scripts", "latest-stable-tag.sh"))
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

func TestLatestStableTagIgnoresMoreRecentPreviewTags(t *testing.T) {
	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.0.0")
	newCommit(t, dir, "preview 1")
	tagCommit(t, dir, "v1.1.0-preview.deadbeef")
	newCommit(t, dir, "preview 2")
	tagCommit(t, dir, "v1.1.0-preview.cafebabe")

	got, err := runLatestStableTag(t, dir)
	if err != nil {
		t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
	}
	if got != "v1.0.0" {
		t.Fatalf("expected clean stable tag v1.0.0, got %q", got)
	}
}

func TestLatestStableTagPicksHighestSemverNotMostRecentlyCreated(t *testing.T) {
	dir := newTagTestRepo(t)
	// Tags created out of semver order, mirroring a patch release cut from an
	// older branch after a newer minor was already tagged.
	tagCommit(t, dir, "v1.2.0")
	newCommit(t, dir, "c2")
	tagCommit(t, dir, "v1.1.5")

	got, err := runLatestStableTag(t, dir)
	if err != nil {
		t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
	}
	if got != "v1.2.0" {
		t.Fatalf("expected highest stable tag v1.2.0, got %q", got)
	}
}

func TestLatestStableTagFailsClearlyWithNoStableTags(t *testing.T) {
	dir := newTagTestRepo(t)
	tagCommit(t, dir, "v1.0.0-preview.deadbeef")

	got, err := runLatestStableTag(t, dir)
	if err == nil {
		t.Fatalf("expected failure when no stable tags exist, got output: %q", got)
	}
	if !strings.Contains(got, "No stable release tags found") {
		t.Fatalf("expected explicit error message, got: %q", got)
	}
}

// TestLatestStableTagSurvivesLargeTagCountUnderPipefail is a regression test
// for a SIGPIPE race: piping the tag list through `head -n 1` let head close
// the pipe before git/grep finished writing once there were enough tags,
// which `set -o pipefail` turned into an intermittent build failure (exit
// 141) even though the correct tag had already been produced.
func TestLatestStableTagSurvivesLargeTagCountUnderPipefail(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping large tag count test in short mode")
	}

	dir := newTagTestRepo(t)
	const tagCount = 20000

	// git tag only accepts one tag per invocation; batch creation via
	// update-ref is far faster than tagCount separate `git tag` calls.
	var stdin bytes.Buffer
	for i := 1; i <= tagCount; i++ {
		stdin.WriteString("create refs/tags/v1.0." + strconv.Itoa(i) + " HEAD\n")
	}
	cmd := exec.Command("git", "update-ref", "--stdin")
	cmd.Dir = dir
	cmd.Stdin = &stdin
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("failed to batch-create tags: %v\n%s", err, output)
	}

	want := "v1.0." + strconv.Itoa(tagCount)
	for i := 0; i < 20; i++ {
		got, err := runLatestStableTag(t, dir)
		if err != nil {
			t.Fatalf("run %d: expected success, got error: %v\noutput: %s", i, err, got)
		}
		if got != want {
			t.Fatalf("run %d: expected %s, got %q", i, want, got)
		}
	}
}
