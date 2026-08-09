package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestTriggerEndpointExplorerRefreshAcceptsDispatch(t *testing.T) {
	result := runEndpointExplorerTrigger(t, "preview", map[string]string{
		"MOCK_CURL_HTTP_STATUS": "204",
	})

	if result.err != nil {
		t.Fatalf("expected a successful exit, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "Endpoint Explorer preview refresh requested") {
		t.Fatalf("expected accepted-dispatch message, got:\n%s", result.output)
	}
	if !strings.Contains(result.curlArguments, "refresh-cli-data.yml/dispatches") {
		t.Fatalf("expected the Explorer workflow dispatch endpoint, got:\n%s", result.curlArguments)
	}
	if !strings.Contains(result.curlArguments, `"channel":"preview"`) {
		t.Fatalf("expected preview workflow input, got:\n%s", result.curlArguments)
	}
}

func TestTriggerEndpointExplorerRefreshIgnoresHTTPFailure(t *testing.T) {
	result := runEndpointExplorerTrigger(t, "stable", map[string]string{
		"MOCK_CURL_HTTP_STATUS": "503",
	})

	if result.err != nil {
		t.Fatalf("expected the fire-and-forget trigger to exit successfully, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "WARNING: Endpoint Explorer stable refresh was not requested") {
		t.Fatalf("expected a warning, got:\n%s", result.output)
	}
}

func TestTriggerEndpointExplorerRefreshIgnoresTransportFailure(t *testing.T) {
	result := runEndpointExplorerTrigger(t, "stable", map[string]string{
		"MOCK_CURL_EXIT_STATUS": "28",
	})

	if result.err != nil {
		t.Fatalf("expected the fire-and-forget trigger to exit successfully, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "WARNING: Endpoint Explorer stable refresh dispatch failed") {
		t.Fatalf("expected a warning, got:\n%s", result.output)
	}
}

func TestTriggerEndpointExplorerRefreshIgnoresMissingToken(t *testing.T) {
	result := runEndpointExplorerTrigger(t, "preview", map[string]string{
		"HAMMERHEAD_GITHUB_PAT": "",
	})

	if result.err != nil {
		t.Fatalf("expected the fire-and-forget trigger to exit successfully, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "WARNING: HAMMERHEAD_GITHUB_PAT is unavailable") {
		t.Fatalf("expected a missing-token warning, got:\n%s", result.output)
	}
	if result.curlArguments != "" {
		t.Fatalf("expected curl not to run without a token, got:\n%s", result.curlArguments)
	}
}

type endpointExplorerTriggerResult struct {
	output        string
	curlArguments string
	err           error
}

func runEndpointExplorerTrigger(t *testing.T, channel string, overrides map[string]string) endpointExplorerTriggerResult {
	t.Helper()

	tempDir := t.TempDir()
	curlLog := filepath.Join(tempDir, "curl-arguments")
	mockCurl := filepath.Join(tempDir, "curl")
	mock := []byte(`#!/usr/bin/env bash
printf '%s\n' "$@" > "$MOCK_CURL_LOG"
printf '%s' "${MOCK_CURL_HTTP_STATUS:-204}"
exit "${MOCK_CURL_EXIT_STATUS:-0}"
`)
	if err := os.WriteFile(mockCurl, mock, 0755); err != nil {
		t.Fatal(err)
	}

	environment := map[string]string{
		"HAMMERHEAD_GITHUB_PAT": "test-token",
		"MOCK_CURL_EXIT_STATUS": "0",
		"MOCK_CURL_HTTP_STATUS": "204",
		"MOCK_CURL_LOG":         curlLog,
		"PATH":                  tempDir + string(os.PathListSeparator) + os.Getenv("PATH"),
	}
	for key, value := range overrides {
		environment[key] = value
	}

	command := exec.Command("bash", "./trigger-endpoint-explorer-refresh.sh", channel)
	command.Env = environmentWithOverrides(os.Environ(), environment)
	output, err := command.CombinedOutput()
	curlArguments, readErr := os.ReadFile(curlLog)
	if readErr != nil && !os.IsNotExist(readErr) {
		t.Fatal(readErr)
	}

	return endpointExplorerTriggerResult{
		output:        string(output),
		curlArguments: string(curlArguments),
		err:           err,
	}
}

func environmentWithOverrides(current []string, overrides map[string]string) []string {
	result := make([]string, 0, len(current)+len(overrides))
	for _, entry := range current {
		key, _, found := strings.Cut(entry, "=")
		if !found {
			continue
		}
		if _, overridden := overrides[key]; !overridden {
			result = append(result, entry)
		}
	}
	for key, value := range overrides {
		result = append(result, key+"="+value)
	}
	return result
}
