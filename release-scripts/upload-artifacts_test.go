package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
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
		if tool == "npm" {
			script += fakeNpmViewBehaviour
		}
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

// fakeNpmViewBehaviour lets a test script "npm view <spec>" through files in
// binary-releases/fake-npm-view named after the spec (with "/" replaced by "_"):
// <spec>.out is stdout, <spec>.stderr is stderr and <spec>.exit is the exit code.
const fakeNpmViewBehaviour = `if [ "$1" = view ]; then
  f="binary-releases/fake-npm-view/${2//\//_}"
  [ -f "$f.stderr" ] && cat "$f.stderr" >&2
  [ -f "$f.out" ] && cat "$f.out"
  [ -f "$f.exit" ] && exit "$(cat "$f.exit")"
fi
exit 0
`

func fakeNpmView(t *testing.T, binaryReleases, spec, stdout, stderr string, exitCode int) {
	t.Helper()

	dir := filepath.Join(binaryReleases, "fake-npm-view")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	base := filepath.Join(dir, strings.ReplaceAll(spec, "/", "_"))
	for suffix, contents := range map[string]string{".out": stdout, ".stderr": stderr, ".exit": fmt.Sprint(exitCode)} {
		if err := os.WriteFile(base+suffix, []byte(contents), 0644); err != nil {
			t.Fatal(err)
		}
	}
}

func npmTarball(t *testing.T, name, version string) []byte {
	t.Helper()

	manifest := fmt.Sprintf(`{"name":%q,"version":%q}`, name, version)
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{Name: "package/package.json", Mode: 0644, Size: int64(len(manifest))}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write([]byte(manifest)); err != nil {
		t.Fatal(err)
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// writeNpmManifest writes a manifest with the three npm tarballs (snyk.tgz is the last entry)
// and one binary that has no npm target.
func writeNpmManifest(t *testing.T, binaryReleases, channel string) {
	t.Helper()

	packages := map[string]string{"./snyk-fix.tgz": "@snyk/fix", "./snyk-protect.tgz": "@snyk/protect", "./snyk.tgz": "snyk"}
	artifacts := map[string][]testTarget{"./snyk-linux": {{Type: "s3", Path: "cli/v1.3.0/"}, {Type: "github"}}}
	contents := map[string][]byte{}
	for file, name := range packages {
		artifacts[file] = []testTarget{{Type: "s3", Path: "cli/v1.3.0/"}, {Type: "npm"}}
		contents[file] = npmTarball(t, name, "1.3.0")
	}
	writeTestManifestWithContents(t, binaryReleases, channel, artifacts, contents)
}

type testTarget struct {
	Type string `json:"type"`
	Path string `json:"path,omitempty"`
}

func writeTestManifest(t *testing.T, binaryReleases string, channel string, artifacts map[string][]testTarget) {
	t.Helper()
	writeTestManifestWithContents(t, binaryReleases, channel, artifacts, nil)
}

func writeTestManifestWithContents(t *testing.T, binaryReleases string, channel string, artifacts map[string][]testTarget, fileContents map[string][]byte) {
	t.Helper()

	type artifact struct {
		Name    string       `json:"name"`
		SHA256  string       `json:"sha256"`
		Targets []testTarget `json:"targets"`
	}
	var listed []artifact
	for name, targets := range artifacts {
		contents, ok := fileContents[name]
		if !ok {
			contents = []byte("contents of " + name)
		}
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

func npmPublishLines(npm []string) []string {
	var publishes []string
	for _, line := range npm {
		if strings.HasPrefix(line, "publish") {
			publishes = append(publishes, line)
		}
	}
	return publishes
}

func TestUploadArtifactsNpmTagPerChannelFollowsTheManifest(t *testing.T) {
	testCases := []struct {
		channel string
		tag     string
	}{
		{channel: "preview", tag: " --tag preview"},
		{channel: "rc", tag: " --tag rc"},
		{channel: "stable", tag: ""},
	}

	for _, tc := range testCases {
		t.Run(tc.channel, func(t *testing.T) {
			// the branch says dev, the manifest decides
			calls, output, err := uploadArtifacts(t, "chore/some-feature", func(binaryReleases string) {
				writeNpmManifest(t, binaryReleases, tc.channel)
			}, "npm")
			if err != nil {
				t.Fatalf("upload-artifacts.sh npm failed: %v\n%s", err, output)
			}

			want := []string{
				"view @snyk/fix@1.3.0 version --json",
				"publish" + tc.tag + " binary-releases/snyk-fix.tgz",
				"view @snyk/protect@1.3.0 version --json",
				"publish" + tc.tag + " binary-releases/snyk-protect.tgz",
				"view snyk@1.3.0 version --json",
				"publish" + tc.tag + " binary-releases/snyk.tgz",
			}
			if !slices.Equal(calls["npm"], want) {
				t.Fatalf("npm calls:\n%s\nwant:\n%s", strings.Join(calls["npm"], "\n"), strings.Join(want, "\n"))
			}
			if want := "published snyk@1.3.0"; !strings.Contains(output, want) {
				t.Fatalf("expected %q in the output:\n%s", want, output)
			}
		})
	}
}

func TestUploadArtifactsNpmDryRunPassesDryRunToNpm(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		writeNpmManifest(t, binaryReleases, "preview")
	}, "--dry-run", "npm")
	if err != nil {
		t.Fatalf("upload-artifacts.sh --dry-run npm failed: %v\n%s", err, output)
	}

	want := []string{
		"publish --dry-run --tag preview binary-releases/snyk-fix.tgz",
		"publish --dry-run --tag preview binary-releases/snyk-protect.tgz",
		"publish --dry-run --tag preview binary-releases/snyk.tgz",
	}
	if got := npmPublishLines(calls["npm"]); !slices.Equal(got, want) {
		t.Fatalf("npm publish calls:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	if want := "publish snyk@1.3.0"; !strings.Contains(output, want) || strings.Contains(output, "published") {
		t.Fatalf("expected %q and no \"published\" in the output:\n%s", want, output)
	}
}

func TestUploadArtifactsNpmSkipsVersionsNpmAlreadyHas(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		writeNpmManifest(t, binaryReleases, "preview")
		fakeNpmView(t, binaryReleases, "@snyk/fix@1.3.0", `"1.3.0"`, "", 0)
		fakeNpmView(t, binaryReleases, "@snyk/protect@1.3.0", `"1.3.0"`, "", 0)
	}, "npm")
	if err != nil {
		t.Fatalf("upload-artifacts.sh npm failed: %v\n%s", err, output)
	}

	want := []string{"publish --tag preview binary-releases/snyk.tgz"}
	if got := npmPublishLines(calls["npm"]); !slices.Equal(got, want) {
		t.Fatalf("npm publish calls:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	if want := "skip @snyk/fix@1.3.0"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
}

func TestUploadArtifactsNpmPublishesWhenNpmViewReportsE404(t *testing.T) {
	e404 := `{"error":{"code":"E404","summary":"Not Found"}}`
	testCases := []struct {
		name   string
		stdout string
		stderr string
	}{
		{name: "on stdout", stdout: e404},
		{name: "on stderr", stderr: e404},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
				writeNpmManifest(t, binaryReleases, "preview")
				fakeNpmView(t, binaryReleases, "snyk@1.3.0", tc.stdout, tc.stderr, 1)
			}, "npm")
			if err != nil {
				t.Fatalf("upload-artifacts.sh npm failed: %v\n%s", err, output)
			}
			if got := npmPublishLines(calls["npm"]); len(got) != 3 {
				t.Fatalf("expected 3 npm publish calls, got %q", got)
			}
		})
	}
}

