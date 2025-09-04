package utils

import (
	"slices"
	"strings"
)

const (
	POSIX_END_OF_OPTIONS = "--"
	LONG_FLAG_PREFIX     = "--"
	SHORT_FLAG_PREFIX    = "-"
)

type CaptureAllArgsResult struct {
	// The original command
	Command string
	// The subcommands
	Args []string
	// The flags before the POSIX end of options delimiter
	Options map[string]interface{}
	// The flags after the POSIX end of options delimiter
	Operands map[string]interface{}
	// The environment variables
	EnvVars map[string]string
}

// CaptureAllArgs tries to capture all args in a POSIX compliant CLI command, it will return a struct with:
// - Args: the subcommands
// - Options: the flags before the POSIX end of options delimiter
// - Operands: the flags after the POSIX end of options delimiter
// - EnvVars: the environment variables
func CaptureAllArgs(osArgs []string, envVars []string) CaptureAllArgsResult {
	result := CaptureAllArgsResult{
		Command:  strings.Join(osArgs, " "),
		Args:     []string{},
		Options:  make(map[string]interface{}),
		Operands: make(map[string]interface{}),
		EnvVars:  make(map[string]string),
	}

	result.Args = captureArgs(osArgs)

	options, operands := getOptionsAndOperands(result.Args, osArgs)
	formattedOptions := formatFlags(options)
	formattedOperands := formatFlags(operands)

	result.Options = formatFlagset(formattedOptions, result.Options)
	result.Operands = formatFlagset(formattedOperands, result.Operands)
	result.EnvVars = captureAllEnvVars(envVars)

	return result
}

// captureAllEnvVars captures all the environment variables and returns them as a map of key-value pairs
func captureAllEnvVars(envVars []string) map[string]string {
	envVarsMap := make(map[string]string)
	for _, envVar := range envVars {
		parts := strings.Split(envVar, "=")
		envVarsMap[parts[0]] = parts[1]
	}
	return envVarsMap
}

// isFlagToken checks if a token is a flag token.
func isFlagToken(token string) bool {
	return strings.HasPrefix(token, LONG_FLAG_PREFIX) || strings.HasPrefix(token, SHORT_FLAG_PREFIX)
}

// captureArgs captures the leading positional args (subcommands) until first flag or the end of options delimiter
func captureArgs(args []string) []string {
	subcommands := []string{}
	i := 0
	for i < len(args) {
		arg := args[i]
		if isFlagToken(arg) {
			break
		}
		subcommands = append(subcommands, arg)
		i++
	}
	return subcommands
}

// formatFlagset formats the flags into a map of flag names and their values
func formatFlagset(args []string, flagSet map[string]interface{}) map[string]interface{} {
	name := ""
	for _, arg := range args {
		if strings.HasPrefix(arg, LONG_FLAG_PREFIX) {
			name = strings.TrimPrefix(arg, LONG_FLAG_PREFIX)
		} else {
			name = strings.TrimPrefix(arg, SHORT_FLAG_PREFIX)
		}

		if strings.Contains(name, "=") {
			parts := strings.Split(name, "=")
			flagSet[parts[0]] = parts[1]
		} else if strings.Contains(name, " ") {
			parts := strings.SplitN(name, " ", 2)
			flagSet[parts[0]] = parts[1]
		} else {
			flagSet[name] = nil
		}
	}
	return flagSet
}

// getOptionsAndOperands separates the options and operands from the args and returns them as separate lists
func getOptionsAndOperands(args []string, osArgs []string) (options []string, operands []string) {
	isOperand := false
	for _, arg := range osArgs {
		if slices.Contains(args, arg) {
			continue
		}
		if arg == POSIX_END_OF_OPTIONS {
			isOperand = true
			continue
		}
		if isOperand {
			operands = append(operands, arg)
		} else {
			options = append(options, arg)
		}
	}
	return options, operands
}

// formatFlags iterates over the flags and formats flags that are equals or space delimited, it returns a list of formatted flags.
func formatFlags(flags []string) []string {
	formattedFlags := []string{}
	for i, flag := range flags {
		// if it is not a flag, skip it
		if !isFlagToken(flag) {
			continue
		}

		// a flag with an equals delimeter
		if strings.Contains(flag, "=") {
			formattedFlags = append(formattedFlags, flag)
			continue
		}

		// a space delimited flag
		if i+1 < len(flags) && !isFlagToken(flags[i+1]) {
			formattedFlags = append(formattedFlags, flag+" "+flags[i+1])
			continue
		}

		// flag with no value
		formattedFlags = append(formattedFlags, flag)
	}
	return formattedFlags
}
