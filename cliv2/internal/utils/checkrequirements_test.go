package utils

import (
	"errors"
	"os/exec"
	"runtime"
	"strings"
	"testing"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_ValidateGlibcVersion_doesNotApplyOnNonLinux(t *testing.T) {
	// skip for Linux
	if runtime.GOOS == "linux" {
		t.Skip("Test only applicable on non-Linux")
	}

	err := ValidateGlibcVersion()
	if err != nil {
		t.Errorf("Expected no error but got: %v", err)
	}
}

func Test_ValidateGlibcVersion_validates(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Test only applicable on Linux")
	}

	// Skip Alpine Linux because it does not use glibc
	out, err := exec.Command("ldd", "--version").CombinedOutput()
	if err != nil || strings.Contains(string(out), "musl") {
		t.Skip("Test only applicable on glibc-based Linux")
	}

	detectionErr := errors.New("detection failed")

	type test struct {
		name                string
		version             string
		versionError        error
		expectedSnykErrCode string
	}

	tests := []test{
		{
			name:    "Empty version (musl/Alpine)",
			version: "",
		},
		{
			name:         "Version detection returns error",
			versionError: detectionErr,
		},
	}

	amd64Tests := []test{
		{
			name:                "Version too old on amd64",
			version:             "2.27",
			expectedSnykErrCode: "SNYK-CLI-0000",
		},
		{
			name:    "Version exactly minimum on amd64",
			version: MIN_GLIBC_VERSION_LINUX_AMD64,
		},
		{
			name:    "Version newer than minimum on amd64",
			version: "2.35",
		},
	}

	arm64Tests := []test{
		{
			name:                "Version too old on arm64",
			version:             "2.30",
			expectedSnykErrCode: "SNYK-CLI-0000",
		},
		{
			name:    "Version exactly minimum on arm64",
			version: MIN_GLIBC_VERSION_LINUX_ARM64,
		},
		{
			name:    "Version newer than minimum on arm64",
			version: "2.35",
		},
	}

	switch runtime.GOARCH {
	case "amd64":
		tests = append(tests, amd64Tests...)
	case "arm64":
		tests = append(tests, arm64Tests...)
	default:
		t.Skip("Test only applicable on amd64 or arm64")
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockVersionFn := func() (string, error) {
				return tt.version, tt.versionError
			}

			actualErr := ValidateGlibcVersion(mockVersionFn)

			if tt.versionError != nil {
				assert.ErrorIs(t, actualErr, tt.versionError)
				return
			}

			if tt.expectedSnykErrCode != "" {
				require.NotNil(t, actualErr, "Expected error but got nil")
				var snykErr snyk_errors.Error
				require.True(t, errors.As(actualErr, &snykErr), "Expected snyk_errors.Error but got: %v", actualErr)
				assert.Equal(t, tt.expectedSnykErrCode, snykErr.ErrorCode)
			} else {
				assert.NoError(t, actualErr)
			}
		})
	}
}

func Test_ValidateGlibcVersion_semverCompare(t *testing.T) {
	mockVersionFn := func() (string, error) {
		return "invalid.version", nil
	}

	actualErr := ValidateGlibcVersion(mockVersionFn)
	assert.Error(t, actualErr, "Expected error for invalid version format")
}
