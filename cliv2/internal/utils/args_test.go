package utils

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_CaptureAllArgs(t *testing.T) {
	testCases := []struct {
		name           string
		command        []string
		env            []string
		expectedResult []string
	}{
		{
			name: "basic command with options",
			command: []string{
				"test",
				"--username=super.secret",
				"--password",
				"dasas",
				"-u",
				"sensitive data",
				"-p",
				"secret\"password",
				"-d",
				"--log-level=trace",
				"--filepath",
				"primary/path/to/file",
			},
			env: []string{},
			expectedResult: []string{
				"dasas",
				"primary/path/to/file",
				"secret\"password",
				"super.secret",
			},
		},
		{
			name: "multiple subcommands with options",
			command: []string{
				"super.secret",
				"dasas",
				"sensitive",
				"secret\"password",
				"trace",
				"primary/path/to/file",
			},
			env: []string{},
			expectedResult: []string{
				"dasas",
				"primary/path/to/file",
				"secret\"password",
				"super.secret",
			},
		},
		{
			name: "basic command with options and env vars",
			command: []string{
				"super.secret",
				"dasas",
			},
			env: []string{"SNYK_TOKEN=mySuperSecretToken"},
			expectedResult: []string{
				"dasas",
				"mySuperSecretToken",
				"super.secret",
			},
		},
		{
			name: "multiple subcommands with options, operands and env vars",
			command: []string{
				"container",
				"test",
				"--username=super.secret",
				"--password",
				"dasas",
				"-d",
				"--log-level=trace",
				"--aFlagWithNoValue",
				"--",
				"--another-flag",
				"anotherFlagValue",
				"--filepath",
				"primary/path/to/file",
				"-i",
			},
			env: []string{
				"SNYK_TOKEN=mySuperSecretToken",
				"SNYK_API=api.helloworld.io",
			},
			expectedResult: []string{
				"anotherFlagValue",
				"api.helloworld.io",
				"dasas",
				"mySuperSecretToken",
				"primary/path/to/file",
				"super.secret",
			},
		},
		{
			name:    "env value with punctuation around words and secrets",
			command: []string{"test"},
			env: []string{
				`NOTE="ci": true, Version: "request" (response) MyS3cr3tK3y, "super.secret"`,
			},
			expectedResult: []string{
				"\"super.secret\"",
				"MyS3cr3tK3y",
				"MyS3cr3tK3y,",
				"super.secret",
			},
		},
		{
			name:           "known value ending in punctuation",
			command:        []string{"test"},
			env:            []string{"SNYK_API=https://api.example.invalid/"},
			expectedResult: []string{},
		},
	}

	knownCommands := []string{"test", "iac", "container", "update-exclude-policy", "https://api.example.invalid/"}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actualResult := GetUnknownParameters(tc.command, tc.env, knownCommands)
			assert.Equal(t, tc.expectedResult, actualResult)
		})
	}
}

func Test_AllowedWords_CommonLogTerms(t *testing.T) {
	// Test that common words from log messages are NOT redacted
	knownCommands := []string{"test"}

	testCases := []struct {
		name        string
		command     []string
		shouldAllow []string // words that should NOT appear in redaction list
	}{
		{
			name: "common log severity terms",
			command: []string{
				"test",
				"--param=error",
				"--level=debug",
				"--status=warning",
			},
			shouldAllow: []string{"error", "debug", "warning"},
		},
		{
			name: "common status words",
			command: []string{
				"test",
				"--state=failed",
				"--result=success",
				"--status=running",
				"--mode=enabled",
			},
			shouldAllow: []string{"failed", "success", "running", "enabled"},
		},
		{
			name: "common platform terms",
			command: []string{
				"test",
				"--os=linux",
				"--platform=windows",
				"--arch=amd64",
			},
			shouldAllow: []string{"linux", "windows", "amd64"},
		},
		{
			name: "vulnerability and security terms",
			command: []string{
				"test",
				"--type=vulnerability",
				"--check=license",
				"--scan=container",
			},
			shouldAllow: []string{"vulnerability", "license", "container"},
		},
		{
			name: "words seen over-redacted in customer debug logs",
			command: []string{
				"test",
				"--a=child",
				"--b=script",
				"--c=metrics",
				"--d=depth",
				"--e=require",
				"--f=branch",
				"--g=charset",
			},
			shouldAllow: []string{"child", "script", "metrics", "depth", "require", "branch", "charset"},
		},
		{
			name: "allowed words with leading or trailing punctuation",
			command: []string{
				"test",
				"--ci=true,",
				"--header=Version:",
				`--kind="request"`,
				"--note=(response)",
				"--summary=result:",
				"--count=files,",
			},
			shouldAllow: []string{"true,", "true", "Version:", "Version", `"request"`, "request", "(response)", "response", "result:", "result", "files,", "files"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetUnknownParameters(tc.command, []string{}, knownCommands)

			// Verify that allowed words do NOT appear in the redaction list
			for _, word := range tc.shouldAllow {
				assert.NotContains(t, result, word,
					"word %q should be allowed (not redacted) but was found in redaction list", word)
			}
		})
	}
}

