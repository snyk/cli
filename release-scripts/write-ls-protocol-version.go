package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
)

func getGoreleaserYAML(commit string) (int, error) {
	apiURL := fmt.Sprintf("https://raw.githubusercontent.com/snyk/snyk-ls/%s/.goreleaser.yaml", commit)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return -3, fmt.Errorf("failed to retrieve commit information: %w", err)
	}

	client := http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return -3, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return -3, fmt.Errorf("failed to retrieve commit information: status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return -3, fmt.Errorf("failed to read response body: %w", err)
	}

	envSection := extractLSProtocolVersion(body)
	if envSection == "" {
		return -1, fmt.Errorf("LS_PROTOCOL_VERSION not found in .goreleaser.yaml")
	}

	protocolVersion, err := strconv.Atoi(envSection)
	if err != nil {
		return -1, fmt.Errorf("failed to parse LS_PROTOCOL_VERSION: %w", err)
	}

	return protocolVersion, nil
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
