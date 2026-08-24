package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type metadata struct {
	Channel string `json:"channel"`
	BaseURL string `json:"base_url"`
	Source  string `json:"source"`
	Binary  string `json:"binary"`
	SHA256  string `json:"sha256"`
}

type cdnKey struct {
	channel string
	binary  string
}

type cdnEntry struct {
	source   string
	sha256   string
	filename string
}

func entrySource(data metadata) string {
	if data.Source != "" {
		return data.Source
	}
	return data.BaseURL
}

func main() {
	snykVersionDir := os.Getenv("SNYK_VERSION_DIR")
	if snykVersionDir == "" {
		_, _ = fmt.Fprintln(os.Stderr, "SNYK_VERSION_DIR is required")
		os.Exit(1)
	}

	if !filepath.IsAbs(snykVersionDir) {
		workspace := os.Getenv("GITHUB_WORKSPACE")
		if workspace == "" {
			cwd, err := os.Getwd()
			if err != nil {
				_, _ = fmt.Fprintf(os.Stderr, "failed to resolve working directory: %v\n", err)
				os.Exit(1)
			}
			workspace = cwd
		}
		snykVersionDir = filepath.Join(workspace, snykVersionDir)
	}

	if err := os.MkdirAll(snykVersionDir, 0o755); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to create directory: %v\n", err)
		os.Exit(1)
	}

	if err := os.Chdir(snykVersionDir); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to change directory: %v\n", err)
		os.Exit(1)
	}

	entries, err := os.ReadDir(".")
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to read directory: %v\n", err)
		os.Exit(1)
	}

	var metadataFiles []string
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "snyk-metadata-") && strings.HasSuffix(name, ".json") {
			metadataFiles = append(metadataFiles, name)
		}
	}

	if len(metadataFiles) == 0 {
		fmt.Println("No metadata files found; skipping shasum comparison.")
		return
	}

	cdnEntries := make(map[cdnKey][]cdnEntry)
	for _, filename := range metadataFiles {
		content, err := os.ReadFile(filename)
		if err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "failed to read %s: %v\n", filename, err)
			os.Exit(1)
		}

		trimmed := strings.TrimSpace(string(content))
		if trimmed == "" {
			_, _ = fmt.Printf("Metadata file %s is empty.\n", filename)
			os.Exit(1)
		}

		var data metadata
		if err := json.Unmarshal([]byte(trimmed), &data); err != nil {
			snippet := strings.ReplaceAll(trimmed, "\n", "\\n")
			if len(snippet) > 200 {
				snippet = snippet[:200]
			}
			fmt.Printf("Invalid JSON in %s: %v\n", filename, err)
			fmt.Printf("Content snippet: %s\n", snippet)
			os.Exit(1)
		}

		if data.SHA256 == "" {
			continue
		}

		key := cdnKey{channel: data.Channel, binary: data.Binary}
		if key.channel == "" {
			key.channel = "unknown"
		}
		if key.binary == "" {
			key.binary = "unknown"
		}

		cdnEntries[key] = append(cdnEntries[key], cdnEntry{
			source:   entrySource(data),
			sha256:   data.SHA256,
			filename: filename,
		})
	}

	if len(cdnEntries) == 0 {
		fmt.Println("No metadata entries with shasums found; skipping shasum comparison.")
		return
	}

	keys := make([]cdnKey, 0, len(cdnEntries))
	for key := range cdnEntries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].channel != keys[j].channel {
			return keys[i].channel < keys[j].channel
		}
		return keys[i].binary < keys[j].binary
	})

	failed := false
	for _, key := range keys {
		entriesForKey := cdnEntries[key]
		uniqueSHAs := make(map[string]struct{})
		for _, entry := range entriesForKey {
			uniqueSHAs[entry.sha256] = struct{}{}
		}

		if len(entriesForKey) < 2 {
			continue
		}

		if len(uniqueSHAs) > 1 {
			failed = true
			fmt.Printf("❌ Shasum mismatch for %s (%s)\n", key.binary, key.channel)
			for _, entry := range entriesForKey {
				fmt.Printf("  %s: %s (%s)\n", entry.source, entry.sha256, entry.filename)
			}
		}
	}

	if failed {
		os.Exit(1)
	}

	fmt.Println("✅ Shasums are consistent across distribution sources.")
}
