package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type file struct {
	name    string
	content string
	paths   []string
	// unserved files are declared in the manifest but missing from the download site.
	unserved bool
}

func sha(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

// writeManifest writes a filled-in manifest and returns a download site serving each file from its
// versioned folder. The files listed in tampered are served with other content than was hashed.
func writeManifest(t *testing.T, channel string, files []file, tampered map[string]bool) (manifest, baseURL string) {
	t.Helper()

	type target struct {
		Type string `json:"type"`
		Path string `json:"path,omitempty"`
	}
	type artifact struct {
		Name    string   `json:"name"`
		SHA256  string   `json:"sha256"`
		Targets []target `json:"targets"`
	}
	site := map[string]string{}
	var artifacts []artifact
	for _, f := range files {
		a := artifact{Name: f.name, SHA256: sha(f.content)}
		for _, p := range f.paths {
			a.Targets = append(a.Targets, target{Type: "s3", Path: p})
			if strings.HasSuffix(p, "/v1.2.3/") && !f.unserved {
				served := f.content
				if tampered[f.name] {
					served = "tampered"
				}
				site[p+filepath.Base(f.name)] = served
			}
		}
		artifacts = append(artifacts, a)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		content, ok := site[strings.TrimPrefix(r.URL.Path, "/")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(content))
	}))
	t.Cleanup(server.Close)

	encoded, err := json.Marshal(map[string]any{
		"schemaVersion": 1,
		"meta":          map[string]string{"version": "1.2.3", "commit": "abc123", "releaseChannel": channel},
		"artifacts":     artifacts,
	})
	if err != nil {
		t.Fatal(err)
	}
	manifest = filepath.Join(t.TempDir(), "artifacts-manifest.json")
	if err := os.WriteFile(manifest, encoded, 0o644); err != nil {
		t.Fatal(err)
	}
	return manifest, server.URL
}

func previewFiles() []file {
	return []file{
		{name: "./release.json", content: "release", paths: []string{"cli/v1.2.3/", "cli/preview/"}},
		{name: "./snyk-linux", content: "linux", paths: []string{"cli/v1.2.3/", "cli/preview/"}},
		{name: "./fips/snyk-linux", content: "fips linux", paths: []string{"fips/cli/v1.2.3/", "fips/cli/preview/"}},
		{name: "./fips/release.json", content: "fips release", paths: []string{"fips/cli/v1.2.3/", "fips/cli/preview/"}},
		{name: "./snyk.tgz", content: "npm package", paths: []string{"cli/v1.2.3/"}},
	}
}

// uploadsOf returns the "source -> s3://..." lines of the output.
func uploadsOf(output string) []string {
	var uploads []string
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, " -> s3://") {
			uploads = append(uploads, line)
		}
	}
	return uploads
}

func TestDryRunListsChannelKeysWithReleaseJSONLast(t *testing.T) {
	// Arrange
	manifest, baseURL := writeManifest(t, "preview", previewFiles(), nil)
	var out bytes.Buffer

	// Act
	err := run([]string{"--dry-run", manifest}, &out, "test-bucket", baseURL)

	// Assert: no versioned folder, and nothing for a file that only has a versioned target
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"./snyk-linux -> s3://test-bucket/cli/preview/snyk-linux",
		"./fips/snyk-linux -> s3://test-bucket/fips/cli/preview/snyk-linux",
		"./release.json -> s3://test-bucket/cli/preview/release.json",
		"./fips/release.json -> s3://test-bucket/fips/cli/preview/release.json",
	}
	if got := uploadsOf(out.String()); strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("unexpected uploads.\nwant:\n%s\ngot:\n%s", strings.Join(want, "\n"), strings.Join(got, "\n"))
	}
	if !strings.Contains(out.String(), "v1.2.3 to the preview channel") {
		t.Errorf("expected the version and channel from the manifest, got:\n%s", out.String())
	}
}

func TestDryRunListsEveryChannelFolderOfAFile(t *testing.T) {
	// Arrange: the manifest tool adds a latest folder next to the stable one
	files := []file{{name: "./snyk-linux", content: "linux", paths: []string{"cli/v1.2.3/", "cli/stable/", "cli/latest/"}}}
	manifest, baseURL := writeManifest(t, "stable", files, nil)
	var out bytes.Buffer

	// Act
	err := run([]string{"--dry-run", manifest}, &out, "test-bucket", baseURL)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	want := "./snyk-linux -> s3://test-bucket/cli/stable/snyk-linux\n./snyk-linux -> s3://test-bucket/cli/latest/snyk-linux"
	if got := strings.Join(uploadsOf(out.String()), "\n"); got != want {
		t.Fatalf("want:\n%s\ngot:\n%s", want, got)
	}
}

func TestRunRequiresDryRun(t *testing.T) {
	manifest, baseURL := writeManifest(t, "preview", previewFiles(), nil)

	err := run([]string{manifest}, &bytes.Buffer{}, "test-bucket", baseURL)

	if err == nil {
		t.Fatal("expected a failure without --dry-run")
	}
}

func TestDryRunListsNoKeysAfterAChecksumMismatch(t *testing.T) {
	manifest, baseURL := writeManifest(t, "preview", previewFiles(), map[string]bool{"./snyk-linux": true})
	var out bytes.Buffer

	err := run([]string{"--dry-run", manifest}, &out, "test-bucket", baseURL)

	if err == nil || !strings.Contains(err.Error(), "checksum mismatch for ./snyk-linux") {
		t.Fatalf("expected a checksum mismatch for ./snyk-linux, got %v", err)
	}
	if out.Len() != 0 {
		t.Errorf("nothing should be listed after a failed check, got:\n%s", out.String())
	}
}

func TestDryRunDoesNotFetchFilesWithoutAChannelFolder(t *testing.T) {
	// Arrange: the npm tarball only has a versioned folder, and the versioned upload doesn't publish it yet
	files := append(previewFiles(), file{name: "./snyk-fix.tgz", content: "fix", paths: []string{"cli/v1.2.3/"}, unserved: true})
	manifest, baseURL := writeManifest(t, "preview", files, nil)
	var out bytes.Buffer

	// Act
	err := run([]string{"--dry-run", manifest}, &out, "test-bucket", baseURL)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out.String(), "snyk-fix.tgz") {
		t.Errorf("a file without a channel folder should not be listed, got:\n%s", out.String())
	}
}
