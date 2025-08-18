package utils

import (
	"slices"
	"strings"
)

const (
	MIN_ARG_LENGTH = 5
	FLAG_PREFIX    = "-"
)

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
		isPotentiallySensitive := len(arg) >= MIN_ARG_LENGTH
		if !isFlag && !isKnownCommand && isPotentiallySensitive {
			argValues = append(argValues, arg)
		}
	}

	slices.Sort(argValues)
	argValues = slices.Compact(argValues)

	return argValues
}
