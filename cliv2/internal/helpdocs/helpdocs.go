package helpdocs

import (
	_ "embed"
	"regexp"
	"strings"
)

//go:embed manifest.txt
var manifest string

var docFiles map[string]struct{}

var nonDocChars = regexp.MustCompile(`[^a-zA-Z0-9-]`)

func init() {
	docFiles = manifestFileSet(manifest)
}

// manifestFileSet builds the doc filename set from manifest text.
// Trims trailing carriage returns so CRLF-checked-out manifests still match lookups.
func manifestFileSet(manifestText string) map[string]struct{} {
	files := make(map[string]struct{})
	for _, line := range manifestLines(manifestText) {
		files[line] = struct{}{}
	}
	return files
}

func manifestLines(manifestText string) []string {
	var lines []string
	for _, line := range strings.Split(strings.TrimSpace(manifestText), "\n") {
		line = strings.TrimSuffix(line, "\r")
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

// helpFileName mirrors src/cli/commands/help/index.ts join + cleanse.
func helpFileName(segments []string) string {
	joined := strings.Join(segments, "-")
	cleaned := nonDocChars.ReplaceAllString(joined, "")
	return cleaned + ".md"
}

// HasUserDoc reports whether legacy user-doc help should be shown for command segments.
// Empty segments → true (top-level README via legacy help).
// Non-empty segments → true only if a matching .md exists during walk-back (README excluded).
func HasUserDoc(segments []string) bool {
	return hasUserDoc(docFiles, segments)
}

func hasUserDoc(files map[string]struct{}, segments []string) bool {
	if len(segments) == 0 {
		return true
	}
	if len(files) == 0 {
		// Missing or empty manifest at build time: prefer legacy help lookup.
		return true
	}
	args := append([]string(nil), segments...)
	for len(args) > 0 {
		if _, ok := files[helpFileName(args)]; ok {
			return true
		}
		args = args[:len(args)-1]
	}
	return false
}
