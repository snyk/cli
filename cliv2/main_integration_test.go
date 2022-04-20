//go:build integration
// +build integration

package main

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"os"
	"snyk/cling/internal/embedded"
	"snyk/cling/internal/embedded/cliv1"
	"snyk/cling/test"
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

func Test_cliv1AlreadyExistsAndIsValid(t *testing.T) {
	testProject := test.SetupTestProject(t)

	// get target extraction path
	cliv1TargetExtractionPath, err := cliv1.GetFullCLIV1TargetPath(testProject.CacheDirPath)
	if err != nil {
		t.Errorf("failed to get cliv1 target extraction path: %s", err)
	}

	// extract the real cliv1 to the path
	cliv1.ExtractTo(cliv1TargetExtractionPath)

	cliv1FileInfoBefore, err := os.Stat(cliv1TargetExtractionPath)
	if err != nil {
		t.Fatal(err)
	}

	res := testProject.LaunchCLI(t, []string{"version", "--debug"})

	assert.Equal(t, res.ExitCode, 0)
	assert.Contains(t, res.Stderr, fmt.Sprintf("cliv1 already exists and is valid at %s", cliv1TargetExtractionPath))
	cliv1FileInfoAfter, err := os.Stat(cliv1TargetExtractionPath)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, cliv1FileInfoBefore.Size(), cliv1FileInfoAfter.Size())
	assert.Equal(t, cliv1FileInfoBefore.ModTime(), cliv1FileInfoAfter.ModTime())
}

func Test_cliv1AlreadyExistsAndIsInvalid(t *testing.T) {
	testProject := test.SetupTestProject(t)

	// get target extraction path
	cliv1TargetExtractionPath, err := cliv1.GetFullCLIV1TargetPath(testProject.CacheDirPath)
	if err != nil {
		t.Errorf("failed to get cliv1 target extraction path: %s", err)
	}

	// write a bogus file to cliv1TargetExtractionPath
	embedded.ExtractBytesToTarget([]byte(""), cliv1TargetExtractionPath)
	cliv1FileInfoBefore, err := os.Stat(cliv1TargetExtractionPath)
	if err != nil {
		t.Fatal(err)
	}

	res := testProject.LaunchCLI(t, []string{"--debug"})

	assert.Equal(t, res.ExitCode, 0)
	assert.Contains(t, res.Stderr, "cliv1 is not valid, start extracting")
	assert.Contains(t, res.Stderr, "cliv1 is valid after extracting")
	cliv1FileInfoAfter, err := os.Stat(cliv1TargetExtractionPath)
	if err != nil {
		t.Fatal(err)
	}
	assert.NotEqual(t, cliv1FileInfoBefore.Size(), cliv1FileInfoAfter.Size())
}
