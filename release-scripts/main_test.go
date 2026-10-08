package main

import (
	"os"
	"testing"
)

// TestMain isolates every git invocation (the tests' own and the ones made by the scripts under
// test) from the machine's git configuration, so results do not depend on init.defaultBranch,
// commit signing, or a missing user identity.
func TestMain(m *testing.M) {
	for key, value := range map[string]string{
		"GIT_CONFIG_GLOBAL":   os.DevNull,
		"GIT_CONFIG_SYSTEM":   os.DevNull,
		"GIT_CONFIG_NOSYSTEM": "1",
		"GIT_AUTHOR_NAME":     "Test User",
		"GIT_AUTHOR_EMAIL":    "test@example.com",
		"GIT_COMMITTER_NAME":  "Test User",
		"GIT_COMMITTER_EMAIL": "test@example.com",
	} {
		os.Setenv(key, value)
	}
	os.Exit(m.Run())
}
