package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestDistributionTriggersRequestEndpointExplorerRefresh(t *testing.T) {
	for _, channel := range []string{"stable", "preview"} {
		t.Run(channel, func(t *testing.T) {
			result := runDistributionTriggers(t, channel, "204", "0")

			if result.err != nil {
				t.Fatalf("expected successful distribution triggers, got %v\n%s", result.err, result.output)
			}
			if !strings.Contains(result.output, "Endpoint Explorer "+channel+" refresh requested") {
				t.Fatalf("expected accepted Explorer dispatch message, got:\n%s", result.output)
			}
			if !strings.Contains(result.curlArguments, "endpoint-binary-explorer/actions/workflows/refresh-cli-data.yml/dispatches") {
				t.Fatalf("expected the Explorer workflow dispatch endpoint, got:\n%s", result.curlArguments)
			}
			if !strings.Contains(result.curlArguments, `"channel":"`+channel+`"`) {
				t.Fatalf("expected %s workflow input, got:\n%s", channel, result.curlArguments)
			}
			if !strings.Contains(result.curlArguments, "--connect-timeout\n2") || !strings.Contains(result.curlArguments, "--max-time\n5") {
				t.Fatalf("expected bounded Explorer dispatch timeouts, got:\n%s", result.curlArguments)
			}
		})
	}
}

func TestDistributionTriggersIgnoreEndpointExplorerHTTPFailure(t *testing.T) {
	result := runDistributionTriggers(t, "preview", "503", "0")

	if result.err != nil {
		t.Fatalf("expected Explorer failure not to fail distribution triggers, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "WARNING: Endpoint Explorer preview refresh was not requested") {
		t.Fatalf("expected a warning, got:\n%s", result.output)
	}
}

func TestDistributionTriggersIgnoreEndpointExplorerTransportFailure(t *testing.T) {
	result := runDistributionTriggers(t, "stable", "000", "28")

	if result.err != nil {
		t.Fatalf("expected Explorer failure not to fail distribution triggers, got %v\n%s", result.err, result.output)
	}
	if !strings.Contains(result.output, "WARNING: Endpoint Explorer stable refresh dispatch failed") {
		t.Fatalf("expected a warning, got:\n%s", result.output)
	}
}

func TestDistributionTriggersSkipEndpointExplorerForReleaseCandidate(t *testing.T) {
	result := runDistributionTriggers(t, "rc", "204", "0")

	if result.err != nil {
		t.Fatalf("expected successful distribution triggers, got %v\n%s", result.err, result.output)
	}
	if strings.Contains(result.curlArguments, "endpoint-binary-explorer") {
		t.Fatalf("expected no Explorer refresh for release candidates, got:\n%s", result.curlArguments)
	}
}

type distributionTriggerResult struct {
	output        string
	curlArguments string
	err           error
}

func runDistributionTriggers(t *testing.T, channel string, explorerHTTPStatus string, explorerExitStatus string) distributionTriggerResult {
	t.Helper()

	rootDir := t.TempDir()
	releaseScriptsDir := filepath.Join(rootDir, "release-scripts")
	binaryReleasesDir := filepath.Join(rootDir, "binary-releases")
	binDir := filepath.Join(rootDir, "bin")
	for _, directory := range []string{releaseScriptsDir, binaryReleasesDir, binDir} {
		if err := os.MkdirAll(directory, 0755); err != nil {
			t.Fatal(err)
		}
	}

	copyTestFile(t, repoPath(t, "release-scripts", "upload-artifacts.sh"), filepath.Join(releaseScriptsDir, "upload-artifacts.sh"), 0755)
	writeTestFile(t, filepath.Join(releaseScriptsDir, "determine-release-channel.sh"), fmt.Sprintf("#!/usr/bin/env bash\necho %s\n", channel), 0755)
	writeTestFile(t, filepath.Join(binaryReleasesDir, "version"), "1.2.3\n", 0644)
	writeTestFile(t, filepath.Join(binaryReleasesDir, "ls-protocol-version-test"), "1\n", 0644)

	curlLog := filepath.Join(rootDir, "curl-arguments")
	mockCurl := `#!/usr/bin/env bash
printf '%s\n' '--- request ---' "$@" >> "$MOCK_CURL_LOG"
if [[ "$*" == *"endpoint-binary-explorer/actions/workflows"* ]]; then
  printf '%s' "$MOCK_EXPLORER_HTTP_STATUS"
  exit "$MOCK_EXPLORER_EXIT_STATUS"
fi
printf '204'
`
	writeTestFile(t, filepath.Join(binDir, "curl"), mockCurl, 0755)

	command := exec.Command("bash", "./release-scripts/upload-artifacts.sh", "trigger-distribution-channels")
	command.Dir = rootDir
	command.Env = environmentWithOverrides(os.Environ(), map[string]string{
		"HAMMERHEAD_GITHUB_PAT":     "test-token",
		"MOCK_CURL_LOG":             curlLog,
		"MOCK_EXPLORER_EXIT_STATUS": explorerExitStatus,
		"MOCK_EXPLORER_HTTP_STATUS": explorerHTTPStatus,
		"PATH":                      binDir + string(os.PathListSeparator) + os.Getenv("PATH"),
		"TMPDIR":                    rootDir,
	})
	output, err := command.CombinedOutput()
	curlArguments, readErr := os.ReadFile(curlLog)
	if readErr != nil {
		t.Fatal(readErr)
	}

	return distributionTriggerResult{
		output:        string(output),
		curlArguments: string(curlArguments),
		err:           err,
	}
}

func copyTestFile(t *testing.T, source string, destination string, mode os.FileMode) {
	t.Helper()
	contents, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, destination, string(contents), mode)
}

func writeTestFile(t *testing.T, path string, contents string, mode os.FileMode) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), mode); err != nil {
		t.Fatal(err)
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
