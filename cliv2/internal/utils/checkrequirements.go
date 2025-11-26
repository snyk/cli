package utils

import (
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
)

const (
	MIN_GLIBC_VERSION_LINUX_AMD64 = "2.28"
	MIN_GLIBC_VERSION_LINUX_ARM64 = "2.31"
)

var (
	cachedVersion     string
	cachedVersionErr  error
	versionDetectOnce sync.Once
	versionRegex      = regexp.MustCompile(`(\d+\.\d+)`)
)

type GlibcVersion func() (string, error)

// ValidateGlibcVersion checks if the glibc version is supported and returns an Error Catalog error if it is not.
// This check only applies to glibc-based Linux systems (amd64, arm64).
// Optionally accepts a custom GlibcVersion, mainly for testing.
func ValidateGlibcVersion(opt ...GlibcVersion) error {
	var versionFn GlibcVersion
	if len(opt) > 0 {
		versionFn = opt[0]
	} else {
		versionFn = defaultGlibcVersion()
	}

	version, err := versionFn()
	if err != nil {
		return err
	}

	// Skip validation on non-Linux or if glibc not detected
	if version == "" || runtime.GOOS != "linux" {
		return nil
	}

	var minVersion string
	switch runtime.GOARCH {
	case "arm64":
		minVersion = MIN_GLIBC_VERSION_LINUX_ARM64
	case "amd64":
		minVersion = MIN_GLIBC_VERSION_LINUX_AMD64
	default:
		return nil
	}

	res, err := SemverCompare(version, minVersion)
	if err != nil {
		return err
	}

	if res < 0 {
		return snyk_errors.Error{
			Title:       "Unsupported glibc version",
			Description: fmt.Sprintf("The installed glibc version, %s is not supported. Upgrade to a version of glibc >= %s", version, minVersion),
			ErrorCode:   "SNYK-CLI-0000",
			Links:       []string{"https://docs.snyk.io/developer-tools/snyk-cli/releases-and-channels-for-the-snyk-cli#runtime-requirements"},
		}
	}

	// We currently do not fail on Linux when glibc is not detected, which could lead to an ungraceful failure.
	// Failing here would require detectGlibcVersion to always return a valid version, which is not the case.
	return nil
}

// defaultGlibcVersion attempts to detect the glibc version on Linux systems
// The detection is performed only once and cached for subsequent calls
func defaultGlibcVersion() GlibcVersion {
	return func() (string, error) {
		versionDetectOnce.Do(func() {
			cachedVersion, cachedVersionErr = detectGlibcVersion()
		})
		return cachedVersion, cachedVersionErr
	}
}

// detectGlibcVersion attempts to detect the glibc version on Linux systems
func detectGlibcVersion() (string, error) {
	if runtime.GOOS != "linux" {
		return "", nil
	}

	// Method 1: Try ldd --version
	cmd := exec.Command("ldd", "--version")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		if len(lines) > 0 {
			// Parse version from first line, e.g., "ldd (GNU libc) 2.31"
			if matches := versionRegex.FindStringSubmatch(lines[0]); len(matches) > 1 {
				return matches[1], nil
			}
		}
	}

	// Method 2: Try getconf GNU_LIBC_VERSION
	cmd = exec.Command("getconf", "GNU_LIBC_VERSION")
	output, err = cmd.Output()
	if err == nil {
		// Output format: "glibc 2.31"
		if matches := versionRegex.FindStringSubmatch(string(output)); len(matches) > 1 {
			return matches[1], nil
		}
	}

	return "", nil
}
