package cliv2_test

import (
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path"
	"sort"
	"testing"
	"time"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"

	"github.com/stretchr/testify/assert"
)

func getCacheDir() string {
	cacheDir := path.Join(os.TempDir(), "snyk")
	os.RemoveAll(cacheDir)
	os.MkdirAll(cacheDir, 0755)
	return cacheDir
}

func Test_PrepareV1EnvironmentVariables_Fill_and_Filter(t *testing.T) {

	input := []string{
		"something=1",
		"in=2",
		"here=3=2",
		"NO_PROXY=noProxy",
		"HTTPS_PROXY=httpsProxy",
		"HTTP_PROXY=httpProxy",
		"NPM_CONFIG_PROXY=something",
		"NPM_CONFIG_HTTPS_PROXY=something",
		"NPM_CONFIG_HTTP_PROXY=something",
		"npm_config_no_proxy=something",
		"ALL_PROXY=something",
	}
	expected := []string{"something=1",
		"in=2",
		"here=3=2",
		"SNYK_INTEGRATION_NAME=foo",
		"SNYK_INTEGRATION_VERSION=bar",
		"HTTP_PROXY=proxy",
		"HTTPS_PROXY=proxy",
		"NODE_EXTRA_CA_CERTS=cacertlocation",
		"SNYK_SYSTEM_NO_PROXY=noProxy",
		"SNYK_SYSTEM_HTTP_PROXY=httpProxy",
		"SNYK_SYSTEM_HTTPS_PROXY=httpsProxy",
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY + ",noProxy",
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_DontOverrideExistingIntegration(t *testing.T) {

	input := []string{"something=1", "in=2", "here=3", "SNYK_INTEGRATION_NAME=exists", "SNYK_INTEGRATION_VERSION=already"}
	expected := []string{
		"something=1",
		"in=2",
		"here=3",
		"SNYK_INTEGRATION_NAME=exists",
		"SNYK_INTEGRATION_VERSION=already",
		"HTTP_PROXY=proxy",
		"HTTPS_PROXY=proxy",
		"NODE_EXTRA_CA_CERTS=cacertlocation",
		"SNYK_SYSTEM_NO_PROXY=",
		"SNYK_SYSTEM_HTTP_PROXY=",
		"SNYK_SYSTEM_HTTPS_PROXY=",
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY,
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_OverrideProxyAndCerts(t *testing.T) {

	input := []string{"something=1", "in=2", "here=3", "http_proxy=exists", "https_proxy=already", "NODE_EXTRA_CA_CERTS=again", "no_proxy=312123"}
	expected := []string{
		"something=1",
		"in=2",
		"here=3",
		"SNYK_INTEGRATION_NAME=foo",
		"SNYK_INTEGRATION_VERSION=bar",
		"HTTP_PROXY=proxy",
		"HTTPS_PROXY=proxy",
		"NODE_EXTRA_CA_CERTS=cacertlocation",
		"SNYK_SYSTEM_NO_PROXY=312123",
		"SNYK_SYSTEM_HTTP_PROXY=exists",
		"SNYK_SYSTEM_HTTPS_PROXY=already",
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY + ",312123",
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation")

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_Fail_DontOverrideExisting(t *testing.T) {

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

func getProxyInfoForTest() *proxy.ProxyInfo {
	return &proxy.ProxyInfo{
		Port:                1000,
		Password:            "foo",
		CertificateLocation: "certLocation",
	}
}

func Test_prepareV1Command(t *testing.T) {
	expectedArgs := []string{"hello", "world"}

	snykCmd, err := cliv2.PrepareV1Command(
		"someExecutable",
		expectedArgs,
		getProxyInfoForTest(),
		"name",
		"version",
	)

	assert.Contains(t, snykCmd.Env, "SNYK_INTEGRATION_NAME=name")
	assert.Contains(t, snykCmd.Env, "SNYK_INTEGRATION_VERSION=version")
	assert.Contains(t, snykCmd.Env, "HTTPS_PROXY=http://snykcli:foo@127.0.0.1:1000")
	assert.Contains(t, snykCmd.Env, "NODE_EXTRA_CA_CERTS=certLocation")
	assert.Equal(t, expectedArgs, snykCmd.Args[1:])
	assert.Nil(t, err)
}

func Test_executeRunV1(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := getCacheDir()
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)

	// run once
	assert.Nil(t, cli.Init())
	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"--help"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo1, _ := os.Stat(cli.GetBinaryLocation())

	// sleep shortly to ensure that ModTimes would be different
	time.Sleep(500 * time.Millisecond)

	// run twice
	assert.Nil(t, cli.Init())
	actualReturnCode = cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"--help"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo2, _ := os.Stat(cli.GetBinaryLocation())

	assert.Equal(t, fileInfo1.ModTime(), fileInfo2.ModTime())
}

func Test_init_extractDueToInvalidBinary(t *testing.T) {

	cacheDir := getCacheDir()
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)

	// fill binary with invalid data
	os.MkdirAll(tmpDir, 0755)
	os.WriteFile(cli.GetBinaryLocation(), []byte("Writing some strings"), 0755)
	fileInfo1, _ := os.Stat(cli.GetBinaryLocation())

	// prove that we can't execute the invalid binary
	_, binError := exec.Command(cli.GetBinaryLocation(), "--help").Output()
	assert.NotNil(t, binError)

	// sleep shortly to ensure that ModTimes would be different
	time.Sleep(500 * time.Millisecond)

	// run init to ensure that the file system is being setup correctly
	initError := cli.Init()
	assert.Nil(t, initError)

	// execute to test that the cli can run successfully
	assert.FileExists(t, cli.GetBinaryLocation())

	// prove that we now can execute the invalid binary
	_, binError = exec.Command(cli.GetBinaryLocation(), "--help").Output()
	assert.Nil(t, binError)

	fileInfo2, _ := os.Stat(cli.GetBinaryLocation())

	assert.NotEqual(t, fileInfo1.ModTime(), fileInfo2.ModTime())
}

func Test_executeRunV2only(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := getCacheDir()
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)
	assert.Nil(t, cli.Init())

	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"--version"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())

}

func Test_executeEnvironmentError(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := getCacheDir()
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	assert.NoDirExists(t, tmpDir)

	// fill Environment Variable
	os.Setenv(constants.SNYK_INTEGRATION_NAME_ENV, "someName")

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)
	assert.Nil(t, cli.Init())

	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"--help"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
}

func Test_executeUnknownCommand(t *testing.T) {
	expectedReturnCode := constants.SNYK_EXIT_CODE_ERROR

	cacheDir := getCacheDir()
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)
	assert.Nil(t, cli.Init())

	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"bogusCommand"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
}

func Test_clearCache(t *testing.T) {
	cacheDir := getCacheDir()
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)
	assert.Nil(t, cli.Init())

	// create folders and files in cache dir
	versionWithV := path.Join(cli.CacheDirectory, "v1.914.0")
	versionNoV := path.Join(cli.CacheDirectory, "1.1048.0-dev.2401acbc")
	lockfile := path.Join(cli.CacheDirectory, "v1.914.0.lock")
	randomFile := path.Join(versionNoV, "filename")
	currentVersion := cli.GetBinaryLocation()

	os.Mkdir(versionWithV, 0755)
	os.Mkdir(versionNoV, 0755)
	os.WriteFile(randomFile, []byte("Writing some strings"), 0666)
	os.WriteFile(lockfile, []byte("Writing some strings"), 0666)

	// clear cache
	err := cli.ClearCache()
	assert.Nil(t, err)

	// check if directories that need to be deleted don't exist
	assert.NoDirExists(t, versionWithV)
	assert.NoDirExists(t, versionNoV)
	assert.NoFileExists(t, randomFile)
	// check if directories that need to exist still exist
	assert.FileExists(t, currentVersion)
	assert.FileExists(t, lockfile)
}

