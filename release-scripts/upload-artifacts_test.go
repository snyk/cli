package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"maps"
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

func uploadArtifacts(t *testing.T, branch string, prepare func(binaryReleases string), args ...string) (calls map[string][]string, output string, err error) {
	t.Helper()

	dir := newTagTestRepo(t)
	runGit(t, dir, "checkout", "-q", "-B", branch)

	binaryReleases := filepath.Join(dir, "binary-releases")
	if err := os.MkdirAll(binaryReleases, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binaryReleases, "version"), []byte("1.3.0"), 0644); err != nil {
		t.Fatal(err)
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
	cmd.Env = append(cmd.Environ(), "PATH="+fakeBin+":"+os.Getenv("PATH"), "PUBLIC_S3_BUCKET=test-bucket")
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

func writeTestManifest(t *testing.T, binaryReleases string, channel string, artifacts map[string][]testTarget) {
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
		"meta":          map[string]string{"version": "1.3.0", "commit": "deadbeef", "releaseChannel": channel},
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

var testArtifactsVersionedOnly = map[string][]testTarget{
	"./snyk-linux": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "github"},
	},
	"./fips/snyk-linux": {
		{Type: "s3", Path: "fips/cli/v1.3.0/"},
	},
	"./snyk.tgz": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "npm"},
	},
}

func TestUploadArtifactsVersionUploadsTheManifestVersionedFolders(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
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

func TestUploadArtifactsVersionRefusesAFileThatDoesNotMatchTheManifest(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
		if err := os.WriteFile(filepath.Join(binaryReleases, "snyk.tgz"), []byte("rebuilt"), 0644); err != nil {
			t.Fatal(err)
		}
	}, "version")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh version to fail\n%s", output)
	}
	if want := "binary-releases/snyk.tgz: FAILED"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["aws"]) != 0 {
		t.Fatalf("expected no uploads, got %q", calls["aws"])
	}
}

func TestUploadArtifactsS3UploadsTheManifestNonVersionedFolders(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
	}, "s3")
	if err != nil {
		t.Fatalf("upload-artifacts.sh s3 failed: %v\n%s", err, output)
	}

	want := []string{
		"s3 cp binary-releases/fips/snyk-linux s3://test-bucket/fips/cli/stable/snyk-linux",
		"s3 cp binary-releases/snyk-linux s3://test-bucket/cli/stable/snyk-linux",
	}
	if !slices.Equal(calls["aws"], want) {
		t.Fatalf("aws calls:\n%s\nwant:\n%s", strings.Join(calls["aws"], "\n"), strings.Join(want, "\n"))
	}
}

func TestUploadArtifactsS3DryRunPassesDryrunToAWS(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
	}, "--dry-run", "s3")
	if err != nil {
		t.Fatalf("upload-artifacts.sh s3 failed: %v\n%s", err, output)
	}

	want := []string{
		"s3 cp binary-releases/fips/snyk-linux s3://test-bucket/fips/cli/stable/snyk-linux --dryrun",
		"s3 cp binary-releases/snyk-linux s3://test-bucket/cli/stable/snyk-linux --dryrun",
	}
	if !slices.Equal(calls["aws"], want) {
		t.Fatalf("aws calls:\n%s\nwant:\n%s", strings.Join(calls["aws"], "\n"), strings.Join(want, "\n"))
	}
}

func TestUploadArtifactsS3FailsWithoutNonVersionedTargets(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifactsVersionedOnly)
	}, "s3")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh s3 to fail\n%s", output)
	}
	if len(calls["aws"]) != 0 {
		t.Fatalf("expected no uploads, got %q", calls["aws"])
	}
}

func TestUploadArtifactsS3RefusesAFileThatDoesNotMatchTheManifest(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
		if err := os.WriteFile(filepath.Join(binaryReleases, "snyk-linux"), []byte("rebuilt"), 0644); err != nil {
			t.Fatal(err)
		}
	}, "s3")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh s3 to fail\n%s", output)
	}
	if want := "binary-releases/snyk-linux: FAILED"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["aws"]) != 0 {
		t.Fatalf("expected no uploads, got %q", calls["aws"])
	}
}

var testArtifactsGitHub = map[string][]testTarget{
	"./RELEASE_NOTES.md": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "github"},
	},
	"./snyk-linux": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "github"},
	},
	"./snyk-win.exe": {
		{Type: "github"},
	},
	"./fips/snyk-linux": {
		{Type: "s3", Path: "fips/cli/v1.3.0/"},
	},
	"./snyk.tgz": {
		{Type: "s3", Path: "cli/v1.3.0/"},
		{Type: "npm"},
	},
}

