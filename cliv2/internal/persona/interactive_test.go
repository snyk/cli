package persona

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

	testCases := []struct {
		name  string
		check func(*os.File) bool
		want  InteractiveMode
	}{
		{"all TTY", yes, StdinTTY | StdoutTTY | StderrTTY},
		{"no TTY", no, 0},
		{"only stdin", only(os.Stdin), StdinTTY},
		{"only stdout", only(os.Stdout), StdoutTTY},
		{"only stderr", only(os.Stderr), StderrTTY},
		{"stdin and stdout", func(f *os.File) bool { return f == os.Stdin || f == os.Stdout }, StdinTTY | StdoutTTY},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, getInteractiveMode(tc.check))
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
	assert.Equal(t, InteractiveMode(0), GetInteractiveMode())
}
