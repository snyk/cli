package helpdocs

import "testing/fstest"

var fixtureCommandHelpFiles = map[string]struct{}{
	"test.md":           {},
	"container.md":      {},
	"container-test.md": {},
	"iac.md":            {},
	"iac-describe.md":   {},
	"redteam.md":        {},
}

func fixtureCommandHelpFS() fstest.MapFS {
	fsMap := fstest.MapFS{
		"do-not-delete":     {Data: []byte("placeholder")},
		"nested/ignored.md": {Data: []byte("# nested")},
	}
	for name := range fixtureCommandHelpFiles {
		fsMap[name] = &fstest.MapFile{Data: []byte("# doc")}
	}
	return fsMap
}

// FixtureCommandHelp returns a minimal CommandHelp built from fstest.MapFS for unit tests.
func FixtureCommandHelp() *CommandHelp {
	help, err := NewCommandHelp(fixtureCommandHelpFS(), ".")
	if err != nil {
		panic("helpdocs: fixture command help: " + err.Error())
	}
	return help
}
