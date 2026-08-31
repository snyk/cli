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

// envFlagPrefix renders an environment entry into the token stream as a flag token that
// no declared flag can ever match: a pflag name never starts with a dash, so "---NAME"
// leaves a name of "-NAME". That keeps every environment value a redaction candidate
// under the general rule instead of a special case inside it, including when the
// variable is named after a real flag in lower case (CLI-1819).
const envFlagPrefix = FLAG_PREFIX + FLAG_PREFIX + FLAG_PREFIX

// GetUnknownParameters returns the tokens of osArgs and envVars that could plausibly be
// secrets. A bare token qualifies once a flag no registered workflow declared has been
// seen, and keeps qualifying until the next flag token: the value of a declared flag,
// and any positional operand, is something the CLI knowingly accepts and so is not
// guessed at, while an undeclared flag's value can be several whitespace-separated words
// and every one of them is suspect. The length floor, the known command check and the
// allow list then narrow that candidate set further.
//
// Environment variables need no special case. They arrive rendered as a flag token
// nothing can declare (see envFlagPrefix), so their values stay candidates.
func GetUnknownParameters(osArgs []string, envVars []string, knownCommands []string, knownFlags []string) []string {
	argValues := []string{}
	afterUndeclaredFlag := false

	for _, arg := range tokenize(osArgs, envVars) {
		if name, isFlag := flagName(arg); isFlag {
			afterUndeclaredFlag = !isTrustedFlag(name, knownFlags)
			continue
		}

		if afterUndeclaredFlag && isPossibleSecret(arg, knownCommands) {
			argValues = append(argValues, arg)
		}
	}

	return sortedUnique(argValues)
}

// GetAllUnknownParameters is the wider sweep: every bare token that clears the length
// floor, the known command check and the allow list is a candidate, whatever precedes it.
// It over-redacts, which is only the right trade for the debug log, where the user reads
// the output before sharing it. Analytics has no human in the loop, so it uses
// GetUnknownParameters instead.
func GetAllUnknownParameters(osArgs []string, envVars []string, knownCommands []string) []string {
	argValues := []string{}

	for _, arg := range tokenize(osArgs, envVars) {
		if !strings.HasPrefix(arg, FLAG_PREFIX) && isPossibleSecret(arg, knownCommands) {
			argValues = append(argValues, arg)
		}
	}

	return sortedUnique(argValues)
}

// tokenize flattens the command line and the environment into one whitespace-separated
// token stream. An "=" is treated as a separator, so both "--flag=value" and an
// environment entry split into a flag token and its value.
func tokenize(osArgs []string, envVars []string) []string {
	argsOneString := strings.Join(osArgs, " ")
	if len(envVars) > 0 {
		argsOneString = argsOneString + " " + envFlagPrefix + strings.Join(envVars, " "+envFlagPrefix)
	}

	return strings.Split(strings.ReplaceAll(argsOneString, "=", " "), " ")
}

// flagName returns the name of a flag token, which is the token with its leading dashes
// removed. At most two are removed, so an environment entry keeps the marker dash
// envFlagPrefix gave it. The second result is false when the token is not a flag at all:
// the POSIX end-of-options marker "--" and a negative number such as "-5" both look like
// one to a prefix test, and what follows either of them is an operand, not a flag value.
func flagName(arg string) (string, bool) {
	if !strings.HasPrefix(arg, FLAG_PREFIX) {
		return "", false
	}

	name := strings.TrimPrefix(strings.TrimPrefix(arg, FLAG_PREFIX), FLAG_PREFIX)
	if name == "" || (name[0] >= '0' && name[0] <= '9') {
		return "", false
	}

	return name, true
}

// isTrustedFlag reports whether the value following the flag named name can be left
// alone. A flag some workflow declared is trusted, unless its name matches one of the
// sensitive field names the scrubber already knows about (--tfc-token, --username and
// friends) — a declared flag can still be the one carrying the secret.
//
// knownFlags holds long names only, so a shorthand such as -d never matches and its
// value keeps being swept. That over-redacts and does not leak.
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

// isPossibleSecret applies the checks both sweeps share to a token already known to sit
// in a candidate position.
func isPossibleSecret(arg string, knownCommands []string) bool {
	return len(arg) >= MIN_ARG_LENGTH && !slices.Contains(knownCommands, arg) && !allowedWords[strings.ToLower(arg)]
}

func sortedUnique(values []string) []string {
	slices.Sort(values)
	return slices.Compact(values)
}
