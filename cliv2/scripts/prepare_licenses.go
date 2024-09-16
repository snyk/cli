package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

func downloadLicense(url, packageName string) error {
	folderPath := filepath.Join(".", "internal", "embedded", "_data", "licenses", packageName)
	licenseFileName := filepath.Join(folderPath, "LICENSE")

	err := os.MkdirAll(folderPath, 0755)
	if err != nil {
		return err
	}

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download   license: %s (status code: %d)", url, resp.StatusCode)
	}

	licenseFile, err := os.Create(licenseFileName)
	if err != nil {
		return err
	}
	defer licenseFile.Close()

	_, err = io.Copy(licenseFile, resp.Body)
	return err
}

func main() {
	pattern := regexp.MustCompile("(?i)COPYING|LICENSE|NOTICE.*")

	licenses := []struct {
		url         string
		packageName string
	}{
		{"https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew"},
		{"https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi"},
		{"https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib"},
		{"https://go.dev/LICENSE?m=text", "go.dev"},
	}

	for _, license := range licenses {
		err := downloadLicense(license.url, license.packageName)
		if err != nil {
			fmt.Printf("Error downloading license for %s: %v\n", license.packageName, err)
		}
	}

	licensePath := filepath.Join(".", "internal", "embedded", "_data", "licenses")
	err := filepath.Walk(licensePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && !pattern.MatchString(path) {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return err
			}
		} else {
			fmt.Println(path)
		}
		return nil
	})

	if err != nil {
		fmt.Println("Error cleaning up licenses:", err)
	}
}
