package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsEmbeddedLicenseFileName(t *testing.T) {
	keep := []string{
		"LICENSE",
		"LICENSE.txt",
		"LICENSE.md",
		"LICENSE-MIT",
		"LICENSE_THIRD_PARTY",
		"LICENSEE",
		"LICENSEfoo",
		"License",
		"license",
		"COPYING",
		"COPYING.txt",
		"COPYINGmore",
		"Copying",
		"NOTICE",
		"NOTICE.txt",
		"NOTICE.md",
		"NOTICEboard",
		"Notice",
		"LICENCE",
		"LICENCE.txt",
		"Licence",
		"COPYRIGHT",
		"COPYRIGHT.txt",
		"Copyright",
	}
	remove := []string{
		"README.md",
		"go.sum",
		"main.go",
		"package.json",
		"",
	}

	for _, name := range keep {
		assert.True(t, isEmbeddedLicenseFileName(name), "expected %q to be kept, but it would be removed", name)
	}
	for _, name := range remove {
		assert.False(t, isEmbeddedLicenseFileName(name), "expected %q to be removed, but it would be kept", name)
	}
}

func TestCleanupNonLicenseFiles(t *testing.T) {
	tmpDir := t.TempDir()
	origDir := licensesEmbeddedDir
	licensesEmbeddedDir = tmpDir
	t.Cleanup(func() { licensesEmbeddedDir = origDir })

	pkgDir := filepath.Join(tmpDir, "example.com", "foo")
	require.NoError(t, os.MkdirAll(pkgDir, 0o755))

	files := map[string]bool{
		"LICENSE":     true,
		"LICENSE.txt": true,
		"NOTICE":      true,
		"README.md":   false,
		"go.sum":      false,
		"main.go":     false,
	}
	for name := range files {
		require.NoError(t, os.WriteFile(filepath.Join(pkgDir, name), []byte("test"), 0o644))
	}

	require.NoError(t, cleanupNonLicenseFiles())

	for name, shouldExist := range files {
		_, err := os.Stat(filepath.Join(pkgDir, name))
		exists := err == nil
		assert.Equal(t, shouldExist, exists, "file %q", name)
	}
}

func TestManualLicenseDownload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if _, err := w.Write([]byte("MIT License\n")); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	origDir := licensesEmbeddedDir
	licensesEmbeddedDir = tmpDir
	t.Cleanup(func() { licensesEmbeddedDir = origDir })

	pkg := "example.com/testpkg"
	client := &http.Client{}
	require.NoError(t, manualLicenseDownload(client, server.URL+"/LICENSE", pkg))

	content, err := os.ReadFile(filepath.Join(tmpDir, pkg, "LICENSE"))
	require.NoError(t, err)
	assert.Equal(t, "MIT License\n", string(content))

	// Second call should skip (file already exists).
	require.NoError(t, manualLicenseDownload(client, server.URL+"/LICENSE", pkg))
}

func TestManualLicenseDownloadHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	origDir := licensesEmbeddedDir
	licensesEmbeddedDir = tmpDir
	t.Cleanup(func() { licensesEmbeddedDir = origDir })

	client := &http.Client{}
	err := manualLicenseDownload(client, server.URL+"/LICENSE", "example.com/missing")
	assert.Error(t, err, "expected error for 404 response, got nil")
}

func TestNewHTTPClient_SetsUserAgent(t *testing.T) {
	var gotUA string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUA = r.Header.Get("User-Agent")
		_, err := w.Write([]byte("OK"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}))
	defer server.Close()

	client := newHTTPClient()
	resp, err := client.Get(server.URL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	assert.NoError(t, resp.Body.Close())

	assert.Equal(t, "Snyk-CLI-Build/1.0", gotUA)
}

func TestNewHTTPClient_RetriesOn429(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		n := calls
		if n <= 2 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, err := w.Write([]byte("OK"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}))
	defer server.Close()

	client := newHTTPClient()
	resp, err := client.Get(server.URL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	assert.NoError(t, resp.Body.Close())

	assert.GreaterOrEqual(t, calls, 3, "expected at least 3 server calls (2 x 429 + 1 x 200)")
}
