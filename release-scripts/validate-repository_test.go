package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

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

func TestValidateRepositoryReleaseBranchScenarios(t *testing.T) {
	const alreadyTagged = "already been tagged and released"
	const alreadyReleased = "already been released to github"

	testCases := []struct {
		name        string
		version     string
		setup       func(t *testing.T, dir string)
		wantFailure string
	}{
		{
			name:    "release branch with its own commit while main keeps publishing previews",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.2.0")
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
				newCommit(t, dir, "docs: update release notes")
				runGit(t, dir, "checkout", "-q", "main")
				newCommit(t, dir, "feat: more work")
				tagCommit(t, dir, "v1.4.0-preview.aaaaaaa")
				runGit(t, dir, "checkout", "-q", "release/1.3")
			},
		},
		{
			name:    "release branch head is an ancestor of preview-tagged main commits",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				runGit(t, dir, "branch", "release/1.3")
				newCommit(t, dir, "feat: more work")
				tagCommit(t, dir, "v1.4.0-preview.aaaaaaa")
				runGit(t, dir, "checkout", "-q", "release/1.3")
			},
		},
		{
			name:    "release branch cut from a commit that is exactly preview-tagged",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.4.0-preview.aaaaaaa")
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
			},
		},
		{
			name:    "release-candidate fast-forwarded from a preview-tagged main commit",
			version: "1.4.0-rc.bbbbbbb",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.4.0-preview.aaaaaaa")
				runGit(t, dir, "checkout", "-q", "-b", "release-candidate")
			},
		},
		{
			name:    "release branch cut from release-candidate head that is rc-tagged",
			version: "1.4.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.4.0-rc.bbbbbbb")
				runGit(t, dir, "checkout", "-q", "-b", "release/1.4")
			},
		},
		{
			name:    "hotfix directly on a release branch after the stable tag",
			version: "1.3.1",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0")
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
				newCommit(t, dir, "fix: hotfix")
				runGit(t, dir, "checkout", "-q", "main")
				newCommit(t, dir, "feat: main moves on")
				tagCommit(t, dir, "v1.4.0-preview.aaaaaaa")
				runGit(t, dir, "checkout", "-q", "release/1.3")
			},
		},
		{
			name:    "hotfix release already tagged stable on its release branch",
			version: "1.3.1",
			setup: func(t *testing.T, dir string) {
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
				newCommit(t, dir, "fix: hotfix")
				tagCommit(t, dir, "v1.3.1")
			},
			wantFailure: alreadyTagged,
		},
		{
			name:    "hotfix version already released, branch moved on",
			version: "1.3.1",
			setup: func(t *testing.T, dir string) {
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
				newCommit(t, dir, "fix: hotfix")
				tagCommit(t, dir, "v1.3.1")
				newCommit(t, dir, "chore: more")
			},
			wantFailure: alreadyReleased,
		},
		{
			name:    "release-candidate after release branch merged back by merge commit",
			version: "1.4.0-rc.ccccccc",
			setup: func(t *testing.T, dir string) {
				runGit(t, dir, "checkout", "-q", "-b", "release/1.3")
				newCommit(t, dir, "fix: hotfix")
				tagCommit(t, dir, "v1.3.1")
				runGit(t, dir, "checkout", "-q", "-b", "release-candidate", "main")
				runGit(t, dir, "merge", "-q", "--no-ff", "-m", "chore: merge release/1.3 back", "release/1.3")
			},
		},
		{
			name:    "head carries an rc tag of another version",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.4.0-rc.aaaaaaa")
			},
		},
		{
			name:    "prerelease version whose own tag is on head",
			version: "1.3.0-preview.aaaaaaa",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")
			},
			wantFailure: alreadyReleased,
		},
		{
			name:    "head already released as stable",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0")
			},
			wantFailure: alreadyTagged,
		},
		{
			name:    "head already tagged preview of the same version",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")
			},
		},
		{
			name:    "head carries an annotated tag",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				runGit(t, dir, "-c", "user.email=test@example.com", "-c", "user.name=Test User", "tag", "-a", "-m", "release", "v1.2.0")
			},
			wantFailure: alreadyTagged,
		},
		{
			name:    "head carries several tags",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.2.0")
				tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")
			},
			wantFailure: alreadyTagged,
		},
		{
			name:    "stable tag of the same version on an ancestor",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0")
				newCommit(t, dir, "chore: release prep")
			},
			wantFailure: alreadyReleased,
		},
		{
			name:    "preview tag of the same version on an ancestor",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")
				newCommit(t, dir, "chore: release prep")
			},
		},
		{
			name:    "rc tag of the same version on an ancestor",
			version: "1.3.0",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0-rc.aaaaaaa")
				newCommit(t, dir, "chore: release prep")
			},
		},
		{
			name:    "prerelease version whose own tag exists on an ancestor",
			version: "1.3.0-preview.aaaaaaa",
			setup: func(t *testing.T, dir string) {
				tagCommit(t, dir, "v1.3.0-preview.aaaaaaa")
				newCommit(t, dir, "chore: release prep")
			},
			wantFailure: alreadyReleased,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			dir := newTagTestRepo(t)
			tc.setup(t, dir)

			got, err := runValidateRepository(t, dir, tc.version)
			if tc.wantFailure == "" {
				if err != nil {
					t.Fatalf("expected success, got error: %v\noutput: %s", err, got)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected failure containing %q, got success:\n%s", tc.wantFailure, got)
			}
			if !strings.Contains(got, tc.wantFailure) {
				t.Fatalf("expected failure containing %q, got:\n%s", tc.wantFailure, got)
			}
		})
	}
}
