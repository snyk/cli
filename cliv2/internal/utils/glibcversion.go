package utils

import (
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"
)

var (
	cachedVersion     string
	versionDetectOnce sync.Once
	versionRegex      = regexp.MustCompile(`(\d+\.\d+)`)
)

type GlibcParsers func(string) (string, error)

// DefaultGlibcVersion attempts to detect the glibc version on Linux systems
// The detection is performed only once and cached for subsequent calls
func DefaultGlibcVersion() string {
	versionDetectOnce.Do(func() {
		cachedVersion = GetGlibcDetails(ParserGlibcVersion())
	})
	return cachedVersion
}

// GetGlibcDetails attempts to detect the glibc version on Linux systems
func GetGlibcDetails(parser GlibcParsers) string {
	if runtime.GOOS != "linux" {
		return ""
	}

	// Method 1: Try ldd --version
	if out, err := exec.Command("ldd", "--version").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 0 {
			if result, err := parser(lines[0]); err == nil {
				return result
			}
		}
	}

	// Method 2: Try getconf GNU_LIBC_VERSION
	if out, err := exec.Command("getconf", "GNU_LIBC_VERSION").Output(); err == nil {
		if result, err := parser(string(out)); err == nil {
			return result
		}
	}

	return ""
}

func ParserGlibcFull() GlibcParsers {
	return func(details string) (string, error) {
		return strings.TrimSpace(details), nil
	}
}

func ParserGlibcVersion() GlibcParsers {
	return func(details string) (string, error) {
		if matches := versionRegex.FindStringSubmatch(details); len(matches) > 1 {
			return matches[1], nil
		}

		return "", fmt.Errorf("failed to parse glibc version")
	}
}
