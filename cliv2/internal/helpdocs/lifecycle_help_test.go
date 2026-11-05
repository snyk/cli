package helpdocs

import (
	"io/fs"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// lifecycleHelpDir is the source of the command help that the Makefile embeds. It is read from the repository, so the
// test does not depend on the copy that the build makes.
const lifecycleHelpDir = "../../../help/cli-commands"

// Test_lifecycleCommands_haveUserDocs: install and uninstall have a user doc, so their help is the doc and not the Cobra
// usage, and the doc says they run the post-install actions that extensions provide.
func Test_lifecycleCommands_haveUserDocs(t *testing.T) {
	fsys := os.DirFS(lifecycleHelpDir)
	help, err := NewCommandHelp(fsys, ".")
	require.NoError(t, err)

	for _, command := range []string{"install", "uninstall"} {
		assert.True(t, help.HasUserDoc([]string{command}), "%s has a user doc", command)

		content, err := fs.ReadFile(fsys, command+".md")
		require.NoError(t, err)
		assert.Contains(t, string(content), "post-install actions provided by extensions", command)
		assert.Contains(t, string(content), "not package installs", command)
	}
	assert.False(t, help.HasUserDoc([]string{"rainmaker"}), "an unknown command has no user doc")
}
