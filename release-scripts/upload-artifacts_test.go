package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// runUploadArtifacts runs upload-artifacts.sh on the given branch with fake gh and npm binaries
// that record their arguments. It returns the recorded gh and npm invocations, one per line.
func runUploadArtifacts(t *testing.T, branch string, args ...string) (gh []string, npm []string) {
	t.Helper()

	dir := newTagTestRepo(t)
	runGit(t, dir, "checkout", "-q", "-B", branch)

	binaryReleases := filepath.Join(dir, "binary-releases")
	if err := os.MkdirAll(binaryReleases, 0755); err != nil {
		t.Fatal(err)
	}
	for name, contents := range map[string]string{"version": "1.3.0", "ls-protocol-version-1": ""} {
		if err := os.WriteFile(filepath.Join(binaryReleases, name), []byte(contents), 0644); err != nil {
			t.Fatal(err)
		}
	}

	fakeBin := t.TempDir()
	logDir := t.TempDir()
	for _, tool := range []string{"gh", "npm"} {
		script := "#!/usr/bin/env bash\necho \"$*\" >> \"" + filepath.Join(logDir, tool+".log") + "\"\n"
		if err := os.WriteFile(filepath.Join(fakeBin, tool), []byte(script), 0755); err != nil {
			t.Fatal(err)
		}
	}

	cmd := exec.Command(repoPath(t, "release-scripts", "upload-artifacts.sh"), args...)
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(), "PATH="+fakeBin+":"+os.Getenv("PATH"), "CIRCLE_SHA1=deadbeef")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("upload-artifacts.sh %v on %s failed: %v\n%s", args, branch, err, output)
	}

	readLog := func(tool string) []string {
		contents, err := os.ReadFile(filepath.Join(logDir, tool+".log"))
		if os.IsNotExist(err) {
			return nil
		}
		if err != nil {
			t.Fatal(err)
		}
		return strings.Split(strings.TrimSpace(string(contents)), "\n")
	}
	return readLog("gh"), readLog("npm")
}

func TestUploadArtifactsGithubPrereleaseFlagPerChannel(t *testing.T) {
	testCases := []struct {
		branch         string
		wantPrerelease bool
	}{
		{branch: "main", wantPrerelease: true},
		{branch: "release-candidate", wantPrerelease: true},
		{branch: "chore/some-feature", wantPrerelease: true},
		{branch: "release/1.3", wantPrerelease: false},
	}

	for _, tc := range testCases {
		for _, dryRun := range []bool{false, true} {
			name := tc.branch
			args := []string{"github"}
			if dryRun {
				name += " dry-run"
				args = []string{"--dry-run", "github"}
			}
			t.Run(name, func(t *testing.T) {
				gh, _ := runUploadArtifacts(t, tc.branch, args...)

				var create string
				for _, line := range gh {
					if strings.HasPrefix(line, "release create") {
						create = line
					}
				}
				if create == "" {
					t.Fatalf("expected a gh release create call, got %q", gh)
				}
				if !strings.HasPrefix(create, "release create v1.3.0 ") {
					t.Fatalf("expected release for tag v1.3.0, got %q", create)
				}
				if !strings.Contains(create, "--target deadbeef") {
					t.Fatalf("expected --target deadbeef, got %q", create)
				}
				if got := strings.Contains(create, "--prerelease"); got != tc.wantPrerelease {
					t.Fatalf("--prerelease present = %v, want %v: %q", got, tc.wantPrerelease, create)
				}
				if got := strings.Contains(create, "--draft"); got != dryRun {
					t.Fatalf("--draft present = %v, want %v: %q", got, dryRun, create)
				}
				if dryRun && gh[len(gh)-1] != "release delete v1.3.0 --yes" {
					t.Fatalf("expected the dry-run draft to be deleted, got %q", gh)
				}
			})
		}
	}
}

func TestUploadArtifactsNpmTagPerChannel(t *testing.T) {
	testCases := []struct {
		branch  string
		wantTag string
	}{
		{branch: "main", wantTag: "--tag preview"},
		{branch: "release-candidate", wantTag: "--tag rc"},
		{branch: "chore/some-feature", wantTag: "--tag dev"},
		{branch: "release/1.3", wantTag: ""},
	}

	for _, tc := range testCases {
		t.Run(tc.branch, func(t *testing.T) {
			_, npm := runUploadArtifacts(t, tc.branch, "npm")
			if len(npm) != 3 {
				t.Fatalf("expected 3 npm publish calls, got %q", npm)
			}
			for _, line := range npm {
				if got := strings.Contains(line, "--tag"); got != (tc.wantTag != "") {
					t.Fatalf("unexpected --tag presence in %q (want %q)", line, tc.wantTag)
				}
				if tc.wantTag != "" && !strings.Contains(line, tc.wantTag) {
					t.Fatalf("expected %q in %q", tc.wantTag, line)
				}
			}
		})
	}
}
