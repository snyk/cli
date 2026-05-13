package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestGetGoreleaserYAMLUsesLocalSnykLSReplace(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "cliv2")
	replacedDir := filepath.Join(tempDir, "snyk-ls")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	goModPath := filepath.Join(moduleDir, "go.mod")
	if err := os.WriteFile(goModPath, goMod, 0644); err != nil {
		t.Fatal(err)
	}

	goreleaserYAML := []byte(`env:
  - LS_PROTOCOL_VERSION=123
`)
	if err := os.WriteFile(filepath.Join(replacedDir, ".goreleaser.yaml"), goreleaserYAML, 0644); err != nil {
		t.Fatal(err)
	}

	originalReplacementResolver := resolveCommitHashFromDir
	t.Cleanup(func() {
		resolveCommitHashFromDir = originalReplacementResolver
	})
	resolveCommitHashFromDir = func(dir string) (string, error) {
		return "replacement123", nil
	}

	protocolVersion, err := getGoreleaserYAMLWithGoMod("commit-is-ignored", goModPath)
	if err != nil {
		t.Fatalf("expected protocol version from replacement: %v", err)
	}
	if protocolVersion != 123 {
		t.Fatalf("expected protocol version 123, got %d", protocolVersion)
	}
}

func TestWriteLSProtocolVersionMetadataUsesReplacementAndLogsSource(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "cliv2")
	replacedDir := filepath.Join(tempDir, "snyk-ls")
	outputDir := filepath.Join(tempDir, "output")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}
	goreleaserYAML := []byte(`env:
  - LS_PROTOCOL_VERSION=456
`)
	if err := os.WriteFile(filepath.Join(replacedDir, ".goreleaser.yaml"), goreleaserYAML, 0644); err != nil {
		t.Fatal(err)
	}

	t.Chdir(moduleDir)
	var log bytes.Buffer
	commitHashFile := filepath.Join(tempDir, "ls-commit-hash")

	originalReplacementResolver := resolveCommitHashFromDir
	t.Cleanup(func() {
		resolveCommitHashFromDir = originalReplacementResolver
	})
	resolveCommitHashFromDir = func(dir string) (string, error) {
		if dir != replacedDir {
			t.Fatalf("expected replacement commit hash to be resolved from %q, got %q", replacedDir, dir)
		}
		return "replacement123", nil
	}

	protocolVersion, err := writeLSProtocolVersionMetadata("9.9.9", outputDir, commitHashFile, &log)
	if err != nil {
		t.Fatalf("expected metadata to be written from replacement: %v", err)
	}
	if protocolVersion != 456 {
		t.Fatalf("expected protocol version 456, got %d", protocolVersion)
	}

	outputFile := filepath.Join(outputDir, "ls-protocol-version-456")
	contents, err := os.ReadFile(outputFile)
	if err != nil {
		t.Fatalf("expected output file to be written: %v", err)
	}
	if string(contents) != "9.9.9" {
		t.Fatalf("expected output file to contain CLI version, got %q", string(contents))
	}
	commitHash, err := os.ReadFile(commitHashFile)
	if err != nil {
		t.Fatalf("expected commit hash file to be written: %v", err)
	}
	if string(commitHash) != "replacement123" {
		t.Fatalf("expected replacement commit hash, got %q", commitHash)
	}

	logOutput := log.String()
	if !strings.Contains(logOutput, "replaced snyk-ls path") || !strings.Contains(logOutput, filepath.Join(replacedDir, ".goreleaser.yaml")) {
		t.Fatalf("expected log to identify replacement source, got %q", logOutput)
	}
}

func TestReplacementGoreleaserFailureDoesNotFallBackToCommitResolution(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "cliv2")
	replacedDir := filepath.Join(tempDir, "snyk-ls")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	goModPath := filepath.Join(moduleDir, "go.mod")
	if err := os.WriteFile(goModPath, goMod, 0644); err != nil {
		t.Fatal(err)
	}

	_, err := getGoreleaserYAMLWithGoMod("commit-should-not-be-used", goModPath)
	if err == nil {
		t.Fatal("expected missing replacement .goreleaser.yaml to fail")
	}

	errorMessage := err.Error()
	if !strings.Contains(errorMessage, "replaced snyk-ls path") || !strings.Contains(errorMessage, ".goreleaser.yaml") {
		t.Fatalf("expected replacement-specific goreleaser error, got %q", errorMessage)
	}
	if strings.Contains(errorMessage, "go install") || strings.Contains(errorMessage, "commit-should-not-be-used") {
		t.Fatalf("expected no commit-hash fallback, got %q", errorMessage)
	}
}

