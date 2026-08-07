package utils

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_ParserGlibcVersion(t *testing.T) {
	testCases := []struct {
		name        string
		input       string
		expectedVer string
		expectError bool
	}{
		{
			name:        "Standard ldd output format",
			input:       "ldd (GNU libc) 2.31",
			expectedVer: "2.31",
			expectError: false,
		},
		{
			name:        "Standard ldd output format with extra info",
			input:       "ldd (Ubuntu GLIBC 2.35-0ubuntu3.8) 2.35",
			expectedVer: "2.35",
			expectError: false,
		},
		{
			name:        "getconf format",
			input:       "glibc 2.28",
			expectedVer: "2.28",
			expectError: false,
		},
		{
			name:        "Version at start of line",
			input:       "2.27 (GNU libc)",
			expectedVer: "2.27",
			expectError: false,
		},
		{
			name:        "Multi-digit minor version",
			input:       "ldd (GNU libc) 2.117",
			expectedVer: "2.117",
			expectError: false,
		},
		{
			name:        "Invalid format - no version",
			input:       "musl libc (x86_64)",
			expectedVer: "",
			expectError: true,
		},
		{
			name:        "Invalid format - empty string",
			input:       "",
			expectedVer: "",
			expectError: true,
		},
		{
			name:        "Invalid format - only text",
			input:       "some random text",
			expectedVer: "",
			expectError: true,
		},
		{
			name:        "Invalid format - single number",
			input:       "version 2",
			expectedVer: "",
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			parser := ParserGlibcVersion()
			result, err := parser(tc.input)

			if tc.expectError {
				assert.Error(t, err)
				assert.Equal(t, "", result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedVer, result)
			}
		})
	}
}

func Test_ParserGlibcFull(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Standard ldd output",
			input:    "ldd (GNU libc) 2.31",
			expected: "ldd (GNU libc) 2.31",
		},
		{
			name:     "Output with leading whitespace",
			input:    "  ldd (GNU libc) 2.31",
			expected: "ldd (GNU libc) 2.31",
		},
		{
			name:     "Output with trailing whitespace",
			input:    "ldd (GNU libc) 2.31  \n",
			expected: "ldd (GNU libc) 2.31",
		},
		{
			name:     "Output with both leading and trailing whitespace",
			input:    "  \t ldd (GNU libc) 2.31 \n\t ",
			expected: "ldd (GNU libc) 2.31",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Only whitespace",
			input:    "   \n\t  ",
			expected: "",
		},
		{
			name:     "Multiline output - only first matters",
			input:    "ldd (GNU libc) 2.31\nCopyright info\nMore text",
			expected: "ldd (GNU libc) 2.31\nCopyright info\nMore text",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			parser := ParserGlibcFull()
			result, err := parser(tc.input)

			assert.NoError(t, err)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func Test_GetGlibcDetails_NonLinux(t *testing.T) {
	if runtime.GOOS == "linux" {
		t.Skip("Test only applicable on non-Linux")
	}

	parser := ParserGlibcVersion()
	result := GetGlibcDetails(parser)

	assert.Equal(t, "", result, "Should return empty string on non-Linux")
}
