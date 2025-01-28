package utils

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
