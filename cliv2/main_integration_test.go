//go:build integration
// +build integration

package main

import (
	"github.com/snyk/cli/cliv2/test"
	"github.com/stretchr/testify/assert"
	"strings"
	"testing"
)

func Test_init(t *testing.T) {
	args := []string{"version"}
	res := test.SetupTestProject(t).LaunchCLI(t, args)
	t.Log("ExitCode", res.ExitCode)
	t.Log("Stdout", res.Stdout)
	t.Log("Stderr", res.Stderr)

	versionString := strings.TrimSpace(res.Stdout)

	// from https://semver.org/
	semverRegexp := `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`

	assert.Equal(t, res.ExitCode, 0)
	assert.Regexp(t, semverRegexp, versionString)
}
