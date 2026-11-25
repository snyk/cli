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
		word := strings.TrimFunc(arg, isDelimiterRune)
		isFlag := strings.HasPrefix(arg, FLAG_PREFIX)
		isKnownCommand := slices.Contains(knownCommands, arg) || slices.Contains(knownCommands, word)
		isAllowedWord := allowedWords[strings.ToLower(word)]
		isPotentiallySensitive := len(word) >= MIN_ARG_LENGTH
		if !isFlag && !isKnownCommand && !isAllowedWord && isPotentiallySensitive {
			// Both forms, because the log may contain the value with or without its punctuation, and the scrubber applies longer terms first.
			argValues = append(argValues, arg, word)
		}
	}

	slices.Sort(argValues)
	argValues = slices.Compact(argValues)

	return argValues
}

// Only prose and JSON delimiters, because other symbols may be part of a secret and must keep it above the minimum length.
func isDelimiterRune(r rune) bool {
	return strings.ContainsRune(`"',:;.()[]{}`, r)
}
