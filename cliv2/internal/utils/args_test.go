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
			name: "env vars, with duplicate values collapsed",
			command: []string{
				"super.secret",
				"dasas",
			},
			env: []string{
				"SNYK_TOKEN=mySuperSecretToken",
				"SNYK_OTHER_TOKEN=mySuperSecretToken",
			},
			expectedResult: []string{
				"mySuperSecretToken",
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
				"super.secret",
			},
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
