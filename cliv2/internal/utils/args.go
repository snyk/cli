package utils

import (
	"slices"
	"strings"

	"github.com/snyk/go-application-framework/pkg/logging"
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

// GetUnknownParameters returns the tokens of osArgs and envVars that could plausibly
// be secrets. A bare token qualifies only when the token immediately before it is a
// flag that no registered workflow declared: the value of a declared flag, and any
// positional operand, is something the CLI knowingly accepts and so is not guessed at.
// The length floor, the known command check and the allow list then narrow that
// candidate set further.
//
// Environment variables need no special case. They arrive joined as "--NAME VALUE" and
// an environment variable name is never a declared flag, so their values stay candidates.
func GetUnknownParameters(osArgs []string, envVars []string, knownCommands []string, knownFlags []string) []string {
	return unknownParameters(osArgs, envVars, knownCommands, knownFlags, true)
}

// GetAllUnknownParameters is the wider sweep: every bare token that clears the length
// floor, the known command check and the allow list is a candidate, whatever precedes it.
// It over-redacts, which is only the right trade for the debug log, where the user reads
// the output before sharing it. Analytics has no human in the loop, so it uses
// GetUnknownParameters instead.
func GetAllUnknownParameters(osArgs []string, envVars []string, knownCommands []string) []string {
	return unknownParameters(osArgs, envVars, knownCommands, nil, false)
}

func unknownParameters(osArgs []string, envVars []string, knownCommands []string, knownFlags []string, onlyUndeclaredFlagValues bool) []string {
	argsOneString := strings.Join(osArgs, " ")
	if len(envVars) > 0 {
		argsOneString = argsOneString + " --" + strings.Join(envVars, " --")
	}

	argsOneString = strings.ReplaceAll(argsOneString, "=", " ")
	argsSplitAgain := strings.Split(argsOneString, " ")

	argValues := []string{}
	prevWasUnknownFlag := false
	for _, arg := range argsSplitAgain {
		if strings.HasPrefix(arg, FLAG_PREFIX) {
			prevWasUnknownFlag = !isTrustedFlag(strings.TrimLeft(arg, FLAG_PREFIX), knownFlags)
			continue
		}

		isCandidatePosition := prevWasUnknownFlag || !onlyUndeclaredFlagValues
		isKnownCommand := slices.Contains(knownCommands, arg)
		isAllowedWord := allowedWords[strings.ToLower(arg)]
		isPotentiallySensitive := len(arg) >= MIN_ARG_LENGTH
		if isCandidatePosition && !isKnownCommand && !isAllowedWord && isPotentiallySensitive {
			argValues = append(argValues, arg)
		}
		prevWasUnknownFlag = false
	}

	slices.Sort(argValues)
	argValues = slices.Compact(argValues)

	return argValues
}

// isTrustedFlag reports whether the value following the flag named name can be left
// alone. A flag some workflow declared is trusted, unless its name matches one of the
// sensitive field names the scrubber already knows about (--tfc-token, --username and
// friends) — a declared flag can still be the one carrying the secret.
func isTrustedFlag(name string, knownFlags []string) bool {
	if !slices.Contains(knownFlags, name) {
		return false
	}

	lowercaseName := strings.ToLower(name)
	for _, sensitive := range logging.SENSITIVE_FIELD_NAMES {
		if strings.Contains(lowercaseName, sensitive) {
			return false
		}
	}

	return true
}
