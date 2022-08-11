package main

import (
	"strings"
	"testing"

	"github.com/snyk/cli/cliv2/test"
	"github.com/stretchr/testify/assert"
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

func Test_debug_mode(t *testing.T) {
	type TestCase struct {
		args                   []string
		expectedExitCode       int
		expectedStderrContains string
	}

	cases := []TestCase{
		{[]string{""}, 0, ""},
		{[]string{"--debug"}, 0, "debug: true"},
		{[]string{"-d"}, 0, "debug: true"},
	}

	for _, c := range cases {
		res := test.SetupTestProject(t).LaunchCLI(t, c.args)
		assert.Equal(t, res.ExitCode, c.expectedExitCode)
		assert.Contains(t, res.Stderr, c.expectedStderrContains)
	}
}

func Test_passesExitCode(t *testing.T) {
	args := []string{"test"}
	testProject := test.SetupTestProjectWithFixture(t, "test/fixtures/npm-test-proj-with-vulns")
	res := testProject.LaunchCLI(t, args)
	assert.Equal(t, res.ExitCode, 1)
	assert.Contains(t, res.Stdout, "found 4 issues")

	args = []string{"test"}
	testProject = test.SetupTestProjectWithFixture(t, "test/fixtures/npm-test-proj-no-vulns")
	res = testProject.LaunchCLI(t, args)
	assert.Equal(t, res.ExitCode, 0)
	assert.Contains(t, res.Stdout, "no vulnerable paths found")
}

func Test_canPassThroughArgs(t *testing.T) {
	args := []string{"test", "--print-deps"}
	testProject := test.SetupTestProjectWithFixture(t, "test/fixtures/npm-test-proj-with-vulns")
	res := testProject.LaunchCLI(t, args)
	assert.Equal(t, res.ExitCode, 1)
	assert.Contains(t, res.Stdout, "npm-test-proj-with-vulns @ 1.0.0")
	assert.Contains(t, res.Stdout, "└─ lodash @ 4.17.15")
	assert.Contains(t, res.Stdout, "found 4 issues")
}
