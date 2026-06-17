package utils

import (
	"os"

	"github.com/mattn/go-isatty"
)

// isTerminal reports whether the given file is attached to a terminal. It
// covers both native terminals and cygwin/msys2 terminals (e.g. git-bash on
// Windows), which are detected by a separate code path in go-isatty.
func isTerminal(f *os.File) bool {
	return isatty.IsTerminal(f.Fd()) || isatty.IsCygwinTerminal(f.Fd())
}

// IsInteractive reports whether the CLI is running interactively, i.e. stdin
// is attached to a terminal.
func IsInteractive() bool {
	return isTerminal(os.Stdin)
}
