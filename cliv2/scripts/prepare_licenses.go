package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"os/exec"
)


// runGoLicensesSave executes the go-licenses save command.
func runGoLicensesSave() error {
	// Ensure GOBIN is set for installing go-licenses
	cachePath := filepath.Join(os.TempDir(), "go-licenses-cache")
	os.Setenv("GOBIN", cachePath)

	// Install go-licenses if not present
	installCmd := exec.Command("go", "install", "github.com/google/go-licenses@latest")
	installCmd.Stdout = os.Stdout
	installCmd.Stderr = os.Stderr
	if err := installCmd.Run(); err != nil {
		return fmt.Errorf("failed to install go-licenses: %v", err)
	}

	// Add GOBIN to PATH
	os.Setenv("PATH", os.Getenv("PATH")+string(os.PathListSeparator)+cachePath)

	// Run go-licenses save
	saveCmd := exec.Command("go-licenses", "save", "./...", "--save_path=./internal/embedded/_data/licenses", "--force", "--ignore", "github.com/snyk/cli/cliv2/")
	saveCmd.Stdout = os.Stdout
	saveCmd.Stderr = os.Stderr
	return saveCmd.Run()
}

func manualLicenseDownload(url, packageName string) error {
	// Define the directory and file paths
	folderPath := filepath.Join("cliv2", "internal", "embedded", "_data", "licenses", packageName)
	licenseFilePath := filepath.Join(folderPath, "LICENSE")

	// Check if the LICENSE file already exists
	if _, err := os.Stat(licenseFilePath); os.IsNotExist(err) {
		// Create directory if it doesn't exist
		err = os.MkdirAll(folderPath, os.ModePerm)
		if err != nil {
			return err
		}

		// Download the license file
		resp, err := http.Get(url)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("failed to download license from %s, status: %d", url, resp.StatusCode)
		}

		// Save the license content to file
		out, err := os.Create(licenseFilePath)
		if err != nil {
			return err
		}
		defer out.Close()

		_, err = io.Copy(out, resp.Body)
		if err != nil {
			return err
		}
	}
	return nil
}

func cleanupAndPrintLicenses() error {
	// Define the root path and license pattern
	rootPath := filepath.Join("cliv2", "internal", "embedded", "_data", "licenses")
	licensePattern := regexp.MustCompile(`(?i)COPYING|LICENSE|NOTICE.*`)

	// Walk through the directory structure to identify and delete non-license files
	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check if the file name matches the license pattern
		if !licensePattern.MatchString(info.Name()) {
			return os.Remove(path)
		}

		// Print license files
		fmt.Printf("    %s\n", path)
		return nil
	})

	return err
}

func main() {
	// Run go-licenses save to collect licenses for dependencies
	if err := runGoLicensesSave(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running go-licenses save: %v\n", err)
		return
	}

	// Manually download licenses
	licenses := map[string]string{
		"github.com/davecgh/go-spew":        "https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE",
		"github.com/alexbrainman/sspi":       "https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE",
		"github.com/pmezard/go-difflib":      "https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE",
		"go.dev":                             "https://go.dev/LICENSE?m=text",
	}

	for packageName, url := range licenses {
		if err := manualLicenseDownload(url, packageName); err != nil {
			fmt.Fprintf(os.Stderr, "Error downloading license for %s: %v\n", packageName, err)
		}
	}

	// Clean up and print licenses
	if err := cleanupAndPrintLicenses(); err != nil {
		fmt.Fprintf(os.Stderr, "Error during cleanup: %v\n", err)
	}
}
