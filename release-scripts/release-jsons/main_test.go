package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testVersion = "1.2.3"

// Hard-coded rather than read from the template, so a template change that drops or reorders a
// binary is caught here.
type folderSpec struct {
	dir        string // folder inside the build output, "" for the root
	s3Prefix   string // folder in the download bucket, before /v<version>/
	binaries   []string
	releaseKey string // path of the generated file inside the build output
}

var folders = []folderSpec{
	{
		dir: "", s3Prefix: "cli", releaseKey: "release.json",
		binaries: []string{
			"snyk-alpine", "snyk-alpine-arm64", "snyk-linux", "snyk-linux-arm64",
			"snyk-macos", "snyk-macos-arm64", "snyk-win.exe",
		},
	},
	{
		dir: "fips", s3Prefix: "fips/cli", releaseKey: "fips/release.json",
		binaries: []string{"snyk-linux", "snyk-linux-arm64", "snyk-win.exe"},
	},
	{
		dir: "experimental", s3Prefix: "experimental/cli", releaseKey: "experimental/release.json",
		binaries: []string{"snyk-linux", "snyk-linux-arm64"},
	},
}

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

func readFile(t *testing.T, dir, name string) string {
	t.Helper()
	content, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(name)))
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

// The hash depends on the folder, so reading another folder's checksum shows up as a mismatch.
func fakeHash(f folderSpec, binary string) string {
	return fmt.Sprintf("%064x", []byte(filepath.ToSlash(filepath.Join(f.dir, binary))))
}

// The build writes "<hash>  <name>\n" into each .sha256 file.
func checksumFileContent(f folderSpec, binary string) string {
	return fakeHash(f, binary) + "  " + binary + "\n"
}

func buildOutput(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	writeFile(t, dir, "version", testVersion+"\n")
	for _, f := range folders {
		for _, binary := range f.binaries {
			writeFile(t, dir, filepath.ToSlash(filepath.Join(f.dir, binary+".sha256")), checksumFileContent(f, binary))
		}
	}
	return dir
}

func expectedReleaseJSON(f folderSpec) string {
	var assets []string
	for _, binary := range f.binaries {
		url := fmt.Sprintf("https://downloads.snyk.io/%s/v%s/%s", f.s3Prefix, testVersion, binary)
		assets = append(assets, fmt.Sprintf(`    %q: {
      "url": %q,
      "sha256": %q,
      "sha256Url": %q
    }`, binary, url, fakeHash(f, binary)+"  "+binary, url+".sha256"))
	}
	return fmt.Sprintf("{\n  \"version\": %q,\n  \"assets\": {\n%s\n  },\n  \"schemaVersion\": 1\n}\n",
		testVersion, strings.Join(assets, ",\n"))
}

func TestGenerateWritesExactReleaseJSONForEveryFolder(t *testing.T) {
	// Arrange
	dir := buildOutput(t)

	// Act
	err := Generate(repoTemplate(t), dir)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range folders {
		if got, want := readFile(t, dir, f.releaseKey), expectedReleaseJSON(f); got != want {
			t.Errorf("%s differs\n got: %s\nwant: %s", f.releaseKey, got, want)
		}
	}
}

func TestGenerateWritesNothingWhenAnyFolderCannotBeBuilt(t *testing.T) {
	// Arrange
	dir := buildOutput(t)
	if err := os.Remove(filepath.Join(dir, "fips", "snyk-win.exe.sha256")); err != nil {
		t.Fatal(err)
	}

	// Act
	err := Generate(repoTemplate(t), dir)

	// Assert
	if err == nil {
		t.Fatal("expected an error for the fips folder")
	}
}

func TestGenerateGivesFIPSAndExperimentalTheirOwnChecksums(t *testing.T) {
	// Arrange
	dir := buildOutput(t)
	rootHash := fakeHash(folders[0], "snyk-linux")

	// Act
	err := Generate(repoTemplate(t), dir)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range folders[1:] {
		content := readFile(t, dir, f.releaseKey)
		if strings.Contains(content, rootHash) {
			t.Errorf("%s contains the root snyk-linux checksum", f.releaseKey)
		}
		if !strings.Contains(content, fakeHash(f, "snyk-linux")) {
			t.Errorf("%s lacks its own snyk-linux checksum", f.releaseKey)
		}
	}
}

func TestGenerateFillsInAlpineArm64(t *testing.T) {
	// Arrange
	dir := buildOutput(t)

	// Act
	err := Generate(repoTemplate(t), dir)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	content := readFile(t, dir, "release.json")
	if !strings.Contains(content, fakeHash(folders[0], "snyk-alpine-arm64")+"  snyk-alpine-arm64") {
		t.Error("snyk-alpine-arm64 has no real checksum")
	}
	if strings.Contains(content, "-sha256\"") || strings.Contains(content, "monorepo") {
		t.Errorf("release.json still has placeholder text: %s", content)
	}
}

