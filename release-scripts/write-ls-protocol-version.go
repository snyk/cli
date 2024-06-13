package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

func getGoreleaserYAML(commit string) (int, error) {
	installOutput, err := exec.Command("go", "install", "github.com/snyk/snyk-ls@"+commit).CombinedOutput()
	if err != nil {
		return -3, fmt.Errorf("go install failed: %w: %q", err, string(installOutput))
	}
	modCacheDir, err := goModCache()
	if err != nil {
		return -3, fmt.Errorf("failed to locate go module cache: %w", err)
	}
	snykLsPkgPaths, err := filepath.Glob(filepath.Join(modCacheDir, "github.com", "snyk", "snyk-ls@v*-"+commit[:12]))
	if err != nil {
		return -3, fmt.Errorf("failed to match snyk-ls: %w", err)
	}
	if len(snykLsPkgPaths) == 0 {
		return -3, fmt.Errorf("snyk-ls @ %s not found in module cache; try `go get`?", commit)
	}
	goReleaserContents, err := os.ReadFile(filepath.Join(snykLsPkgPaths[0], ".goreleaser.yaml"))
	if err != nil {
		return -3, fmt.Errorf("failed to read goreleaser file: %w", err)
	}

	envSection := extractLSProtocolVersion(goReleaserContents)
	if envSection == "" {
		return -1, fmt.Errorf("LS_PROTOCOL_VERSION not found in .goreleaser.yaml")
	}

	protocolVersion, err := strconv.Atoi(envSection)
	if err != nil {
		return -1, fmt.Errorf("failed to parse LS_PROTOCOL_VERSION: %w", err)
	}

	return protocolVersion, nil
}

func goModCache() (string, error) {
	stdout, err := exec.Command("go", "env", "GOMODCACHE").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(stdout)), nil
}

func extractLSProtocolVersion(yamlContent []byte) string {
	re := regexp.MustCompile(`(?m)LS_PROTOCOL_VERSION\s*=\s*(\d+)$`)

	matches := re.FindSubmatch(yamlContent)
	if len(matches) > 1 {
		return string(matches[1])
	}
	return ""
}

func main() {
	if len(os.Args) != 4 {
		fmt.Println("Usage: go run script.go <commit_hash> <version> <output-directory>")
		os.Exit(1)
	}

	commitHash := os.Args[1]
	version := os.Args[2]
	outputDir := os.Args[3]

	lsProtocolVersion, err := getGoreleaserYAML(commitHash)
	if err != nil || lsProtocolVersion < 0 {
		fmt.Printf("Failed to retrieve LS_PROTOCOL_VERSION: %v\n", err)
		os.Exit(1)
	}

	filePath := filepath.Join(outputDir, fmt.Sprintf("ls-protocol-version-%d", lsProtocolVersion))
	if err := os.WriteFile(filePath, []byte(version), 0644); err != nil {
		fmt.Printf("Failed to write to file: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(lsProtocolVersion)
	os.Exit(0)
}
