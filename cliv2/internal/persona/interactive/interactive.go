package interactive

import (
	"os"

	"github.com/mattn/go-isatty"
)

// InteractiveMode is a bitmask recording which of the standard streams are
// attached to a terminal. Each stream is one bit, so a value can encode any
// combination.
type InteractiveMode uint8

// Stream bits, each a distinct power of two so they can be OR'd together.
const (
	StdinTTY  InteractiveMode = 1 << iota // stdin TTY flag (bit 0, value 1)
	StdoutTTY                             // stdout TTY flag (bit 1, value 2)
	StderrTTY                             // stderr TTY flag (bit 2, value 4)
)

// Has reports whether all bits in mask are set in m, so a combined mask
// (e.g. StdoutTTY|StderrTTY) requires every named stream to be a terminal.
func (m InteractiveMode) Has(mask InteractiveMode) bool {
	return m&mask == mask
}

// isTerminal reports whether the given file is attached to a terminal. It
// covers both native terminals and cygwin/msys2 terminals (e.g. git-bash on
// Windows), which are detected by a separate code path in go-isatty.
func isTerminal(f *os.File) bool {
	return isatty.IsTerminal(f.Fd()) || isatty.IsCygwinTerminal(f.Fd())
}

// GetInteractiveMode probes the standard streams and returns a bitmask
// describing which of them are attached to a terminal, clearing StdinTTY when
// isCI is true (see getInteractiveMode for the rationale).
func GetInteractiveMode(isCI bool) InteractiveMode {
	return getInteractiveMode(isTerminal, isCI)
}

// getInteractiveMode is the testable core of GetInteractiveMode: it builds the
// bitmask using check to probe each standard stream, so tests can inject a
// terminal check instead of relying on a real TTY.
func getInteractiveMode(check func(*os.File) bool, isCI bool) InteractiveMode {
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
	if isCI {
		// CI runners can't be trusted to report stdin honestly — some allocate a
		// terminal or otherwise manipulate the stream with no human present (e.g.
		// CircleCI injects null bytes into every command's stdin, see
		// https://github.com/CircleCI-Public/circleci-cli/issues/456#issuecomment-854201173).
		m &^= StdinTTY
	}
	return m
}
