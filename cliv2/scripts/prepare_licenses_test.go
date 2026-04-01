package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
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
		if !isEmbeddedLicenseFileName(name) {
			t.Errorf("expected %q to be kept, but it would be removed", name)
		}
	}
	for _, name := range remove {
		if isEmbeddedLicenseFileName(name) {
			t.Errorf("expected %q to be removed, but it would be kept", name)
		}
	}
}

func TestCleanupNonLicenseFiles(t *testing.T) {
	tmpDir := t.TempDir()
	origDir := licensesEmbeddedDir
	licensesEmbeddedDir = tmpDir
	t.Cleanup(func() { licensesEmbeddedDir = origDir })

	pkgDir := filepath.Join(tmpDir, "example.com", "foo")
	if err := os.MkdirAll(pkgDir, 0o755); err != nil {
		t.Fatal(err)
	}

	files := map[string]bool{
		"LICENSE":     true,
		"LICENSE.txt": true,
		"NOTICE":      true,
		"README.md":   false,
		"go.sum":      false,
		"main.go":     false,
	}
	for name := range files {
		if err := os.WriteFile(filepath.Join(pkgDir, name), []byte("test"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := cleanupNonLicenseFiles(); err != nil {
		t.Fatalf("cleanupNonLicenseFiles() error: %v", err)
	}

	for name, shouldExist := range files {
		_, err := os.Stat(filepath.Join(pkgDir, name))
		exists := err == nil
		if exists != shouldExist {
			t.Errorf("file %q: exists=%v, want exists=%v", name, exists, shouldExist)
		}
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
	if err := manualLicenseDownload(server.URL+"/LICENSE", pkg); err != nil {
		t.Fatalf("manualLicenseDownload() error: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(tmpDir, pkg, "LICENSE"))
	if err != nil {
		t.Fatalf("reading downloaded license: %v", err)
	}
	if string(content) != "MIT License\n" {
		t.Errorf("license content = %q, want %q", content, "MIT License\n")
	}

	// Second call should skip (file already exists).
	if err := manualLicenseDownload(server.URL+"/LICENSE", pkg); err != nil {
		t.Fatalf("second manualLicenseDownload() error: %v", err)
	}
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

	err := manualLicenseDownload(server.URL+"/LICENSE", "example.com/missing")
	if err == nil {
		t.Fatal("expected error for 404 response, got nil")
	}
}
