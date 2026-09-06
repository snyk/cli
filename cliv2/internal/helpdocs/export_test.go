package helpdocs

import "testing"

func CommandHelpForTest(t *testing.T) *CommandHelp {
	t.Helper()
	return FixtureCommandHelp()
}
