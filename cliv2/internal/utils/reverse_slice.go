package utils

// Creates a new slice in reverse order of the input slice and leave the input slice unchanged
func GetReverseSlice[T any](items []T) []T {
	reversed := []T{}
	for i := len(items) - 1; i >= 0; i-- {
		reversed = append(reversed, items[i])
	}
	return reversed
}
