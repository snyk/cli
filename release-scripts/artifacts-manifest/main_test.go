package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/snyk/cli/release-scripts/manifest"
)

const testVersion = "1.2.3"

func repoTemplate(t *testing.T) []byte {
	t.Helper()
	content, err := os.ReadFile(filepath.Join("..", "artifacts-manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	return content
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	p := filepath.Join(dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func sum(content string) string {
	s := sha256.Sum256([]byte(content))
	return hex.EncodeToString(s[:])
}

func buildOutput(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	var template manifest.Manifest
	if err := json.Unmarshal(repoTemplate(t), &template); err != nil {
		t.Fatal(err)
	}
	for _, a := range template.Artifacts {
		name := strings.TrimPrefix(a.Name, "./")
		writeFile(t, dir, name, name)
		if strings.HasSuffix(name, ".tgz") {
			writeFile(t, dir, name+".sha256", "not uploaded")
		}
	}
	return dir
}

func build(template []byte, dir, channel string) (*manifest.Manifest, error) {
	return Build(template, dir, testVersion, "abc123", channel)
}

func targetPaths(a manifest.Artifact) []string {
	var paths []string
	for _, t := range a.Targets {
		if t.Type == manifest.TargetS3 {
			paths = append(paths, t.Path)
		}
	}
	return paths
}

func find(t *testing.T, m *manifest.Manifest, name string) manifest.Artifact {
	t.Helper()
	for _, a := range m.Artifacts {
		if a.Name == name {
			return a
		}
	}
	t.Fatalf("%s is not in the manifest", name)
	return manifest.Artifact{}
}

func TestBuildFillsEverythingIn(t *testing.T) {
	dir := buildOutput(t)
	m, err := build(repoTemplate(t), dir, "preview")
	if err != nil {
		t.Fatal(err)
	}

	if m.Meta != (manifest.Meta{Version: testVersion, Commit: "abc123", ReleaseChannel: "preview"}) {
		t.Errorf("unexpected meta %+v", m.Meta)
	}
	for _, a := range m.Artifacts {
		if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(a.SHA256) {
			t.Errorf("%s has sha256 %q", a.Name, a.SHA256)
		}
		if got := countVersionedTargets(a, testVersion); got != 1 {
			t.Errorf("%s has %d versioned targets", a.Name, got)
		}
	}
	encoded, _ := json.Marshal(m)
	if strings.Contains(string(encoded), "$") {
		t.Errorf("manifest still has a placeholder: %s", encoded)
	}

	linux := find(t, m, "./snyk-linux")
	if got := strings.Join(targetPaths(linux), ","); got != "cli/v1.2.3/,cli/preview/" {
		t.Errorf("unexpected s3 targets %s", got)
	}
	find(t, m, "./ls-protocol-version-25")
	find(t, m, "./experimental/snyk-linux")
}

func TestBuildDevOnlyDeploysTheVersionedFolder(t *testing.T) {
	m, err := build(repoTemplate(t), buildOutput(t), "dev")
	if err != nil {
		t.Fatal(err)
	}
	if m.Meta.ReleaseChannel != "dev" {
		t.Errorf("unexpected channel %q", m.Meta.ReleaseChannel)
	}
	for _, a := range m.Artifacts {
		paths := targetPaths(a)
		if len(paths) != 1 || !versionedFolder(paths[0], testVersion) {
			t.Errorf("%s has s3 targets %v, want only the versioned folder", a.Name, paths)
		}
	}
	if got := strings.Join(targetPaths(find(t, m, "./fips/snyk-win.exe")), ","); got != "fips/cli/v1.2.3/" {
		t.Errorf("unexpected fips targets %s", got)
	}
}

func TestBuildStableAlsoDeploysToLatest(t *testing.T) {
	m, err := build(repoTemplate(t), buildOutput(t), "stable")
	if err != nil {
		t.Fatal(err)
	}
	got := strings.Join(targetPaths(find(t, m, "./fips/snyk-win.exe")), ",")
	if want := "fips/cli/v1.2.3/,fips/cli/stable/,fips/cli/latest/"; got != want {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestBuildHashesReleaseJSONLikeAnyOtherArtifact(t *testing.T) {
	dir := buildOutput(t)
	writeFile(t, dir, "release.json", `{"version":"1.2.3"}`)
	m, err := build(repoTemplate(t), dir, "preview")
	if err != nil {
		t.Fatal(err)
	}
	if got := find(t, m, "./release.json").SHA256; got != sum(`{"version":"1.2.3"}`) {
		t.Errorf("release.json sha256 is %q", got)
	}
	if got := find(t, m, "./fips/release.json").SHA256; got != sum("fips/release.json") {
		t.Errorf("fips/release.json sha256 is %q", got)
	}
}

// binary-deployments.json is the npm wrapper's list of binaries. Keeping it in step with the
// template means a binary the wrapper downloads is always one the build ships.
func TestTemplateDeclaresEveryBinaryTheWrapperDownloads(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "binary-deployments.json"))
	if err != nil {
		t.Fatal(err)
	}
	var deployments map[string]map[string]string
	if err := json.Unmarshal(content, &deployments); err != nil {
		t.Fatal(err)
	}
	var template manifest.Manifest
	if err := json.Unmarshal(repoTemplate(t), &template); err != nil {
		t.Fatal(err)
	}
	declared := map[string]bool{}
	for _, a := range template.Artifacts {
		declared[a.Name] = true
	}
	for platform, archs := range deployments {
		for arch, file := range archs {
			if !declared["./"+file] {
				t.Errorf("%s/%s downloads %s, which the template doesn't declare", platform, arch, file)
			}
		}
	}
}

func TestBuildNeedsASha256InTheTemplate(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "file", "x")
	template := `{"schemaVersion":1,"artifacts":[{"name":"./file","targets":[{"type":"s3","path":"cli/v$VERSION/"}]}]}`
	_, err := build([]byte(template), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), "has no sha256 in the template") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildFailsOnDeclaredFileMissing(t *testing.T) {
	dir := buildOutput(t)
	if err := os.Remove(filepath.Join(dir, "snyk-macos")); err != nil {
		t.Fatal(err)
	}
	_, err := build(repoTemplate(t), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), "./snyk-macos is declared but cannot be read") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildFailsOnUndeclaredFile(t *testing.T) {
	dir := buildOutput(t)
	writeFile(t, dir, "snyk-freebsd", "new binary")
	writeFile(t, dir, "snyk-freebsd.sha256", "its checksum")
	_, err := build(repoTemplate(t), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), "./snyk-freebsd was built but is not declared") {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(err.Error(), "./snyk-freebsd.sha256 was built but is not declared") {
		t.Errorf("a binary's sha256 file should need declaring too: %v", err)
	}
}

func TestBuildDeclaresTheChecksumFileOfEveryBinary(t *testing.T) {
	m, err := build(repoTemplate(t), buildOutput(t), "stable")
	if err != nil {
		t.Fatal(err)
	}
	binaries := 0
	for _, a := range m.Artifacts {
		base := filepath.Base(a.Name)
		if !strings.HasPrefix(base, "snyk-") || strings.HasSuffix(base, ".tgz") || strings.HasSuffix(base, ".sha256") {
			continue
		}
		binaries++
		checksum := find(t, m, a.Name+".sha256")
		if !reflect.DeepEqual(checksum.Targets, a.Targets) {
			t.Errorf("%s.sha256 targets %v, want the binary's %v", a.Name, checksum.Targets, a.Targets)
		}
	}
	if binaries != 12 {
		t.Errorf("found %d binaries, want 12", binaries)
	}
}

func TestBuildIgnoresTarballChecksums(t *testing.T) {
	dir := buildOutput(t)
	writeFile(t, dir, "snyk.tgz.sha256", "not uploaded")
	if _, err := build(repoTemplate(t), dir, "preview"); err != nil {
		t.Fatal(err)
	}
}

func TestBuildIgnoresUnsignedChecksumLists(t *testing.T) {
	dir := buildOutput(t)
	for _, name := range []string{"sha256sums.txt", "fips/sha256sums.txt", "experimental/sha256sums.txt"} {
		writeFile(t, dir, name, "left behind by signing")
	}
	m, err := build(repoTemplate(t), dir, "preview")
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range m.Artifacts {
		if strings.HasSuffix(a.Name, "/sha256sums.txt") {
			t.Errorf("%s should not be in the manifest", a.Name)
		}
	}
}

func TestBuildFailsOnLeftoverPlaceholder(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "file", "x")
	template := `{"schemaVersion":1,"artifacts":[{"name":"./file","targets":[{"type":"s3","path":"cli/v$VERSION/"},{"type":"s3","path":"cli/$FLAVOR/"}]}]}`
	_, err := build([]byte(template), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), "placeholder $FLAVOR was not filled in") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildRequiresExactlyOneVersionedTarget(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "file", "x")
	template := `{"schemaVersion":1,"artifacts":[{"name":"./file","targets":[{"type":"s3","path":"cli/$CHANNEL/"},{"type":"github"}]}]}`
	_, err := build([]byte(template), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), "needs exactly one versioned s3 target") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildRejectsPathsOutsideTheBuildOutput(t *testing.T) {
	template := `{"schemaVersion":1,"artifacts":[{"name":"./../secret","targets":[{"type":"s3","path":"cli/v$VERSION/"}]}]}`
	_, err := build([]byte(template), t.TempDir(), "preview")
	if err == nil || !strings.Contains(err.Error(), "points outside the build output") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildRejectsReleaseJSONAsATargetType(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "file", "x")
	template := `{"schemaVersion":1,"artifacts":[{"name":"./file","sha256":"$SHASUM","targets":[{"type":"s3","path":"cli/v$VERSION/"},{"type":"release.json"}]}]}`
	_, err := build([]byte(template), dir, "preview")
	if err == nil || !strings.Contains(err.Error(), `unknown target type "release.json"`) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildRejectsUnknownTemplateFields(t *testing.T) {
	template := `{"schemaVersion":1,"artifacts":[{"name":"./file","tragets":[]}]}`
	_, err := build([]byte(template), t.TempDir(), "preview")
	if err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("unexpected error: %v", err)
	}
}
