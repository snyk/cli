package cliv2_test

import (
	"io/ioutil"
	"log"
	"os"
	"sort"
	"testing"

	"github.com/snyk/cli/cliv2/internal/cliv2"

	"github.com/stretchr/testify/assert"
)

func Test_PrepareV1EnvironmentVariables_Fill(t *testing.T) {

	input := []string{"something=1", "in=2", "here=3=2"}
	expected := []string{"something=1", "in=2", "here=3=2", "SNYK_INTEGRATION_NAME=foo", "SNYK_INTEGRATION_VERSION=bar", "HTTP_PROXY=proxy", "HTTPS_PROXY=proxy", "NODE_EXTRA_CA_CERTS=cacertlocation"}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_DontOverrideExisting(t *testing.T) {

	input := []string{"something=1", "in=2", "here=3", "SNYK_INTEGRATION_NAME=exists", "SNYK_INTEGRATION_VERSION=already", "HTTP_PROXY=proxy", "HTTPS_PROXY=proxy", "NODE_EXTRA_CA_CERTS=cacertlocation"}
	expected := input

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_DontOverrideExisting2(t *testing.T) {

	input := []string{"something=1", "in=2", "here=3", "SNYK_INTEGRATION_NAME=exists"}
	expected := input

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "unused", "unused")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)

	warn, ok := err.(cliv2.EnvironmentWarning)
	assert.True(t, ok)
	assert.NotNil(t, warn)
}

func Test_prepareV1Command(t *testing.T) {
	expectedArgs := []string{"hello", "world"}

	snykCmd, err := cliv2.PrepareV1Command(
		"someExecutable",
		expectedArgs,
		1,
		"certLocation",
		"name",
		"version",
	)

	assert.Contains(t, snykCmd.Env, "SNYK_INTEGRATION_NAME=name")
	assert.Contains(t, snykCmd.Env, "SNYK_INTEGRATION_VERSION=version")
	assert.Contains(t, snykCmd.Env, "HTTPS_PROXY=http://127.0.0.1:1")
	assert.Contains(t, snykCmd.Env, "NODE_EXTRA_CA_CERTS=certLocation")
	assert.Equal(t, expectedArgs, snykCmd.Args[1:])
	assert.Nil(t, err)
}

func Test_executeRunV1(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := "dasda"
	logger := log.New(ioutil.Discard, "", 0)

	assert.NoDirExists(t, cacheDir)

	// create instance under test
	cli := cliv2.NewCLIv2(cacheDir, logger)

	// run once
	actualReturnCode := cli.Execute(1000, "", []string{"--help"})
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo1, _ := os.Stat(cli.GetBinaryLocation())

	// run twice
	actualReturnCode = cli.Execute(1000, "", []string{"--help"})
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo2, _ := os.Stat(cli.GetBinaryLocation())

	assert.Equal(t, fileInfo1.ModTime(), fileInfo2.ModTime())

	// cleanup
	os.RemoveAll(cacheDir)
}

func Test_executeRunV2only(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := "dasda"
	logger := log.New(ioutil.Discard, "", 0)

	assert.NoDirExists(t, cacheDir)

	// create instance under test
	cli := cliv2.NewCLIv2(cacheDir, logger)
	actualReturnCode := cli.Execute(1000, "", []string{"--version"})
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())

	os.RemoveAll(cacheDir)
}

func Test_executeEnvironmentError(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := "dasda"
	logger := log.New(ioutil.Discard, "", 0)

	assert.NoDirExists(t, cacheDir)

	// fill Environment Variable
	os.Setenv(cliv2.SNYK_INTEGRATION_NAME_ENV, "someName")

	// create instance under test
	cli := cliv2.NewCLIv2(cacheDir, logger)
	actualReturnCode := cli.Execute(1000, "", []string{"--help"})
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())

	os.RemoveAll(cacheDir)
}

func Test_executeUnknownCommand(t *testing.T) {
	expectedReturnCode := cliv2.SNYK_EXIT_CODE_ERROR

	cacheDir := "dasda"
	logger := log.New(ioutil.Discard, "", 0)

	// create instance under test
	cli := cliv2.NewCLIv2(cacheDir, logger)
	actualReturnCode := cli.Execute(1000, "", []string{"bogusCommand"})
	assert.Equal(t, expectedReturnCode, actualReturnCode)

	os.RemoveAll(cacheDir)
}