func TestGenerateTrimsWhitespaceAroundVersion(t *testing.T) {
	// Arrange
	dir := buildOutput(t)
	writeFile(t, dir, "version", "  "+testVersion+"\r\n\n")

	// Act
	err := Generate(repoTemplate(t), dir)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	if got, want := readFile(t, dir, "release.json"), expectedReleaseJSON(folders[0]); got != want {
		t.Errorf("version was not trimmed\n got: %s\nwant: %s", got, want)
	}
}

func TestRunReadsTheTemplateFromTheWorkingDirectory(t *testing.T) {
	// Arrange
	dir := buildOutput(t)
	t.Chdir("..")

	// Act
	err := run([]string{dir})

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	if got, want := readFile(t, dir, "fips/release.json"), expectedReleaseJSON(folders[1]); got != want {
		t.Errorf("fips/release.json differs\n got: %s\nwant: %s", got, want)
	}
}

func TestRunRequiresOneArgument(t *testing.T) {
	if err := run(nil); err == nil || !strings.Contains(err.Error(), "usage:") {
		t.Errorf("expected a usage error, got %v", err)
	}
}

const smallTemplate = `{"artifacts":[
  {"name":"./tool","targets":[{"type":"s3","path":"cli/v$VERSION/"},{"type":"s3","path":"cli/$CHANNEL/"}]},
  {"name":"./tool.sha256","targets":[{"type":"s3","path":"cli/v$VERSION/"}]},
  {"name":"./release.json","targets":[{"type":"s3","path":"cli/v$VERSION/"}]}
]}`

// TestGenerateWorksWithASmallTemplate only exists to ensure things
// are working before the future testcases that use smallTemplate.
func TestGenerateWorksWithASmallTemplate(t *testing.T) {
	// Arrange
	dir := t.TempDir()
	writeFile(t, dir, "version", testVersion)
	writeFile(t, dir, "tool.sha256", "abc  tool\n")

	// Act
	err := Generate([]byte(smallTemplate), dir)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	want := `{
  "version": "1.2.3",
  "assets": {
    "tool": {
      "url": "https://downloads.snyk.io/cli/v1.2.3/tool",
      "sha256": "abc  tool",
      "sha256Url": "https://downloads.snyk.io/cli/v1.2.3/tool.sha256"
    }
  },
  "schemaVersion": 1
}
`
	if got := readFile(t, dir, "release.json"); got != want {
		t.Errorf("got: %s\nwant: %s", got, want)
	}
}

func TestGenerateErrors(t *testing.T) {
	tests := []struct {
		name     string
		template string
		setup    func(t *testing.T, dir string)
		wantErr  string
	}{
		{
			name:     "missing version file",
			template: smallTemplate,
			setup:    func(t *testing.T, dir string) { writeFile(t, dir, "tool.sha256", "abc  tool\n") },
			wantErr:  "version",
		},
		{
			name:     "empty version file",
			template: smallTemplate,
			setup: func(t *testing.T, dir string) {
				writeFile(t, dir, "version", " \n")
				writeFile(t, dir, "tool.sha256", "abc  tool\n")
			},
			wantErr: "version",
		},
		{
			name:     "missing sha256 file",
			template: smallTemplate,
			setup:    func(t *testing.T, dir string) { writeFile(t, dir, "version", testVersion) },
			wantErr:  "tool.sha256",
		},
		{
			name: "release.json without binaries",
			template: `{"artifacts":[
  {"name":"./tool","targets":[{"type":"s3","path":"cli/v$VERSION/"}]},
  {"name":"./release.json","targets":[{"type":"s3","path":"cli/v$VERSION/"}]}
]}`,
			setup:   func(t *testing.T, dir string) { writeFile(t, dir, "version", testVersion) },
			wantErr: "release.json",
		},
		{
			name: "binary without a versioned s3 target",
			template: `{"artifacts":[
  {"name":"./tool","targets":[{"type":"s3","path":"cli/$CHANNEL/"}]},
  {"name":"./tool.sha256","targets":[{"type":"s3","path":"cli/v$VERSION/"}]},
  {"name":"./release.json","targets":[{"type":"s3","path":"cli/v$VERSION/"}]}
]}`,
			setup: func(t *testing.T, dir string) {
				writeFile(t, dir, "version", testVersion)
				writeFile(t, dir, "tool.sha256", "abc  tool\n")
			},
			wantErr: "./tool",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			dir := t.TempDir()
			tt.setup(t, dir)

			// Act
			err := Generate([]byte(tt.template), dir)

			// Assert
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("want an error naming %q, got %v", tt.wantErr, err)
			}
		})
	}
}
