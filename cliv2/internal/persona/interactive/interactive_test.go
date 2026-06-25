package interactive

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_getInteractiveMode(t *testing.T) {
	yes := func(*os.File) bool { return true }
	no := func(*os.File) bool { return false }
	only := func(target *os.File) func(*os.File) bool {
		return func(f *os.File) bool { return f == target }
	}
	stdinAndStdout := func(f *os.File) bool { return f == os.Stdin || f == os.Stdout }

	testCases := []struct {
		name  string
		check func(*os.File) bool
		isCI  bool
		want  InteractiveMode
	}{
		{"all TTY", yes, false, StdinTTY | StdoutTTY | StderrTTY},
		{"no TTY", no, false, 0},
		{"only stdin", only(os.Stdin), false, StdinTTY},
		{"only stdout", only(os.Stdout), false, StdoutTTY},
		{"only stderr", only(os.Stderr), false, StderrTTY},
		{"stdin and stdout", stdinAndStdout, false, StdinTTY | StdoutTTY},
		// In CI the stdin bit is droppedd
		{"CI clears stdin", only(os.Stdin), true, 0},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, getInteractiveMode(tc.check, tc.isCI))
		})
	}
}

func Test_InteractiveMode_Has(t *testing.T) {
	const all = StdinTTY | StdoutTTY | StderrTTY

	testCases := []struct {
		name string
		mode InteractiveMode
		mask InteractiveMode
		want bool
	}{
		{"single bit set", StdinTTY, StdinTTY, true},
		{"single bit absent", StdoutTTY, StdinTTY, false},
		{"combined mask fully set", all, StdoutTTY | StderrTTY, true},
		{"combined mask only partially set", StdoutTTY, StdoutTTY | StderrTTY, false},
		{"zero mode has no bits", 0, StdinTTY, false},
		{"empty mask is vacuously satisfied", StdinTTY, 0, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.mode.Has(tc.mask))
		})
	}
}

func Test_isTerminal_pipeIsNotATerminal(t *testing.T) {
	r, w, err := os.Pipe()
	require.NoError(t, err)
	defer r.Close()
	defer w.Close()

	assert.False(t, isTerminal(r), "read end of a pipe is not a terminal")
	assert.False(t, isTerminal(w), "write end of a pipe is not a terminal")
}

func Test_isTerminal_regularFileIsNotATerminal(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "interactive-test")
	require.NoError(t, err)
	defer f.Close()

	assert.False(t, isTerminal(f), "a regular file is not a terminal")
}

func Test_GetInteractiveMode_underTestIsNonInteractive(t *testing.T) {
	// The go test runner does not allocate a TTY for the standard streams, so
	// no stream should be flagged as a terminal.
	assert.Equal(t, InteractiveMode(0), GetInteractiveMode(false))
}
