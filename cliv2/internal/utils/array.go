package utils

import (
	"fmt"
	"strings"
)

func Contains(list []string, element string) bool {
	for _, a := range list {
		if a == element {
			return true
		}
	}
	return false
}

func RemoveSimilar(list []string, element string) []string {
	filteredArgs := []string{}

	for _, a := range list {
		if !strings.Contains(a, element) {
			filteredArgs = append(filteredArgs, a)
		}
	}

	return filteredArgs
}

func ToKeyValueMap(input []string, splitBy string) map[string]string {
	result := make(map[string]string)

	for _, a := range input {
		splittedString := strings.SplitN(a, splitBy, 2)
		if len(splittedString) == 2 {
			key := splittedString[0]
			value := splittedString[1]
			result[key] = value
		}
	}

	return result
}

func ToSlice(input map[string]string, combineBy string) []string {
	result := []string{}

	for key, value := range input {
		entry := fmt.Sprintf("%s%s%s", key, combineBy, value)
		result = append(result, entry)
	}

	return result
}
