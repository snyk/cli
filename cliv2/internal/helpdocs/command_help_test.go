package helpdocs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_helpFileName(t *testing.T) {
	assert.Equal(t, "container-test.md", helpFileName([]string{"container", "test"}))
	assert.Equal(t, "iac-describe.md", helpFileName([]string{"iac", "describe"}))
	assert.Equal(t, "secrets-test.md", helpFileName([]string{"secrets", "test"}))
}

func Test_HasUserDoc(t *testing.T) {
	help := CommandHelpForTest(t)

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
			assert.Equal(t, tc.want, help.HasUserDoc(tc.segments))
		})
	}
}

func Test_NewCommandHelpFromFS(t *testing.T) {
	expected := FixtureCommandHelp()

	help, err := NewCommandHelp(fixtureCommandHelpFS(), ".")
	require.NoError(t, err)

	for _, segments := range [][]string{
		{"test"},
		{"container", "test"},
		{"rainmaker"},
	} {
		assert.Equal(t, expected.HasUserDoc(segments), help.HasUserDoc(segments), segments)
	}
}
