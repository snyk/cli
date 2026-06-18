package helpdocs

import (
	"io/fs"
	"regexp"
	"strings"
)

var nonDocChars = regexp.MustCompile(`[^a-zA-Z0-9-]`)

// CommandHelp indexes embedded or test-supplied CLI command help markdown files.
type CommandHelp struct {
	files map[string]struct{}
}

// NewCommandHelp builds a lookup by walking root on fsys for *.md files.
func NewCommandHelp(fsys fs.FS, root string) (*CommandHelp, error) {
	docFiles, err := docFilesFromEmbed(fsys, root)
	if err != nil {
		return nil, err
	}

	return &CommandHelp{files: docFiles}, nil
}

// HasUserDoc reports whether legacy user-doc help should be shown for command segments.
// Empty segments -> true (top-level README via legacy help).
// Non-empty segments -> true only if a matching .md exists (README excluded).
func (h *CommandHelp) HasUserDoc(segments []string) bool {
	return hasUserDoc(segments, h.files)
}

func docFilesFromEmbed(fsys fs.FS, root string) (map[string]struct{}, error) {
	files := make(map[string]struct{})
	err := fs.WalkDir(fsys, root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".md") {
			return err
		}
		files[d.Name()] = struct{}{}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// helpFileName mirrors src/cli/commands/help/index.ts findHelpFile() join + replace.
func helpFileName(segments []string) string {
	joined := strings.Join(segments, "-")
	cleaned := nonDocChars.ReplaceAllString(joined, "")
	return cleaned + ".md"
}

func hasUserDoc(segments []string, files map[string]struct{}) bool {
	if len(segments) == 0 {
		return true
	}
	if len(files) == 0 {
		// Missing or empty embed at build time: prefer legacy help lookup.
		return true
	}
	for len(segments) > 0 {
		if _, ok := files[helpFileName(segments)]; ok {
			return true
		}
		segments = segments[:len(segments)-1]
	}
	return false
}
