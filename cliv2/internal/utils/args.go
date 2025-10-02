package utils

import (
	"slices"
	"strings"
)

const (
	MIN_ARG_LENGTH = 5
	FLAG_PREFIX    = "-"
)

// Static allow list of common words that should not be redacted
// Only includes words >= MIN_ARG_LENGTH (5 characters) since shorter words are never considered sensitive
var allowedWords = map[string]bool{
	"false":   true,
	"trace":   true,
	"debug":   true,
	"error":   true,
	"fatal":   true,
	"panic":   true,
	"version": true,
	"verbose": true,
	"quiet":   true,
	"force":   true,

	// Severity levels (for severity-threshold parameter)
	"critical": true,
	"high":     true,
	"medium":   true,
	"low":      true,

	// Common enum values for various parameters
	"production":  true,
	"staging":     true,
	"development": true,

	"https": true,

	// Common architectures/platforms
	"linux":   true,
	"windows": true,
	"darwin":  true,
	"amd64":   true,
	"arm64":   true,
	"x86_64":  true,

	// Action words (not commands, but action descriptions)
	"scanning":   true,
	"monitoring": true,
	"testing":    true,

	// Status and result words
	"success":    true,
	"successful": true,
	"failed":     true,
	"failure":    true,
	"complete":   true,
	"completed":  true,
	"running":    true,
	"started":    true,
	"stopped":    true,
	"paused":     true,

	// State words
	"enabled":     true,
	"disabled":    true,
	"active":      true,
	"inactive":    true,
	"available":   true,
	"unavailable": true,
	"supported":   true,
	"unsupported": true,

	// Common CLI terms
	"vulnerability":   true,
	"vulnerabilities": true,
	"license":         true,
	"licenses":        true,
	"dependencies":    true,
	"dependency":      true,
	"package":         true,
	"packages":        true,
	"container":       true,
	"docker":          true,
	"kubernetes":      true,
	"terraform":       true,
	"infrastructure":  true,

	// Time and size units
	"seconds": true,
	"minutes": true,
	"hours":   true,
	"weeks":   true,
	"months":  true,
	"years":   true,
	"bytes":   true,

	// Scope and location words
	"local":    true,
	"remote":   true,
	"global":   true,
	"public":   true,
	"private":  true,
	"internal": true,
	"external": true,

	// Additional common environment variable values
	"secure":   true,
	"insecure": true,
	"strict":   true,
	"loose":    true,
	"timeout":  true,
	"retry":    true,
	"cache":    true,
	"proxy":    true,
}

func GetUnknownParameters(osArgs []string, envVars []string, knownCommands []string) []string {
	argsOneString := strings.Join(osArgs, " ")
	if len(envVars) > 0 {
		argsOneString = argsOneString + " --" + strings.Join(envVars, " --")
	}

	argsOneString = strings.ReplaceAll(argsOneString, "=", " ")
	argsSplitAgain := strings.Split(argsOneString, " ")

	argValues := []string{}
	for _, arg := range argsSplitAgain {
		isFlag := strings.HasPrefix(arg, FLAG_PREFIX)
		isKnownCommand := slices.Contains(knownCommands, arg)
		isAllowedWord := allowedWords[strings.ToLower(arg)]
		isPotentiallySensitive := len(arg) >= MIN_ARG_LENGTH
		if !isFlag && !isKnownCommand && !isAllowedWord && isPotentiallySensitive {
			argValues = append(argValues, arg)
		}
	}

	slices.Sort(argValues)
	argValues = slices.Compact(argValues)

	return argValues
}
