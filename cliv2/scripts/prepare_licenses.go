package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"
)

// licensesEmbeddedDir is the cliv2-relative tree where go-licenses and manual downloads write.
var licensesEmbeddedDir = filepath.Join(".", "internal", "embedded", "_data", "licenses")

const (
	maxDownloadAttempts = 5
	perAttemptTimeout   = 30 * time.Second
)

func log(msg string) {
	fmt.Fprintln(os.Stderr, msg)
}

func newHTTPClient() *http.Client {
	cfg := configuration.NewWithOpts()
	cfg.Set(middleware.ConfigurationKeyRequestAttempts, maxDownloadAttempts)

	na := networking.NewNetworkAccess(cfg)
	na.AddHeaderField("User-Agent", "Snyk-CLI-Build/1.0")

	client := na.GetUnauthorizedHttpClient()
	client.Timeout = time.Duration(maxDownloadAttempts) * perAttemptTimeout
	return client
}

func main() {
	log("Preparing 3rd party licenses...")

	goBinPath := filepath.Join(mustGetwd(), "_cache")
	if err := os.Setenv("GOBIN", goBinPath); err != nil {
		log(fmt.Sprintf("Error setting GOBIN: %v", err))
		os.Exit(1)
	}

	log("Installing go-licenses...")
	if err := runCommand("go", "install", "github.com/google/go-licenses@v1.6.0"); err != nil {
		log(fmt.Sprintf("Error installing go-licenses: %v", err))
		os.Exit(1)
	}

	if err := os.Setenv("PATH", os.Getenv("PATH")+string(os.PathListSeparator)+goBinPath); err != nil {
		log(fmt.Sprintf("Error updating PATH: %v", err))
		os.Exit(1)
	}

	log("Running go-licenses save...")
	if err := runCommand(
		filepath.Join(goBinPath, "go-licenses"),
		"save", "./...",
		"--save_path="+filepath.ToSlash(licensesEmbeddedDir),
		"--force",
		"--ignore", "github.com/snyk/cli/cliv2/",
	); err != nil {
		log(fmt.Sprintf("Error running go-licenses save: %v", err))
		os.Exit(1)
	}

	client := newHTTPClient()

	log("Downloading manual licenses...")
	manualLicenses := []struct{ url, pkg string }{
		{"https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew"},
		{"https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi"},
		{"https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib"},
		{"https://go.dev/LICENSE?m=text", "go.dev"},
	}
	for _, lic := range manualLicenses {
		if err := manualLicenseDownload(client, lic.url, lic.pkg); err != nil {
			log(fmt.Sprintf("Error downloading license: %v", err))
			os.Exit(1)
		}
	}

	if err := cleanupNonLicenseFiles(); err != nil {
		log(fmt.Sprintf("Error cleaning license directory: %v", err))
		os.Exit(1)
	}

	log("Done preparing 3rd party licenses.")
}

func manualLicenseDownload(client *http.Client, url, packageName string) error {
	folderPath := filepath.Join(licensesEmbeddedDir, packageName)
	licenseFile := filepath.Join(folderPath, "LICENSE")

	if _, err := os.Stat(licenseFile); err == nil {
		log(fmt.Sprintf("  Skipped (already exists): %s", packageName))
		return nil
	}

	log(fmt.Sprintf("Downloading license for %s...", packageName))
	if err := os.MkdirAll(folderPath, 0o755); err != nil {
		return fmt.Errorf("creating directory for %s: %w", packageName, err)
	}

	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("downloading license for %s: %w", packageName, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("downloading license for %s: HTTP %d", packageName, resp.StatusCode)
	}

	tmpFile := licenseFile + ".tmp"
	f, err := os.Create(tmpFile)
	if err != nil {
		return fmt.Errorf("creating file for %s: %w", packageName, err)
	}

	if _, err := io.Copy(f, resp.Body); err != nil {
		_ = f.Close()
		_ = os.Remove(tmpFile)
		return fmt.Errorf("writing license for %s: %w", packageName, err)
	}
	_ = f.Close()

	if err := os.Rename(tmpFile, licenseFile); err != nil {
		_ = os.Remove(tmpFile)
		return fmt.Errorf("finalizing license for %s: %w", packageName, err)
	}

	log(fmt.Sprintf("  Downloaded: %s", packageName))
	return nil
}

func runCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	return cmd.Run()
}

// isEmbeddedLicenseFileName returns true if the basename looks like a license or notice file we keep when pruning go-licenses output (case-insensitive prefix match).
func isEmbeddedLicenseFileName(name string) bool {
	u := strings.ToUpper(name)
	return strings.HasPrefix(u, "COPYING") ||
		strings.HasPrefix(u, "COPYRIGHT") ||
		strings.HasPrefix(u, "LICENCE") ||
		strings.HasPrefix(u, "LICENSE") ||
		strings.HasPrefix(u, "NOTICE")
}

func cleanupNonLicenseFiles() error {
	log("Cleaning up non-license files...")
	return filepath.Walk(licensesEmbeddedDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		name := info.Name()
		if isEmbeddedLicenseFileName(name) {
			fmt.Printf("    %s\n", filepath.ToSlash(path))
		} else if err := os.Remove(path); err != nil {
			log(fmt.Sprintf("  Warning: could not remove %s: %v", path, err))
		}
		return nil
	})
}

func mustGetwd() string {
	dir, err := os.Getwd()
	if err != nil {
		log(fmt.Sprintf("Error getting working directory: %v", err))
		os.Exit(1)
	}
	return dir
}
