package helpdocs

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDocFiles() map[string]struct{} {
	names := []string{
		"README.md",
		"test.md",
		"container.md",
		"container-test.md",
		"iac-describe.md",
		"redteam.md",
	}
	files := make(map[string]struct{}, len(names))
	for _, name := range names {
		files[name] = struct{}{}
	}
	return files
}

func Test_helpFileName(t *testing.T) {
	assert.Equal(t, "container-test.md", helpFileName([]string{"container", "test"}))
	assert.Equal(t, "iac-describe.md", helpFileName([]string{"iac", "describe"}))
	assert.Equal(t, "secrets-test.md", helpFileName([]string{"secrets", "test"}))
}

func Test_hasUserDoc(t *testing.T) {
	files := testDocFiles()

	tests := map[string]struct {
		segments []string
		want     bool
	}{
		"empty uses readme path":             {segments: []string{}, want: true},
		"test command":                       {segments: []string{"test"}, want: true},
		"container test subcommand":          {segments: []string{"container", "test"}, want: true},
		"iac describe subcommand":            {segments: []string{"iac", "describe"}, want: true},
		"unknown command":                    {segments: []string{"rainmaker"}, want: false},
		"undocumented secrets test":          {segments: []string{"secrets", "test"}, want: false},
		"redteam setup walks back to parent": {segments: []string{"redteam", "setup"}, want: true},
		"undocumented agent-scan":            {segments: []string{"agent-scan"}, want: false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, hasUserDoc(files, tc.segments))
		})
	}
}

func Test_HasUserDoc_usesEmbeddedManifest(t *testing.T) {
	assert.True(t, HasUserDoc([]string{"test"}))
	assert.NotEmpty(t, docFiles)
}

func Test_manifestFileSet_stripsCRLFLineEndings(t *testing.T) {
	files := manifestFileSet("test.md\r\ncontainer-test.md\r\n")

	assert.True(t, hasUserDoc(files, []string{"test"}))
	assert.True(t, hasUserDoc(files, []string{"container", "test"}))
	assert.False(t, hasUserDoc(files, []string{"rainmaker"}))
}

func Test_manifestMatchesHelpCLICommands(t *testing.T) {
	helpDir := filepath.Join("..", "..", "..", "help", "cli-commands")
	entries, err := os.ReadDir(helpDir)
	require.NoError(t, err, "help/cli-commands must exist; run from repo root via go test ./pkg/helpdocs")

	var fromDisk []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		fromDisk = append(fromDisk, entry.Name())
	}
	sort.Strings(fromDisk)

	fromManifest := manifestEntries()
	assert.Equal(t, fromDisk, fromManifest,
		"embedded manifest.txt is out of sync with help/cli-commands; run: make -C cliv2 helpdocs-manifest")
}

func manifestEntries() []string {
	entries := manifestLines(manifest)
	sort.Strings(entries)
	return entries
}