func TestWriteLSProtocolVersionMetadataFallsBackToCommitResolutionWhenNoReplaceExists(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "cliv2")
	outputDir := filepath.Join(tempDir, "output")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-abcdef123456
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}

	originalResolver := resolveLSProtocolVersionFromCommit
	t.Cleanup(func() {
		resolveLSProtocolVersionFromCommit = originalResolver
	})

	var resolvedCommit string
	resolveLSProtocolVersionFromCommit = func(commit string) (lsProtocolVersion, error) {
		resolvedCommit = commit
		return lsProtocolVersion{
			version: 789,
			source:  "commit-hash-based resolution from test",
		}, nil
	}

	t.Chdir(moduleDir)
	var log bytes.Buffer

	commitHashFile := filepath.Join(tempDir, "ls-commit-hash")
	protocolVersion, err := writeLSProtocolVersionMetadata("8.8.8", outputDir, commitHashFile, &log)
	if err != nil {
		t.Fatalf("expected metadata to be written from commit fallback: %v", err)
	}
	if protocolVersion != 789 {
		t.Fatalf("expected protocol version 789, got %d", protocolVersion)
	}
	if resolvedCommit != "abcdef123456" {
		t.Fatalf("expected commit resolver to use commit hash, got %q", resolvedCommit)
	}
	commitHash, err := os.ReadFile(commitHashFile)
	if err != nil {
		t.Fatalf("expected commit hash file to be written: %v", err)
	}
	if string(commitHash) != "abcdef123456" {
		t.Fatalf("expected commit hash file to contain dependency commit, got %q", commitHash)
	}

	outputFile := filepath.Join(outputDir, "ls-protocol-version-789")
	contents, err := os.ReadFile(outputFile)
	if err != nil {
		t.Fatalf("expected output file to be written: %v", err)
	}
	if string(contents) != "8.8.8" {
		t.Fatalf("expected output file to contain CLI version, got %q", string(contents))
	}

	if !strings.Contains(log.String(), "commit-hash-based resolution") {
		t.Fatalf("expected log to identify commit source, got %q", log.String())
	}
}

func TestSnykLSReplacementDirReturnsFalseWhenNoReplaceExists(t *testing.T) {
	tempDir := t.TempDir()
	goModPath := filepath.Join(tempDir, "go.mod")
	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91
`)
	if err := os.WriteFile(goModPath, goMod, 0644); err != nil {
		t.Fatal(err)
	}

	_, ok, err := snykLSReplacementDir(goModPath)
	if err != nil {
		t.Fatalf("expected no error when replace is absent: %v", err)
	}
	if ok {
		t.Fatal("expected no replacement to be found")
	}
}

func TestCurrentGoModPathFindsGoModFromWorkingDirectory(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "cliv2")
	nestedDir := filepath.Join(moduleDir, "nested")
	if err := os.MkdirAll(nestedDir, 0755); err != nil {
		t.Fatal(err)
	}

	goModPath := filepath.Join(moduleDir, "go.mod")
	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26
`)
	if err := os.WriteFile(goModPath, goMod, 0644); err != nil {
		t.Fatal(err)
	}

	t.Chdir(nestedDir)

	actual, err := currentGoModPath()
	if err != nil {
		t.Fatalf("expected go.mod path from working directory: %v", err)
	}
	if actual != goModPath {
		t.Fatalf("expected %q, got %q", goModPath, actual)
	}
}

func TestGenerateLSProtocolMetadataFailsWhenReplacementGoreleaserIsMissing(t *testing.T) {
	tempDir := t.TempDir()
	rootDir := filepath.Join(tempDir, "cli")
	moduleDir := filepath.Join(rootDir, "cliv2")
	releaseScriptsDir := filepath.Join(rootDir, "release-scripts")
	binDir := filepath.Join(tempDir, "bin")
	replacedDir := filepath.Join(rootDir, "snyk-ls")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(releaseScriptsDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(binDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binDir, "version"), []byte("9.9.9"), 0644); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}
	copyReleaseScriptForMakefileTest(t, releaseScriptsDir)

	cmd := exec.Command("make", "-f", repoPath(t, "cliv2", "Makefile"), "-C", moduleDir, "generate-ls-protocol-metadata", "bindir="+binDir)
	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("expected make target to fail when replacement .goreleaser.yaml is missing; output:\n%s", output)
	}

	outputString := string(output)
	if !strings.Contains(outputString, "replaced snyk-ls path") || !strings.Contains(outputString, ".goreleaser.yaml") {
		t.Fatalf("expected replacement-specific goreleaser error, got:\n%s", outputString)
	}
	if strings.Contains(outputString, "LS protocol version: Failed") {
		t.Fatalf("expected failure before printing an invalid protocol version, got:\n%s", outputString)
	}
}

