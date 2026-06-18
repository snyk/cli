package persona

import (
	"os"

	"github.com/mattn/go-isatty"
)

// InteractiveMode is a bitmask that records which of the standard streams are
// attached to a terminal.
type InteractiveMode uint8

const (
	StdinTTY  InteractiveMode = 1 << iota // stdin is attached to a terminal
	StdoutTTY                              // stdout is attached to a terminal
	StderrTTY                              // stderr is attached to a terminal
)

// isTerminal reports whether the given file is attached to a terminal. It
// covers both native terminals and cygwin/msys2 terminals (e.g. git-bash on
// Windows), which are detected by a separate code path in go-isatty.
func isTerminal(f *os.File) bool {
	return isatty.IsTerminal(f.Fd()) || isatty.IsCygwinTerminal(f.Fd())
}

// getInteractiveMode builds an InteractiveMode bitmask using check to test
// each standard stream.
func getInteractiveMode(check func(*os.File) bool) InteractiveMode {
	var m InteractiveMode
	if check(os.Stdin) {
		m |= StdinTTY
	}
	if check(os.Stdout) {
		m |= StdoutTTY
	}
	if check(os.Stderr) {
		m |= StderrTTY
	}
	return m
}

// GetInteractiveMode probes the standard streams and returns a bitmask
// describing which of them are attached to a terminal.
func GetInteractiveMode() InteractiveMode {
	return getInteractiveMode(isTerminal)
}
