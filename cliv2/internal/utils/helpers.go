package utils

import (
	"strconv"
	"strings"
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

// SemverCompare compares two semantic version strings component-wise
// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
// Example:
//
//	SemverCompare("2.27", "2.31") // returns -1
//	SemverCompare("2.31", "2.31") // returns 0
//	SemverCompare("2.35", "2.31") // returns 1
func SemverCompare(v1 string, v2 string) (int, error) {
	p1, err := parseSemver(v1)
	if err != nil {
		return 0, err
	}
	p2, err := parseSemver(v2)
	if err != nil {
		return 0, err
	}

	maxLen := len(p1)
	if len(p2) > maxLen {
		maxLen = len(p2)
	}

	for i := 0; i < maxLen; i++ {
		c1, c2 := 0, 0
		if i < len(p1) {
			c1 = p1[i]
		}
		if i < len(p2) {
			c2 = p2[i]
		}
		if c1 < c2 {
			return -1, nil
		}
		if c1 > c2 {
			return 1, nil
		}
	}
	return 0, nil
}

// parseSemver parses a semantic version string into a slice of integers
// Example:
//
//	parseSemver("2.27") // returns []int{2, 27}
//	parseSemver("2.31") // returns []int{2, 31}
//	parseSemver("2.35") // returns []int{2, 35}
func parseSemver(v string) ([]int, error) {
	if v == "" {
		return []int{}, nil
	}
	parts := strings.Split(v, ".")
	nums := make([]int, len(parts))
	for i, p := range parts {
		n, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil {
			return nil, err
		}
		nums[i] = n
	}
	return nums, nil
}
