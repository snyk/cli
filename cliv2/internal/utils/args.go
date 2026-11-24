package utils

// allowedWords is generated so it tracks the words CLI and GAF actually log; see ../tools/gen-allowed-words.
//go:generate go run ../tools/gen-allowed-words/main.go -output allowed_words_generated.go

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