func TestGenerateLSProtocolMetadataPrintsNumericProtocolVersion(t *testing.T) {
	tempDir := t.TempDir()
	rootDir := filepath.Join(tempDir, "cli")
	moduleDir := filepath.Join(rootDir, "cliv2")
	releaseScriptsDir := filepath.Join(rootDir, "release-scripts")
	binDir := filepath.Join(tempDir, "bin")
	replacedDir := filepath.Join(rootDir, "snyk-ls")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(releaseScriptsDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(binDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binDir, "version"), []byte("9.9.9"), 0644); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}
	goreleaserYAML := []byte(`env:
  - LS_PROTOCOL_VERSION=321
`)
	if err := os.WriteFile(filepath.Join(replacedDir, ".goreleaser.yaml"), goreleaserYAML, 0644); err != nil {
		t.Fatal(err)
	}
	expectedCommitHash := initGitRepo(t, replacedDir)
	copyReleaseScriptForMakefileTest(t, releaseScriptsDir)

	cmd := exec.Command("make", "-f", repoPath(t, "cliv2", "Makefile"), "-C", moduleDir, "generate-ls-protocol-metadata", "bindir="+binDir)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected make target to succeed: %v\n%s", err, output)
	}

	outputString := string(output)
	if !strings.Contains(outputString, "LS protocol version: 321") {
		t.Fatalf("expected numeric LS protocol version in output, got:\n%s", outputString)
	}

	metadata, err := os.ReadFile(filepath.Join(binDir, "ls-protocol-version-321"))
	if err != nil {
		t.Fatalf("expected protocol metadata file to be written: %v", err)
	}
	if string(metadata) != "9.9.9" {
		t.Fatalf("expected metadata file to contain CLI version, got %q", metadata)
	}
	commitHash, err := os.ReadFile(filepath.Join(moduleDir, "_cache", "ls-commit-hash"))
	if err != nil {
		t.Fatalf("expected LS commit hash cache file to be written: %v", err)
	}
	if string(commitHash) != expectedCommitHash {
		t.Fatalf("expected LS commit hash %q, got %q", expectedCommitHash, commitHash)
	}
}

func TestGenerateLSProtocolMetadataUsesHostGoPlatformForAlpineTarget(t *testing.T) {
	tempDir := t.TempDir()
	rootDir := filepath.Join(tempDir, "cli")
	moduleDir := filepath.Join(rootDir, "cliv2")
	releaseScriptsDir := filepath.Join(rootDir, "release-scripts")
	binDir := filepath.Join(tempDir, "bin")
	replacedDir := filepath.Join(rootDir, "snyk-ls")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(releaseScriptsDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(binDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binDir, "version"), []byte("9.9.9"), 0644); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}
	goreleaserYAML := []byte(`env:
  - LS_PROTOCOL_VERSION=432
`)
	if err := os.WriteFile(filepath.Join(replacedDir, ".goreleaser.yaml"), goreleaserYAML, 0644); err != nil {
		t.Fatal(err)
	}
	expectedCommitHash := initGitRepo(t, replacedDir)
	copyReleaseScriptForMakefileTest(t, releaseScriptsDir)

	cmd := exec.Command(
		"make",
		"-f", repoPath(t, "cliv2", "Makefile"),
		"-C", moduleDir,
		"generate-ls-protocol-metadata",
		"bindir="+binDir,
		"GOOS=alpine",
		"GOARCH=arm64",
		"GOHOSTOS="+runtime.GOOS,
		"GOHOSTARCH="+runtime.GOARCH,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected metadata generation to use host GOOS/GOARCH for alpine target: %v\n%s", err, output)
	}

	outputString := string(output)
	if strings.Contains(outputString, "unsupported GOOS/GOARCH pair alpine/arm64") {
		t.Fatalf("expected host platform go run, got target platform failure:\n%s", outputString)
	}
	if !strings.Contains(outputString, "LS protocol version: 432") {
		t.Fatalf("expected LS protocol version in output, got:\n%s", outputString)
	}
	if !strings.Contains(outputString, "LS commit hash: "+expectedCommitHash) {
		t.Fatalf("expected LS commit hash in output, got:\n%s", outputString)
	}
}