func Test_clearCacheBigCache(t *testing.T) {
	cacheDir := getCacheDir()
	logger := log.New(ioutil.Discard, "", 0)

	// cleanup
	defer os.RemoveAll(cacheDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(cacheDir, logger)
	assert.Nil(t, cli.Init())

	// create folders and files in cache dir
	dir1 := path.Join(cli.CacheDirectory, "dir1")
	dir2 := path.Join(cli.CacheDirectory, "dir2")
	dir3 := path.Join(cli.CacheDirectory, "dir3")
	dir4 := path.Join(cli.CacheDirectory, "dir4")
	dir5 := path.Join(cli.CacheDirectory, "dir5")
	dir6 := path.Join(cli.CacheDirectory, "dir6")
	currentVersion := cli.GetBinaryLocation()

	os.Mkdir(dir1, 0755)
	os.Mkdir(dir2, 0755)
	os.Mkdir(dir3, 0755)
	os.Mkdir(dir4, 0755)
	os.Mkdir(dir5, 0755)
	os.Mkdir(dir6, 0755)

	// clear cache
	err := cli.ClearCache()
	assert.Nil(t, err)

	// check if directories that need to be deleted don't exist
	assert.NoDirExists(t, dir1)
	assert.NoDirExists(t, dir2)
	assert.NoDirExists(t, dir3)
	assert.NoDirExists(t, dir4)
	assert.NoDirExists(t, dir5)
	// check if directories that need to exist still exist
	assert.DirExists(t, dir6)
	assert.FileExists(t, currentVersion)
}
