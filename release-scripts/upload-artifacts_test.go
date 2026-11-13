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

// writeNpmManifest writes a manifest with the three npm tarballs and one binary that has no npm target.
func writeNpmManifest(t *testing.T, binaryReleases, channel string) {
	t.Helper()

	artifacts := map[string][]testTarget{"./snyk-linux": {{Type: "s3", Path: "cli/v1.3.0/"}, {Type: "github"}}}
	for _, file := range []string{"./snyk-fix.tgz", "./snyk-protect.tgz", "./snyk.tgz"} {
		artifacts[file] = []testTarget{{Type: "s3", Path: "cli/v1.3.0/"}, {Type: "npm"}}
	}
	writeTestManifest(t, binaryReleases, channel, artifacts)
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

var testArtifactsE2E = map[string][]testTarget{
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

func TestUploadArtifactsS3UploadsNoFilesForDevChannel(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "chore/some-feature-e2e", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "dev", testArtifactsE2E)
	}, "s3")
	if err != nil {
		t.Fatalf("upload-artifacts.sh s3 failed: %v\n%s", err, output)
	}

	if len(calls["aws"]) != 0 {
		t.Fatalf("aws calls:\n%s\nwant none", strings.Join(calls["aws"], "\n"))
	}
	if want := "No non-versioned artifacts found (\"dev\" channel?)"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
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

func TestUploadArtifactsNpmPublishesTheManifestTarballsWithTagPerChannel(t *testing.T) {
	testCases := []struct {
		name    string
		channel string
		args    []string
		publish string
	}{
		{name: "preview", channel: "preview", publish: "publish --tag preview"},
		{name: "rc", channel: "rc", publish: "publish --tag rc"},
		{name: "stable has no tag", channel: "stable", publish: "publish"},
		{name: "dev is tagged like any non-stable channel", channel: "dev", publish: "publish --tag dev"},
		{name: "dry run on dev passes --dry-run and --tag dev", channel: "dev", args: []string{"--dry-run"}, publish: "publish --dry-run --tag dev"},
		{name: "dry run on stable", channel: "stable", args: []string{"--dry-run"}, publish: "publish --dry-run"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// the branch name is irrelevant, the manifest decides
			calls, output, err := uploadArtifacts(t, "chore/some-feature", func(binaryReleases string) {
				writeNpmManifest(t, binaryReleases, tc.channel)
			}, slices.Concat(tc.args, []string{"npm"})...)
			if err != nil {
				t.Fatalf("upload-artifacts.sh npm failed: %v\n%s", err, output)
			}

			want := []string{
				tc.publish + " binary-releases/snyk-fix.tgz",
				tc.publish + " binary-releases/snyk-protect.tgz",
				tc.publish + " binary-releases/snyk.tgz",
			}
			if !slices.Equal(calls["npm"], want) {
				t.Fatalf("npm calls:\n%s\nwant:\n%s", strings.Join(calls["npm"], "\n"), strings.Join(want, "\n"))
			}
		})
	}
}

func TestUploadArtifactsNpmPublishesNothingWhenTheManifestHasNoNpmTargets(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		writeTestManifest(t, binaryReleases, "stable", map[string][]testTarget{
			"./snyk-linux": {{Type: "s3", Path: "cli/v1.3.0/"}},
		})
	}, "npm")
	if err != nil {
		t.Fatalf("upload-artifacts.sh npm failed: %v\n%s", err, output)
	}
	if len(calls["npm"]) != 0 {
		t.Fatalf("expected no npm calls, got %q", calls["npm"])
	}
}

func TestUploadArtifactsNpmRefusesAFileThatDoesNotMatchTheManifest(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		writeNpmManifest(t, binaryReleases, "preview")
		if err := os.WriteFile(filepath.Join(binaryReleases, "snyk.tgz"), []byte("rebuilt"), 0644); err != nil {
			t.Fatal(err)
		}
	}, "npm")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh npm to fail\n%s", output)
	}
	if want := "binary-releases/snyk.tgz: FAILED"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["npm"]) != 0 {
		t.Fatalf("expected no npm calls, got %q", calls["npm"])
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