func TestBuildRecipeUsesGeneratedLSMetadataInLdflags(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses a POSIX fake go wrapper; script behavior remains covered by unit tests")
	}

	tempDir := t.TempDir()
	rootDir := filepath.Join(tempDir, "cli")
	moduleDir := filepath.Join(rootDir, "cliv2")
	releaseScriptsDir := filepath.Join(rootDir, "release-scripts")
	binDir := filepath.Join(tempDir, "bin")
	replacedDir := filepath.Join(rootDir, "snyk-ls")
	fakeGoPath := filepath.Join(tempDir, "fake-go")
	fakeGoBuildLog := filepath.Join(tempDir, "fake-go-build.log")

	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(releaseScriptsDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(binDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(replacedDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(binDir, "version"), []byte("9.9.9"), 0644); err != nil {
		t.Fatal(err)
	}

	goMod := []byte(`module github.com/snyk/cli/cliv2

go 1.26

require github.com/snyk/snyk-ls v0.0.0-20260414093345-2a6d7434eb91

replace github.com/snyk/snyk-ls => ../snyk-ls
`)
	if err := os.WriteFile(filepath.Join(moduleDir, "go.mod"), goMod, 0644); err != nil {
		t.Fatal(err)
	}
	goreleaserYAML := []byte(`env:
  - LS_PROTOCOL_VERSION=654
`)
	if err := os.WriteFile(filepath.Join(replacedDir, ".goreleaser.yaml"), goreleaserYAML, 0644); err != nil {
		t.Fatal(err)
	}
	expectedCommitHash := initGitRepo(t, replacedDir)
	copyReleaseScriptForMakefileTest(t, releaseScriptsDir)
	writeFakeGo(t, fakeGoPath, fakeGoBuildLog)
	makeModuleDir, err := filepath.EvalSymlinks(moduleDir)
	if err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command(
		"make",
		"-f", repoPath(t, "cliv2", "Makefile"),
		"-C", makeModuleDir,
		filepath.Join(makeModuleDir, "_bin", "snyk_darwin_arm64"),
		"GOOS=darwin",
		"GOARCH=arm64",
		"GOCMD="+fakeGoPath,
		"bindir="+binDir,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected build recipe to succeed with fake go: %v\n%s", err, output)
	}

	outputString := string(output)
	if !strings.Contains(outputString, "Version="+expectedCommitHash) {
		t.Fatalf("expected LS commit hash in EXTRA_FLAGS, got:\n%s", outputString)
	}
	if !strings.Contains(outputString, "LsProtocolVersion=654") {
		t.Fatalf("expected LS protocol version in EXTRA_FLAGS, got:\n%s", outputString)
	}

	buildArgs, err := os.ReadFile(fakeGoBuildLog)
	if err != nil {
		t.Fatalf("expected fake go build to be called: %v", err)
	}
	if !strings.Contains(string(buildArgs), "Version="+expectedCommitHash) || !strings.Contains(string(buildArgs), "LsProtocolVersion=654") {
		t.Fatalf("expected generated LS metadata in go build args, got:\n%s", buildArgs)
	}
}

func copyReleaseScriptForMakefileTest(t *testing.T, releaseScriptsDir string) {
	t.Helper()

	contents, err := os.ReadFile(repoPath(t, "release-scripts", "write-ls-protocol-version.go"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(releaseScriptsDir, "write-ls-protocol-version.go"), contents, 0644); err != nil {
		t.Fatal(err)
	}
}

func writeFakeGo(t *testing.T, fakeGoPath string, fakeGoBuildLog string) {
	t.Helper()

	realGo, err := exec.LookPath("go")
	if err != nil {
		t.Fatal(err)
	}

	script := "#!/bin/sh\n" +
		"if [ \"$1\" = \"run\" ]; then exec " + realGo + " \"$@\"; fi\n" +
		"if [ \"$1\" = \"build\" ]; then printf '%s\\n' \"$*\" > \"" + fakeGoBuildLog + "\"; exit 0; fi\n" +
		"exec " + realGo + " \"$@\"\n"
	if err := os.WriteFile(fakeGoPath, []byte(script), 0755); err != nil {
		t.Fatal(err)
	}
}

func initGitRepo(t *testing.T, dir string) string {
	t.Helper()

	runGit(t, dir, "init")
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("snyk-ls test repo"), 0644); err != nil {
		t.Fatal(err)
	}
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "-c", "user.email=test@example.com", "-c", "user.name=Test User", "commit", "-m", "initial")

	cmd := exec.Command("git", "-C", dir, "rev-parse", "--short=12", "HEAD")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("failed to read git commit hash: %v\n%s", err, output)
	}
	return strings.TrimSpace(string(output))
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()

	cmdArgs := append([]string{"-C", dir}, args...)
	cmd := exec.Command("git", cmdArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s failed: %v\n%s", strings.Join(args, " "), err, output)
	}
}

func repoPath(t *testing.T, elements ...string) string {
	t.Helper()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to locate current test file")
	}
	repoRoot := filepath.Dir(filepath.Dir(currentFile))
	pathElements := append([]string{repoRoot}, elements...)
	return filepath.Join(pathElements...)
}
