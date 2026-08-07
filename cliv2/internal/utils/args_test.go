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
				"primary/path/to/file",
				"secret\"password",
				"sensitive",
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
				"sensitive",
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
	}

	knownCommands := []string{"test", "iac", "container", "update-exclude-policy"}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actualResult := GetUnknownParameters(tc.command, tc.env, knownCommands)
			assert.Equal(t, tc.expectedResult, actualResult)
		})
	}
}
