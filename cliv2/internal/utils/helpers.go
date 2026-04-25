package utils

import (
	"strings"

	"golang.org/x/mod/semver"
)

// Dedupe removes duplicate entries from a given slice.
// Returns a new, deduplicated slice.
//
// Example:
//
//	mySlice := []string{"apple", "banana", "apple", "cherry", "banana", "date"}
//	dedupedSlice := dedupe(mySlice)
//	fmt.Println(dedupedSlice) // Output: [apple banana cherry date]
func Dedupe(s []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, str := range s {
		if _, ok := seen[str]; !ok {
			seen[str] = true
			result = append(result, str)
		}
	}
	return result
}

// Contains checks if a given string is in a given list of strings.
// Returns true if the element was found, false otherwise.
//
// Example:
//
//		list := []string{"a", "b", "c"}
//		element := "b"
//	 contains := Contains(list, element)  // contains is true
func Contains(list []string, element string) bool {
	for _, a := range list {
		if a == element {
			return true
		}
	}
	return false
}

// SemverCompare compares two semantic version strings
func SemverCompare(v1 string, v2 string) int {
	// ensure v1 and v2 start with "v"
	if !strings.HasPrefix(v1, "v") {
		v1 = "v" + v1
	}
	if !strings.HasPrefix(v2, "v") {
		v2 = "v" + v2
	}

	if !semver.IsValid(v1) || !semver.IsValid(v2) {
		// return 0 to comply with semver.Compare()
		// "Falls back to 0 when either version is invalid semver."
		return 0
	}

	return semver.Compare(v1, v2)
}
