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

// Removes a given key from the input map and uses FindKeyCaseInsensitive() for this. The resulting map is being returned.
func Remove(input map[string]string, key string) map[string]string {
	found := false
	key, found = FindKeyCaseInsensitive(input, key)
	if found {
		delete(input, key)
	}
	return input
}

// This method determines whether the given key is in the input map, it therefore looks for the exact match and the key in all capital or lower case letters.
// If the key in any of these versions was found, it'll be returned alongside with a boolean indicating whether or not it was found.
func FindKeyCaseInsensitive(input map[string]string, key string) (string, bool) {

	found := false

	// look for exact match
	_, found = input[key]

	// look for lower case match
	if !found {
		key = strings.ToLower(key)
		_, found = input[key]
	}

	// look for upper case match
	if !found {
		key = strings.ToUpper(key)
		_, found = input[key]
	}

	return key, found
}
