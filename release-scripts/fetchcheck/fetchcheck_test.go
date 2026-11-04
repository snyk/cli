package fetchcheck

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/snyk/cli/release-scripts/manifest"
)

func sha(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func s3(path string) manifest.Target { return manifest.Target{Type: "s3", Path: path} }

func testManifest() *manifest.Manifest {
	return &manifest.Manifest{
		Meta: manifest.Meta{Version: "1.2.3", ReleaseChannel: "preview"},
		Artifacts: []manifest.Artifact{
			{Name: "./snyk-linux", SHA256: sha("linux"), Targets: []manifest.Target{s3("cli/v1.2.3/"), s3("cli/preview/"), {Type: "github"}}},
			{Name: "./fips/snyk-linux", SHA256: sha("fips linux"), Targets: []manifest.Target{s3("fips/cli/v1.2.3/"), s3("fips/cli/preview/")}},
			{Name: "./snyk.tgz", SHA256: sha("npm package"), Targets: []manifest.Target{s3("cli/v1.2.3/"), {Type: "npm"}}},
		},
	}
}

// serve answers GET requests with the files of a fake download site, keyed by URL path.
func serve(t *testing.T, site map[string]string) *Fetcher {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		content, ok := site[strings.TrimPrefix(r.URL.Path, "/")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(content))
	}))
	t.Cleanup(server.Close)
	return &Fetcher{Client: server.Client(), BaseURL: server.URL, Backoff: func(int) time.Duration { return 0 }}
}

func fullSite() map[string]string {
	return map[string]string{
		"cli/v1.2.3/snyk-linux":      "linux",
		"fips/cli/v1.2.3/snyk-linux": "fips linux",
		"cli/v1.2.3/snyk.tgz":        "npm package",
	}
}

func TestFetchDownloadsOnlyFilesWithTheTargetType(t *testing.T) {
	// Arrange
	fetcher := serve(t, fullSite())
	dest := t.TempDir()

	// Act
	err := fetcher.Fetch(testManifest(), testManifest().ArtifactsWithTarget("npm"), dest)

	// Assert
	if err != nil {
		t.Fatal(err)
	}
	if got, err := os.ReadFile(filepath.Join(dest, "snyk.tgz")); err != nil || string(got) != "npm package" {
		t.Fatalf("expected snyk.tgz to be downloaded, got %q, %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dest, "snyk-linux")); err == nil {
		t.Error("snyk-linux has no npm target and should not be downloaded")
	}
}

func TestFetchKeepsFolderLayoutUnderTheDestination(t *testing.T) {
	fetcher := serve(t, fullSite())
	dest := t.TempDir()

	if err := fetcher.Fetch(testManifest(), testManifest().ArtifactsWithTarget("s3"), dest); err != nil {
		t.Fatal(err)
	}

	if got, err := os.ReadFile(filepath.Join(dest, "fips", "snyk-linux")); err != nil || string(got) != "fips linux" {
		t.Fatalf("expected fips/snyk-linux to be downloaded, got %q, %v", got, err)
	}
}

func TestFetchReportsEveryChecksumMismatch(t *testing.T) {
	site := fullSite()
	site["cli/v1.2.3/snyk-linux"] = "tampered"
	site["fips/cli/v1.2.3/snyk-linux"] = "tampered"

	err := serve(t, site).Fetch(testManifest(), testManifest().ArtifactsWithTarget("s3"), t.TempDir())

	if err == nil {
		t.Fatal("expected a checksum mismatch")
	}
	for _, name := range []string{"./snyk-linux", "./fips/snyk-linux"} {
		if !strings.Contains(err.Error(), "checksum mismatch for "+name) {
			t.Errorf("expected %s in the error, got: %v", name, err)
		}
	}
}

func TestFetchFailsOnAMissingFileWithoutRetrying(t *testing.T) {
	var requests atomic.Int32
	fetcher := serve(t, map[string]string{})
	inner := fetcher.Client.Transport
	fetcher.Client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		requests.Add(1)
		return inner.RoundTrip(r)
	})
	m := &manifest.Manifest{Meta: manifest.Meta{Version: "1.2.3", ReleaseChannel: "preview"}, Artifacts: []manifest.Artifact{testManifest().Artifacts[0]}}

	err := fetcher.Fetch(m, m.ArtifactsWithTarget("s3"), t.TempDir())

	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("expected a 404 error, got %v", err)
	}
	if requests.Load() != 1 {
		t.Errorf("a 404 should not be retried, got %d requests", requests.Load())
	}
}

func TestFetchRetriesServerErrors(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) < 3 {
			http.Error(w, "try later", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte("linux"))
	}))
	t.Cleanup(server.Close)
	fetcher := &Fetcher{Client: server.Client(), BaseURL: server.URL, Backoff: func(int) time.Duration { return 0 }}
	m := &manifest.Manifest{Meta: manifest.Meta{Version: "1.2.3", ReleaseChannel: "preview"}, Artifacts: []manifest.Artifact{testManifest().Artifacts[0]}}

	if err := fetcher.Fetch(m, m.ArtifactsWithTarget("s3"), t.TempDir()); err != nil {
		t.Fatalf("expected the third attempt to succeed: %v", err)
	}
}

func TestFetchFailsWhenThereIsNothingToFetch(t *testing.T) {
	err := serve(t, fullSite()).Fetch(testManifest(), nil, t.TempDir())

	if err == nil {
		t.Fatal("expected a failure without files, which means a wrong filter upstream")
	}
}

func TestFetchFailsOnAFileWithoutAVersionedFolder(t *testing.T) {
	m := testManifest()
	m.Artifacts[0].Targets = []manifest.Target{s3("cli/preview/")}

	err := serve(t, fullSite()).Fetch(m, m.ArtifactsWithTarget("s3"), t.TempDir())

	if err == nil || !strings.Contains(err.Error(), "no versioned s3 target") {
		t.Fatalf("expected a missing versioned target error, got %v", err)
	}
}

func TestFetchRefusesNamesOutsideTheDestination(t *testing.T) {
	m := testManifest()
	m.Artifacts = []manifest.Artifact{{Name: "./../escape", SHA256: sha("x"), Targets: []manifest.Target{s3("cli/v1.2.3/")}}}

	err := serve(t, fullSite()).Fetch(m, m.ArtifactsWithTarget("s3"), t.TempDir())

	if err == nil || !strings.Contains(err.Error(), "outside the destination") {
		t.Fatalf("expected an outside-the-destination error, got %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