func TestUploadArtifactsNpmStopsWhenNpmViewFailsForAnotherReason(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		writeNpmManifest(t, binaryReleases, "preview")
		fakeNpmView(t, binaryReleases, "@snyk/protect@1.3.0", "", "npm error network request failed", 1)
	}, "npm")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh npm to fail\n%s", output)
	}

	want := []string{"publish --tag preview binary-releases/snyk-fix.tgz"}
	if got := npmPublishLines(calls["npm"]); !slices.Equal(got, want) {
		t.Fatalf("npm publish calls:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
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

func TestUploadArtifactsNpmRefusesATarballWithoutPackageJson(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "main", func(binaryReleases string) {
		// the default test contents are not a tarball, but the sha256 in the manifest matches
		writeTestManifest(t, binaryReleases, "preview", map[string][]testTarget{
			"./snyk.tgz": {{Type: "npm"}},
		})
	}, "npm")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh npm to fail\n%s", output)
	}
	if want := "cannot read package/package.json from binary-releases/snyk.tgz"; !strings.Contains(output, want) {
		t.Fatalf("expected %q in the output:\n%s", want, output)
	}
	if len(calls["npm"]) != 0 {
		t.Fatalf("expected no npm calls, got %q", calls["npm"])
	}
}

func TestUploadArtifactsNpmRejectsChannelsNpmDoesNotTake(t *testing.T) {
	calls, output, err := uploadArtifacts(t, "release/1.3", func(binaryReleases string) {
		writeNpmManifest(t, binaryReleases, "dev")
	}, "npm")
	if err == nil {
		t.Fatalf("expected upload-artifacts.sh npm to fail\n%s", output)
	}
	if want := `release channel "dev"`; !strings.Contains(output, want) {
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
