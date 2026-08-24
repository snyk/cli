package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type releaseJSON struct {
	Assets map[string]assetEntry `json:"assets"`
}

type assetEntry struct {
	SHA256 string `json:"sha256"`
}

func extractHash(sha256 string) (string, error) {
	fields := strings.Fields(sha256)
	if len(fields) == 0 {
		return "", fmt.Errorf("SHA256 contains no hash value")
	}
	return fields[0], nil
}

func main() {
	name := os.Getenv("BINARY_NAME")
	if name == "" {
		_, _ = fmt.Fprintln(os.Stderr, "BINARY_NAME environment variable is not set")
		os.Exit(1)
	}

	releasePath := "release.json"
	if len(os.Args) > 1 {
		releasePath = os.Args[1]
	}

	content, err := os.ReadFile(releasePath)
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Failed to read release file: %v\n", err)
		os.Exit(1)
	}

	var data releaseJSON
	if err := json.Unmarshal(content, &data); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Failed to parse release JSON: %v\n", err)
		os.Exit(1)
	}

	asset, ok := data.Assets[name]
	if !ok || asset.SHA256 == "" {
		_, _ = fmt.Fprintln(os.Stderr, "Asset not found or SHA256 is empty")
		os.Exit(1)
	}

	hash, err := extractHash(asset.SHA256)
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Asset SHA256 is invalid: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(hash)
}
