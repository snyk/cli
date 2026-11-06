package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"
)

// runUploadArtifacts runs upload-artifacts.sh on the given branch with fake gh and npm binaries
// that record their arguments. It returns the recorded gh and npm invocations, one per line.
func runUploadArtifacts(t *testing.T, branch string, args ...string) (gh []string, npm []string) {
	t.Helper()

	calls, output, err := uploadArtifacts(t, branch, nil, args...)
	if err != nil {
		t.Fatalf("upload-artifacts.sh %v on %s failed: %v\n%s", args, branch, err, output)
	}
	return calls["gh"], calls["npm"]
}

// uploadArtifacts runs upload-artifacts.sh on the given branch with fake gh, npm and aws binaries
// that record their arguments. prepare, if set, fills binary-releases before the run.
func uploadArtifacts(t *testing.T, branch string, prepare func(binaryReleases string), args ...string) (calls map[string][]string, output string, err error) {
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

	if prepare != nil {
		prepare(binaryReleases)
	}

	fakeBin := t.TempDir()
	logDir := t.TempDir()
	tools := []string{"gh", "npm", "aws"}
	for _, tool := range tools {
		script := "#!/usr/bin/env bash\necho \"$*\" >> \"" + filepath.Join(logDir, tool+".log") + "\"\n"
		if err := os.WriteFile(filepath.Join(fakeBin, tool), []byte(script), 0755); err != nil {
			t.Fatal(err)
		}
	}

	cmd := exec.Command(repoPath(t, "release-scripts", "upload-artifacts.sh"), args...)
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(), "PATH="+fakeBin+":"+os.Getenv("PATH"), "CIRCLE_SHA1=deadbeef", "PUBLIC_S3_BUCKET=test-bucket")
	out, err := cmd.CombinedOutput()

	calls = map[string][]string{}
	for _, tool := range tools {
		contents, readErr := os.ReadFile(filepath.Join(logDir, tool+".log"))
		if os.IsNotExist(readErr) {
			continue
		}
		if readErr != nil {
			t.Fatal(readErr)
		}
		calls[tool] = strings.Split(strings.TrimSpace(string(contents)), "\n")
	}
	return calls, string(out), err
}

type testTarget struct {
	Type string `json:"type"`
	Path string `json:"path,omitempty"`
}

// writeTestManifest writes a file for each artifact and an artifacts-manifest.json that lists them
// with their sha256, the way the artifacts-manifest Build fills it in.
func writeTestManifest(t *testing.T, binaryReleases, version, commit string, artifacts map[string][]testTarget) {
	t.Helper()

	type artifact struct {
		Name    string       `json:"name"`
		SHA256  string       `json:"sha256"`
		Targets []testTarget `json:"targets"`
	}
	var listed []artifact
	for name, targets := range artifacts {
		contents := []byte("contents of " + name)
		file := filepath.Join(binaryReleases, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(file, contents, 0644); err != nil {
			t.Fatal(err)
		}
		listed = append(listed, artifact{Name: name, SHA256: fmt.Sprintf("%x", sha256.Sum256(contents)), Targets: targets})
	}
	sort.Slice(listed, func(i, j int) bool { return listed[i].Name < listed[j].Name })

	manifest, err := json.Marshal(map[string]any{
		"schemaVersion": 1,
		"meta":          map[string]string{"version": version, "commit": commit, "releaseChannel": "stable"},
		"artifacts":     listed,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binaryReleases, "artifacts-manifest.json"), manifest, 0644); err != nil {
		t.Fatal(err)
	}
}

var testArtifacts = map[string][]testTarget{
	"./snyk-linux": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "s3", Path: "cli/stable/"},
		{Type: "github"},
	},
	"./fips/snyk-linux": {
		{Type: "s3", Path: "fips/cli/v1.3.0/"},
		{Type: "s3", Path: "fips/cli/stable/"},
	},
	"./snyk.tgz": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "npm"},
	},
}

func TestUploadArtifactsVersionUploadsTheManifestVersionedFolders(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "1.3.0", "deadbeef", testArtifacts)
	}, "version")
	if err != nil {
		t.Fatalf("upload-artifacts.sh version failed: %v\n%s", err, output)
	}

	want := []string{
		"s3 cp binary-releases/fips/snyk-linux s3://test-bucket/fips/cli/v1.3.0/snyk-linux",
		"s3 cp binary-releases/snyk-linux s3://test-bucket/cli/v1.3.0/snyk-linux",
		"s3 cp binary-releases/snyk.tgz s3://test-bucket/cli/v1.3.0/snyk.tgz",
	}
	if !slices.Equal(calls["aws"], want) {
		t.Fatalf("aws calls:\n%s\nwant:\n%s", strings.Join(calls["aws"], "\n"), strings.Join(want, "\n"))
	}
}

func TestUploadArtifactsVersionRefusesABuildTheManifestDoesNotDescribe(t *testing.T) {
	testCases := []struct {
		name     string
		prepare  func(t *testing.T, binaryReleases string)
		wantText string
	}{
		{
			name: "a changed artifact",
			prepare: func(t *testing.T, binaryReleases string) {
				writeTestManifest(t, binaryReleases, "1.3.0", "deadbeef", testArtifacts)
				if err := os.WriteFile(filepath.Join(binaryReleases, "fips", "snyk-linux"), []byte("rebuilt"), 0644); err != nil {
					t.Fatal(err)
				}
			},
			wantText: "./fips/snyk-linux: FAILED",
		},
		{
			name: "another version",
			prepare: func(t *testing.T, binaryReleases string) {
				writeTestManifest(t, binaryReleases, "1.2.0", "deadbeef", testArtifacts)
			},
			wantText: "is for version 1.2.0, but binary-releases/version is 1.3.0",
		},
		{
			name: "another commit",
			prepare: func(t *testing.T, binaryReleases string) {
				writeTestManifest(t, binaryReleases, "1.3.0", "cafef00d", testArtifacts)
			},
			wantText: "is for commit cafef00d, but this build is deadbeef",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
				tc.prepare(t, binaryReleases)
			}, "version")
			if err == nil {
				t.Fatalf("expected upload-artifacts.sh version to fail\n%s", output)
			}
			if !strings.Contains(output, tc.wantText) {
				t.Fatalf("expected %q in the output:\n%s", tc.wantText, output)
			}
			if len(calls["aws"]) != 0 {
				t.Fatalf("expected no uploads, got %q", calls["aws"])
			}
		})
	}
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
