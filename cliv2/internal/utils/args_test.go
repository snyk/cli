package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_CaptureAllArgs(t *testing.T) {
	testCases := []struct {
		name           string
		command        []string
		env            []string
		expectedResult []string
	}{
		{
			// --filepath is declared, so primary/path/to/file is a value the CLI knowingly
			// accepts and is deliberately absent from the expectations. --report-path is
			// not declared, so a path-shaped value behind it keeps being swept, which is
			// the coverage the declared flag would otherwise have taken with it.
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
				"--report-path",
				"secondary/path/to/file",
			},
			env: []string{},
			expectedResult: []string{
				"dasas",
				"secondary/path/to/file",
				"secret\"password",
				"sensitive",
				"super.secret",
			},
		},
		{
			// CLI-1819, deliberate reversal. This case used to assert that every bare
			// positional operand is swept up as a candidate secret. That is what made
			// the sweep destroy real analytics values: `snyk agent feedback "<prose>"`
			// redacted its own assessment text, because the prose was an argv token.
			// A positional operand is now a value the CLI knowingly accepts, so none of
			// these tokens is a candidate any more. Only the value of a flag no workflow
			// declared is.
			name: "bare positional operands are no longer swept",
			command: []string{
				"super.secret",
				"dasas",
				"sensitive",
				"secret\"password",
				"trace",
				"primary/path/to/file",
			},
			env:            []string{},
			expectedResult: []string{},
		},
		{
			// dasas sits behind an undeclared flag rather than standing alone as an
			// operand, which is what it takes for an argv value to be swept now. The two
			// environment entries carry the same value to pin the deduplication.
			name: "argv and env values together, with duplicates collapsed",
			command: []string{
				"--not-a-declared-flag",
				"dasas",
			},
			env: []string{
				"SNYK_TOKEN=mySuperSecretToken",
				"SNYK_OTHER_TOKEN=mySuperSecretToken",
			},
			expectedResult: []string{
				"dasas",
				"mySuperSecretToken",
			},
		},
		{
			// As in the first case, primary/path/to/file is absent because --filepath is
			// declared; anotherFlagValue stands in for a path-shaped value behind a flag
			// that is not.
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
				"super.secret",
			},
		},
		{
			// CLI-1819: an undeclared flag's value can be several whitespace-separated
			// words. Sweeping only the first would leave the rest of the secret in the
			// clear, which is exactly what `--custom-header "Bearer <token>"` looks like.
			name: "a multi-word value behind an undeclared flag is swept whole",
			command: []string{
				"test",
				"--custom-header",
				"Bearer abc123xyz",
			},
			env: []string{},
			expectedResult: []string{
				"Bearer",
				"abc123xyz",
			},
		},
		{
			name:    "a multi-word environment value is swept whole",
			command: []string{"test"},
			env: []string{
				"CUSTOM_HEADER=Bearer abc123xyz",
			},
			expectedResult: []string{
				"Bearer",
				"abc123xyz",
			},
		},
		{
			// CLI-1819: environment entries are rendered into the token stream as a flag
			// token no declared flag can match, so a variable that happens to share a
			// declared flag's name in lower case cannot borrow that flag's trust.
			name:    "an environment variable named after a declared flag is still swept",
			command: []string{"test"},
			env: []string{
				"filepath=mySuperSecretToken",
			},
			expectedResult: []string{
				"mySuperSecretToken",
			},
		},
		{
			// Neither the POSIX end-of-options marker nor a negative number is a flag, so
			// neither turns the operand after it into a flag value.
			name: "the end-of-options marker and a negative number are not flags",
			command: []string{
				"test",
				"--",
				"positional-operand-value",
				"-5",
				"another-operand-value",
			},
			env:            []string{},
			expectedResult: []string{},
		},
	}

	knownCommands := []string{"test", "iac", "container", "update-exclude-policy"}
	knownFlags := []string{"log-level", "filepath"}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actualResult := GetUnknownParameters(tc.command, tc.env, knownCommands, knownFlags)
			assert.Equal(t, tc.expectedResult, actualResult)
		})
	}
}