func Test_AllowedWords_SecretsStillRedacted(t *testing.T) {
	// Test that realistic secrets ARE still redacted
	knownCommands := []string{"test"}
	// Built at runtime so secret scanners don't flag test fixtures as committed credentials.
	uuidToken := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", 1, 2, 3, 4, 5)
	mixedCasePassword := strings.Join([]string{"Not", "A", "Real", "Pa55"}, "")

	testCases := []struct {
		name         string
		command      []string
		env          []string
		shouldRedact []string // patterns that should still be redacted
	}{
		{
			name: "UUID tokens",
			command: []string{
				"test",
				"--token=" + uuidToken,
			},
			shouldRedact: []string{uuidToken},
		},
		{
			name: "alphanumeric tokens",
			command: []string{
				"test",
				"--api-key=abc123def456",
				"--password=" + mixedCasePassword,
			},
			shouldRedact: []string{"abc123def456", mixedCasePassword},
		},
		{
			name: "hex strings",
			command: []string{
				"test",
				"--secret=deadbeef1234567890abcdef",
			},
			shouldRedact: []string{"deadbeef1234567890abcdef"},
		},
		{
			name: "tokens with special characters",
			command: []string{
				"test",
				"--token=secret_key_123!@#",
			},
			shouldRedact: []string{"secret_key_123!@#"},
		},
		{
			name: "environment variable secrets",
			env: []string{
				"SNYK_TOKEN=1234567890abcdefghijklmnopqrstuvwxyz",
				"API_SECRET=MyS3cr3tK3y",
			},
			command: []string{"test"},
			shouldRedact: []string{
				"1234567890abcdefghijklmnopqrstuvwxyz",
				"MyS3cr3tK3y",
			},
		},
		{
			name: "secrets with leading or trailing punctuation are also redacted without it",
			env: []string{
				"API_SECRET=MyS3cr3tK3y,",
			},
			command: []string{
				"test",
				"--token=(abc123def456)",
				"--password=secret_key_123;",
			},
			shouldRedact: []string{
				"MyS3cr3tK3y,",
				"MyS3cr3tK3y",
				"(abc123def456)",
				"abc123def456",
				"secret_key_123;",
				"secret_key_123",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetUnknownParameters(tc.command, tc.env, knownCommands)

			// Verify that secrets DO appear in the redaction list
			for _, secret := range tc.shouldRedact {
				assert.Contains(t, result, secret,
					"secret %q should be redacted but was not found in redaction list", secret)
			}
		})
	}
}

func Test_GetUnknownParameters_ShortWordInsidePunctuation(t *testing.T) {
	knownCommands := []string{"test"}
	env := []string{
		"API_SECRET=Ab1!@#$%",
		"OTHER_SECRET=#$%^&*()",
	}

	result := GetUnknownParameters([]string{"test"}, env, knownCommands)

	assert.Contains(t, result, "Ab1!@#$%", "symbols that are not delimiters must stay part of the value")
	assert.NotContains(t, result, "Ab1", "a short word must not be redacted on its own")
	assert.Contains(t, result, "#$%^&*()")
	assert.Contains(t, result, "#$%^&*", "the value without its surrounding delimiters must also be redacted")
}

func Test_GetUnknownParameters_ShortWordInsideDelimitersIsNotRedacted(t *testing.T) {
	result := GetUnknownParameters([]string{"test"}, []string{`API_SECRET=Ab1",`}, []string{"test"})

	assert.Empty(t, result, "a value under the minimum length once its delimiters are trimmed is a known gap")
}

func Test_AllowedWords_ManualWordsPresent(t *testing.T) {
	// This test verifies that all words from manual-words.txt are present in allowedWords

	// Read the manual words file
	manualWordsPath := "../tools/gen-allowed-words/manual-words.txt"
	content, err := os.ReadFile(manualWordsPath)
	require.NoError(t, err, "failed to read manual-words.txt")

	lines := strings.Split(string(content), "\n")
	expectedWords := make([]string, 0)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		expectedWords = append(expectedWords, line)
	}

	// Verify each manual word is in allowedWords
	for _, word := range expectedWords {
		assert.True(t, allowedWords[word],
			"manual word %q from manual-words.txt is not in allowedWords (did you forget to regenerate?)", word)
	}

	t.Logf("Verified %d manual words are present in allowedWords", len(expectedWords))
}

func Test_AllowedWords_GeneratedFileUpToDate(t *testing.T) {
	// This test verifies that the generated file is up-to-date
	// by running the generator and comparing with the committed file

	// Run the generator to a temporary file
	tmpFile := filepath.Join(t.TempDir(), "allowed_words_generated.go")

	cmd := exec.Command("go", "run", "../tools/gen-allowed-words/main.go", "-output", tmpFile)
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, "failed to run generator: %s", string(output))

	// Read both files
	expectedContent := readFileContent(t, tmpFile)
	actualContent := readFileContent(t, "allowed_words_generated.go")

	// Compare (ignoring leading/trailing whitespace)
	expectedContent = strings.TrimSpace(expectedContent)
	actualContent = strings.TrimSpace(actualContent)

	assert.Equal(t, expectedContent, actualContent,
		"allowed_words_generated.go is out of date. Run 'go generate' to update it.")
}

func readFileContent(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	require.NoError(t, err, "failed to read file %s", path)
	return string(content)
}