func TestUploadArtifactsGithubPrereleaseFlagPerChannel(t *testing.T) {
	testCases := []struct {
		branch         string
		channel        string
		wantPrerelease bool
	}{
		{branch: "release/1.3", channel: "stable", wantPrerelease: false},
		{branch: "main", channel: "preview", wantPrerelease: true},
	}

	for _, tc := range testCases {
		for _, dryRun := range []bool{false, true} {
			name := tc.channel
			args := []string{"github"}
			if dryRun {
				name += " dry-run"
				args = []string{"--dry-run", "github"}
			}
			t.Run(name, func(t *testing.T) {
				calls, output, err := uploadArtifacts(t, tc.branch, func(binaryReleases string) {
					writeTestManifest(t, binaryReleases, tc.channel, testArtifactsGitHub)
				}, args...)
				if err != nil {
					t.Fatalf("upload-artifacts.sh %v failed: %v\n%s", args, err, output)
				}

				wantCreate := "release create v1.3.0 binary-releases/snyk-linux binary-releases/snyk-win.exe"
				if dryRun {
					wantCreate += " --draft"
				}
				if tc.wantPrerelease {
					wantCreate += " --prerelease"
				}
				wantCreate += " --target deadbeef --title v1.3.0 --notes-file binary-releases/RELEASE_NOTES.md"
				want := []string{wantCreate}
				if dryRun {
					want = append(want, "release delete v1.3.0 --yes")
				}
				if !slices.Equal(calls["gh"], want) {
					t.Fatalf("gh calls:\n%s\nwant:\n%s", strings.Join(calls["gh"], "\n"), strings.Join(want, "\n"))
				}

				wantPrereleaseSummary := "false"
				if tc.wantPrerelease {
					wantPrereleaseSummary = "--prerelease"
				}
				wantSummary := fmt.Sprintf("GitHub release v1.3.0 at deadbeef (channel: %s, prerelease?: %s)\nAssets:\n  snyk-linux\n  snyk-win.exe\n", tc.channel, wantPrereleaseSummary)
				if !strings.Contains(output, wantSummary) {
					t.Fatalf("expected %q in the output:\n%s", wantSummary, output)
				}
			})
		}
	}
}

func TestUploadArtifactsGithubRefusesAFileThatDoesNotMatchTheManifest(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifactsGitHub)
		if err := os.WriteFile(filepath.Join(binaryReleases, "snyk-win.exe"), []byte("rebuilt"), 0644); err != nil {
			t.Fatal(err)
		}
	}, "github")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh github to fail\n%s", output)
	}
	if want := "binary-releases/snyk-win.exe: FAILED"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["gh"]) != 0 {
		t.Fatalf("expected no gh calls, got %q", calls["gh"])
	}
}

func TestUploadArtifactsGithubNeedsReleaseNotesWithAGithubTarget(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", testArtifacts)
	}, "github")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh github to fail\n%s", output)
	}
	if want := "The manifest has no RELEASE_NOTES.md with a github target"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["gh"]) != 0 {
		t.Fatalf("expected no gh calls, got %q", calls["gh"])
	}
}

func TestUploadArtifactsGithubRefusesAnAssetInAFolder(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		artifacts := maps.Clone(testArtifactsGitHub)
		artifacts["./fips/snyk-linux"] = append(slices.Clone(artifacts["./fips/snyk-linux"]), testTarget{Type: "github"})
		writeTestManifest(t, binaryReleases, "stable", artifacts)
	}, "github")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh github to fail\n%s", output)
	}

	if want := "GitHub release assets can't be in a folder: ./fips/snyk-linux"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["gh"]) != 0 {
		t.Fatalf("expected no gh calls, got %q", calls["gh"])
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

func TestUploadArtifactsRejectsMissingAndUnknownArguments(t *testing.T) {
	testCases := []struct {
		name      string
		args      []string
		wantError string
	}{
		{name: "no arguments", args: nil, wantError: "No upload target defined!"},
		{name: "unknown argument", args: []string{"bogus"}, wantError: "Invalid argument: bogus"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			calls, output, err := uploadArtifacts(t, "release/1.3", nil, tc.args...)
			if err == nil {
				t.Fatalf("expected upload-artifacts.sh %v to fail\n%s", tc.args, output)
			}
			if !strings.Contains(output, tc.wantError) {
				t.Fatalf("expected %q in the output:\n%s", tc.wantError, output)
			}
			if wantUsage := "Usage: upload-artifacts.sh"; !strings.Contains(output, wantUsage) {
				t.Fatalf("expected %q in the output:\n%s", wantUsage, output)
			}
			if len(calls["aws"]) != 0 {
				t.Fatalf("expected no uploads, got %q", calls["aws"])
			}
		})
	}
}
