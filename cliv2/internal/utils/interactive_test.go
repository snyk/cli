package utils

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

func Test_IsInteractive_underTestIsNonInteractive(t *testing.T) {
	// The go test runner does not allocate a TTY for stdin, so the CLI must
	// consider itself non-interactive in this environment.
	assert.False(t, IsInteractive())
}
