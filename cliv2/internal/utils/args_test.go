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
		expectedResult CaptureAllArgsResult
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
			expectedResult: CaptureAllArgsResult{
				Command: "test --username=super.secret --password dasas -u sensitive data -p secret\"password -d --log-level=trace --filepath primary/path/to/file",
				Args:    []string{"test"},
				Options: map[string]interface{}{
					"username":  "super.secret",
					"password":  "dasas",
					"u":         "sensitive data",
					"p":         "secret\"password",
					"d":         nil,
					"log-level": "trace",
					"filepath":  "primary/path/to/file",
				},
				Operands: map[string]interface{}{},
				EnvVars:  map[string]string{},
			},
		},
		{
			name: "multiple subcommands with options",
			command: []string{
				"iac",
				"update-exclude-policy",
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
			expectedResult: CaptureAllArgsResult{
				Command: "iac update-exclude-policy --username=super.secret --password dasas -u sensitive data -p secret\"password -d --log-level=trace --filepath primary/path/to/file",
				Args:    []string{"iac", "update-exclude-policy"},
				Options: map[string]interface{}{
					"username":  "super.secret",
					"password":  "dasas",
					"u":         "sensitive data",
					"p":         "secret\"password",
					"d":         nil,
					"log-level": "trace",
					"filepath":  "primary/path/to/file",
				},
				Operands: map[string]interface{}{},
				EnvVars:  map[string]string{},
			},
		},
		{
			name: "basic command with options and env vars",
			command: []string{
				"test",
				"--username=super.secret",
				"--password",
				"dasas",
			},
			env: []string{"SNYK_TOKEN=mySuperSecretToken"},
			expectedResult: CaptureAllArgsResult{
				Command: "test --username=super.secret --password dasas",
				Args:    []string{"test"},
				Options: map[string]interface{}{
					"username": "super.secret",
					"password": "dasas",
				},
				Operands: map[string]interface{}{},
				EnvVars:  map[string]string{"SNYK_TOKEN": "mySuperSecretToken"},
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
			expectedResult: CaptureAllArgsResult{
				Command: "container test --username=super.secret --password dasas -d --log-level=trace --aFlagWithNoValue -- --another-flag anotherFlagValue --filepath primary/path/to/file -i",
				Args:    []string{"container", "test"},
				Options: map[string]interface{}{
					"username":         "super.secret",
					"password":         "dasas",
					"d":                nil,
					"log-level":        "trace",
					"aFlagWithNoValue": nil,
				},
				Operands: map[string]interface{}{
					"another-flag": "anotherFlagValue",
					"filepath":     "primary/path/to/file",
					"i":            nil,
				},
				EnvVars: map[string]string{"SNYK_TOKEN": "mySuperSecretToken", "SNYK_API": "api.helloworld.io"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actualResult := CaptureAllArgs(tc.command, tc.env)
			assert.Equal(t, tc.expectedResult, actualResult)
		})
	}
}
