package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// licensesEmbeddedDir is the cliv2-relative tree where go-licenses and manual downloads write.
var licensesEmbeddedDir = filepath.Join(".", "internal", "embedded", "_data", "licenses")

func log(msg string) {
	fmt.Fprintln(os.Stderr, msg)
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

	log("Downloading manual licenses...")
	manualLicenses := []struct{ url, pkg string }{
		{"https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew"},
		{"https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi"},
		{"https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib"},
		{"https://go.dev/LICENSE?m=text", "go.dev"},
	}
	for _, lic := range manualLicenses {
		if err := manualLicenseDownload(lic.url, lic.pkg); err != nil {
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

func manualLicenseDownload(url, packageName string) error {
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

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("creating request for %s: %w", packageName, err)
	}
	req.Header.Set("User-Agent", "Snyk-CLI-Build/1.0")

	client := &http.Client{Timeout: 30 * time.Second}
	var resp *http.Response
	maxRetries := 2
	backoff := 5 * time.Second
	for i := 0; i <= maxRetries; i++ {
		resp, err = client.Do(req)

		if err != nil {
			return fmt.Errorf("downloading license for %s: %w", packageName, err)
		}

		// If not rate limited anymore, break
		if resp.StatusCode != http.StatusTooManyRequests {
			break
		}

		// check for Retry-After header
		retryAfter := resp.Header.Get("Retry-After")
		if seconds, err := strconv.Atoi(retryAfter); err == nil {
			backoff = time.Duration(seconds) * time.Second
		}

		_ = resp.Body.Close()

		if i == maxRetries {
			return fmt.Errorf("downloading license for %s: rate limited after %d retries", packageName, maxRetries)
		}

		log(fmt.Sprintf("  Rate limited, retrying for %s... (attempt %d/%d)", packageName, i+1, maxRetries+1))
		time.Sleep(backoff)
		backoff *= 2 // exponential backoff
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
