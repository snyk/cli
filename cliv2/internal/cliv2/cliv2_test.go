package cliv2_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/utils"

	"github.com/snyk/cli/cliv2/internal/embedded/cliv1"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"

	"github.com/stretchr/testify/assert"
)

var discardLogger = log.New(io.Discard, "", 0)

func getCacheDir(t *testing.T) string {
	t.Helper()
	cacheDir := path.Join(t.TempDir(), "snyk")
	err := os.MkdirAll(cacheDir, 0755)
	assert.Nil(t, err)
	return cacheDir
}

func getRuntimeInfo(t *testing.T) runtimeinfo.RuntimeInfo {
	t.Helper()
	return runtimeinfo.New(runtimeinfo.WithVersion(cliv1.CLIV1Version()))
}

func Test_PrepareV1EnvironmentVariables_Fill_and_Filter(t *testing.T) {
	orgid := "orgid"
	testapi := "https://api.snyky.io"

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.ORGANIZATION, orgid)
	config.Set(configuration.API_URL, testapi)
	config.Set(configuration.PREVIEW_FEATURES_ENABLED, true)

	expectedTmpPath := "foo/bar"
	config.Set(configuration.TEMP_DIR_PATH, expectedTmpPath)

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
		"SNYK_ERR_FILE=",
		"SNYK_SYSTEM_HTTP_PROXY=httpProxy",
		"SNYK_SYSTEM_HTTPS_PROXY=httpsProxy",
		"SNYK_INTERNAL_ORGID=" + orgid,
		"SNYK_CFG_ORG=" + orgid,
		"SNYK_INTERNAL_PREVIEW_FEATURES=1",
		"SNYK_API=" + testapi,
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY + ",noProxy",
		"SNYK_TMP_PATH=" + expectedTmpPath,
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_DontOverrideExistingIntegration(t *testing.T) {
	orgid := "orgid"
	testapi := "https://api.snyky.io"

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.ORGANIZATION, orgid)
	config.Set(configuration.API_URL, testapi)

	expectedTmpPath := "foo/bar"
	config.Set(configuration.TEMP_DIR_PATH, expectedTmpPath)

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
		"SNYK_ERR_FILE=",
		"SNYK_INTERNAL_ORGID=" + orgid,
		"SNYK_CFG_ORG=" + orgid,
		"SNYK_API=" + testapi,
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY,
		"SNYK_TMP_PATH=" + expectedTmpPath,
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_OverrideProxyAndCerts(t *testing.T) {
	orgid := "orgid"
	testapi := "https://api.snyky.io"

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.ORGANIZATION, orgid)
	config.Set(configuration.API_URL, testapi)

	expectedTmpPath := "foo/bar"
	config.Set(configuration.TEMP_DIR_PATH, expectedTmpPath)

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
		"SNYK_ERR_FILE=",
		"SNYK_SYSTEM_HTTPS_PROXY=already",
		"SNYK_INTERNAL_ORGID=" + orgid,
		"SNYK_CFG_ORG=" + orgid,
		"SNYK_API=" + testapi,
		"NO_PROXY=" + constants.SNYK_INTERNAL_NO_PROXY + ",312123",
		"SNYK_TMP_PATH=" + expectedTmpPath,
	}

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)
	assert.Nil(t, err)
}

func Test_PrepareV1EnvironmentVariables_OnlyExplicitlySetValues(t *testing.T) {
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())

	t.Run("Values not set", func(t *testing.T) {
		input := []string{}
		notExpected := []string{"SNYK_API=", "SNYK_CFG_ORG="}

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

		assert.NotContains(t, actual, notExpected)
		assert.Nil(t, err)
	})

	t.Run("Values explicitly set api", func(t *testing.T) {
		input := []string{}
		expected := []string{"SNYK_API=https://api.snyky.io"}

		config.Set(configuration.API_URL, "https://api.snyky.io")

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

		assert.NotContains(t, actual, expected)
		assert.Nil(t, err)
	})

	t.Run("Values explicitly set org", func(t *testing.T) {
		input := []string{}
		expected := []string{"SNYK_CFG_ORG=my-org"}

		config.Set(configuration.ORGANIZATION, "my-org")

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "proxy", "cacertlocation", config, []string{})

		assert.NotContains(t, actual, expected)
		assert.Nil(t, err)
	})
}

func Test_PrepareV1EnvironmentVariables_Fail_DontOverrideExisting(t *testing.T) {
	orgid := "orgid"
	testapi := "https://api.snyky.io"

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.ORGANIZATION, orgid)
	config.Set(configuration.API_URL, testapi)

	input := []string{"something=1", "in=2", "here=3", "SNYK_INTEGRATION_NAME=exists"}
	expected := input

	actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "unused", "unused", config, []string{})

	sort.Strings(expected)
	sort.Strings(actual)
	assert.Equal(t, expected, actual)

	warn, ok := err.(cliv2.EnvironmentWarning)
	assert.True(t, ok)
	assert.NotNil(t, warn)
}

func Test_PrepareV1EnvironmentVariables_Fail_DontOverrideExisting_Org(t *testing.T) {
	orgid := "orgid"
	testapi := "https://api.snyky.io"

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.ORGANIZATION, orgid)
	config.Set(configuration.API_URL, testapi)

	notExpected := "SNYK_CFG_ORG=" + orgid

	t.Run("config value is used", func(t *testing.T) {
		input := []string{}
		args := []string{"-d"}

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "unused", "unused", config, args)
		assert.Nil(t, err)

		assert.Contains(t, actual, notExpected)
	})

	t.Run("cmd arg is given, config value not used", func(t *testing.T) {
		input := []string{}
		args := []string{"-d", "--org=something"}

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "unused", "unused", config, args)
		assert.Nil(t, err)

		assert.NotContains(t, actual, notExpected)
	})

	t.Run("env var is given, config value not used", func(t *testing.T) {
		expectedOrgEnvVar := "SNYK_CFG_ORG=myorg"
		input := []string{"something=hello", expectedOrgEnvVar}
		args := []string{"-d"}

		actual, err := cliv2.PrepareV1EnvironmentVariables(input, "foo", "bar", "unused", "unused", config, args)
		assert.Nil(t, err)

		assert.NotContains(t, actual, notExpected)
		assert.Contains(t, actual, expectedOrgEnvVar)
	})
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
	cacheDir := getCacheDir(t)
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.CACHE_PATH, cacheDir)
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)

	snykCmd, err := cli.PrepareV1Command(
		context.Background(),
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

func Test_extractOnlyOnce(t *testing.T) {
	cacheDir := getCacheDir(t)
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.CACHE_PATH, cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)
	assert.NoError(t, cli.Init())

	// run once
	err = cli.Execute(getProxyInfoForTest(), []string{"--help"})
	assert.Error(t, err) // invalid binary expected here
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo1, err := os.Stat(cli.GetBinaryLocation())
	assert.NoError(t, err)

	// sleep shortly to ensure that ModTimes would be different
	time.Sleep(500 * time.Millisecond)

	// run twice
	assert.Nil(t, cli.Init())
	err = cli.Execute(getProxyInfoForTest(), []string{"--help"})
	assert.Error(t, err) // invalid binary expected here
	assert.FileExists(t, cli.GetBinaryLocation())
	fileInfo2, err := os.Stat(cli.GetBinaryLocation())
	assert.NoError(t, err)

	assert.Equal(t, fileInfo1.ModTime(), fileInfo2.ModTime())
}

func Test_init_extractDueToInvalidBinary(t *testing.T) {
	cacheDir := getCacheDir(t)
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.CACHE_PATH, cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)

	// fill binary with invalid data
	_ = os.MkdirAll(tmpDir, 0755)
	_ = os.WriteFile(cli.GetBinaryLocation(), []byte("Writing some strings"), 0755)
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

	fileInfo2, _ := os.Stat(cli.GetBinaryLocation())

	assert.NotEqual(t, fileInfo1.ModTime(), fileInfo2.ModTime())
}

func Test_executeRunV2only(t *testing.T) {
	expectedReturnCode := 0

	cacheDir := getCacheDir(t)
	tmpDir := utils.GetTemporaryDirectory(cacheDir, cliv2.GetFullVersion())
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.CACHE_PATH, cacheDir)

	assert.NoDirExists(t, tmpDir)

	// create instance under test
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)
	assert.NoError(t, cli.Init())

	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"--version"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
	assert.FileExists(t, cli.GetBinaryLocation())
}

func Test_executeUnknownCommand(t *testing.T) {
	expectedReturnCode := constants.SNYK_EXIT_CODE_ERROR

	cacheDir := getCacheDir(t)
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.CACHE_PATH, cacheDir)

	// create instance under test
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)
	assert.NoError(t, cli.Init())

	actualReturnCode := cliv2.DeriveExitCode(cli.Execute(getProxyInfoForTest(), []string{"bogusCommand"}))
	assert.Equal(t, expectedReturnCode, actualReturnCode)
}

func Test_clearCache(t *testing.T) {
	cacheDir := getCacheDir(t)
	engine := app.CreateAppEngine()
	config := engine.GetConfiguration()
	config.Set(configuration.CACHE_PATH, cacheDir)

	// create instance under test
	cli, _ := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.Nil(t, cli.Init())

	// create folders and files in cache dir
	versionWithV := path.Join(cli.CacheDirectory, "v1.914.0")
	versionNoV := path.Join(cli.CacheDirectory, "1.1048.0-dev.2401acbc")
	lockfile := path.Join(cli.CacheDirectory, "v1.914.0.lock")
	randomFile := path.Join(versionNoV, "filename")
	currentVersion := cli.GetBinaryLocation()

	assert.NoError(t, os.Mkdir(versionWithV, 0755))
	assert.NoError(t, os.Mkdir(versionNoV, 0755))
	assert.NoError(t, os.WriteFile(randomFile, []byte("Writing some strings"), 0666))
	assert.NoError(t, os.WriteFile(lockfile, []byte("Writing some strings"), 0666))

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
	assert.DirExists(t, cli.GetTempDir())
}

func Test_clearCacheBigCache(t *testing.T) {
	cacheDir := getCacheDir(t)
	engine := app.CreateAppEngine()
	config := engine.GetConfiguration()
	config.Set(configuration.CACHE_PATH, cacheDir)

	// create instance under test
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)
	assert.NoError(t, cli.Init())

	// create folders and files in cache dir
	dir1 := path.Join(cli.CacheDirectory, "dir1")
	dir2 := path.Join(cli.CacheDirectory, "dir2")
	dir3 := path.Join(cli.CacheDirectory, "dir3")
	dir4 := path.Join(cli.CacheDirectory, "dir4")
	dir5 := path.Join(cli.CacheDirectory, "dir5")
	dir6 := path.Join(cli.CacheDirectory, "dir6")
	currentVersion := cli.GetBinaryLocation()

	_ = os.Mkdir(dir1, 0755)
	_ = os.Mkdir(dir2, 0755)
	_ = os.Mkdir(dir3, 0755)
	_ = os.Mkdir(dir4, 0755)
	_ = os.Mkdir(dir5, 0755)
	_ = os.Mkdir(dir6, 0755)

	// clear cache
	err = cli.ClearCache()
	assert.NoError(t, err)

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

func Test_setTimeout(t *testing.T) {
	if //goland:noinspection ALL
	runtime.GOOS == "windows" {
		t.Skip("Skipping test on windows")
	}
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	cli, err := cliv2.NewCLIv2(config, discardLogger, getRuntimeInfo(t))
	assert.NoError(t, err)
	config.Set(configuration.TIMEOUT, 1)

	// sleep for 2s
	cli.SetV1BinaryLocation("/bin/sleep")
	err = cli.Execute(getProxyInfoForTest(), []string{"2"})

	assert.ErrorIs(t, err, context.DeadlineExceeded)

	// ensure that -1 is correctly mapped if timeout is set
	assert.Equal(t, constants.SNYK_EXIT_CODE_EX_UNAVAILABLE, cliv2.DeriveExitCode(err))
}

func TestDeriveExitCode(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected int
	}{
		{name: "no error", err: nil, expected: constants.SNYK_EXIT_CODE_OK},
		{name: "error with exit code", err: &cli_errors.ErrorWithExitCode{ExitCode: 42}, expected: 42},
		{name: "context.DeadlineExceeded", err: context.DeadlineExceeded, expected: constants.SNYK_EXIT_CODE_EX_UNAVAILABLE},
		{name: "other error", err: errors.New("some other error"), expected: constants.SNYK_EXIT_CODE_ERROR},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			exitCode := cliv2.DeriveExitCode(tc.err)
			assert.Equal(t, tc.expected, exitCode)
		})
	}
}

func Test_determineInputDirectory(t *testing.T) {
	t.Run("input directory given as positional argument", func(t *testing.T) {
		expected := "./myfolder/somewhere/"
		actual := cliv2.DetermineInputDirectory([]string{"iac", "test", "--remote-repo-url=something ", expected, " -d", "--project-tags=t1,t2", "--", "-DVerbose", "true", "/somefolder/here.file"})
		assert.Equal(t, expected, actual)
	})

	t.Run("no input directory specified in arguments", func(t *testing.T) {
		expected := ""
		actual := cliv2.DetermineInputDirectory([]string{"iac", "test", "--remote-repo-url=something", "-d", "--project-tags=t1,t2", "--", "-DVerbose", "true", "/somefolder/here.file"})
		assert.Equal(t, expected, actual)
	})
}

func Test_GetErrorDisplayStatus(t *testing.T) {
	// Decision table:
	//  stdin |  json  | hasBeenDisplayed
	// ---------------------------------
	//  true  |  true  |    true
	//  true  |  false |    false
	//  false |    *   |    false

	tests := []struct {
		stdin    bool
		json     bool
		expected bool
	}{
		{
			stdin:    true,
			json:     true,
			expected: true,
		},
		{
			stdin:    true,
			json:     false,
			expected: false,
		},
		{
			stdin:    false,
			json:     true,
			expected: false,
		},
		{
			stdin:    false,
			json:     false,
			expected: false,
		},
	}

	for _, tc := range tests {
		testName := fmt.Sprintf("%t + %t = %t", tc.stdin, tc.json, tc.expected)
		t.Run(testName, func(t *testing.T) {
			config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
			config.Set(configuration.WORKFLOW_USE_STDIO, tc.stdin)
			config.Set(output_workflow.OUTPUT_CONFIG_KEY_JSON, tc.json)

			hasBeenDisplayed := cliv2.GetErrorDisplayStatus(config)
			assert.Equal(t, hasBeenDisplayed, tc.expected)
		})
	}
}

func Test_GetErrorFromFile(t *testing.T) {
	// returns an ExitError instances with the specified exit code
	getExitError := func(exitCode int) error {
		var err error
		command := fmt.Sprintf("exit %d", exitCode)
		if runtime.GOOS == "windows" {
			cmd := exec.Command("cmd", "/C", command)
			err = cmd.Run()
		} else {
			cmd := exec.Command("sh", "-c", command)
			err = cmd.Run()
		}

		return err
	}

	// Setup
	jsonAPIErrorBytes := []byte(`{"jsonapi":{"version":"1.0"},"errors":[{"id":"1","links":{"about":"https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-os-7001"},"status":"504","code":"SNYK-OS-7001","title":"Request to Snyk API timeout","detail":"connection is timedout","meta":{"links":["https://status.snyk.io/"],"isErrorCatalogError":true,"classification":"UNEXPECTED"}}]}`)
	validFilePath := path.Join(t.TempDir(), "ipc-err-file")
	err := os.WriteFile(validFilePath, jsonAPIErrorBytes, 0664)
	assert.Nil(t, err)

	noErrorBytes := []byte(`{"jsonapi":{"version":"1.0"},"errors":[]}`)
	noErrorsFilePath := path.Join(t.TempDir(), "no-err-file")
	err = os.WriteFile(noErrorsFilePath, noErrorBytes, 0664)
	assert.Nil(t, err)

	notJsonBytes := []byte(`this is not a valid json`)
	invalidFilePath := path.Join(t.TempDir(), "invalid-err-file")
	err = os.WriteFile(invalidFilePath, notJsonBytes, 0664)
	assert.Nil(t, err)

	notFoundFilePath := path.Join(t.TempDir(), "not-found-file")

	jsonApiError, err := snyk_errors.FromJSONAPIErrorBytes(jsonAPIErrorBytes)
	assert.Nil(t, err)
	jsonAPIError := jsonApiError[0]

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())

	t.Run("does not retrieve errors for exit code 0", func(t *testing.T) {
		exitCodeErr := getExitError(0)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, validFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCNotNeeded)
	})

	t.Run("does not retrieve errors for exit code 1", func(t *testing.T) {
		exitCodeErr := getExitError(1)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, validFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCNotNeeded)
	})

	t.Run("does not retrieve errors if the IPC was not used", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, notFoundFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCNoDataSent)
	})

	t.Run("does not retrieve errors if the file cannot be read", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, t.TempDir(), config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCFailedToRead)
	})

	t.Run("does not retrieve errors if the IPC data cannot be deserialized", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, invalidFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCFailedToDeserialize)
	})

	t.Run("does not retrieve errors if the IPC data cannot be deserialized", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, invalidFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCFailedToDeserialize)
	})

	t.Run("does not retrieve errors if the IPC didnt send any errors", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, noErrorsFilePath, config)

		assert.Nil(t, sentErr)
		assert.ErrorIs(t, err, cliv2.ErrIPCNoDataSent)
	})

	t.Run("retrieves errors for exit code 2", func(t *testing.T) {
		exitCodeErr := getExitError(2)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, validFilePath, config)

		snykErr := snyk_errors.Error{}
		assert.ErrorIs(t, sentErr, exitCodeErr)
		assert.ErrorAs(t, sentErr, &snykErr)
		assert.Equal(t, snykErr.ErrorCode, jsonAPIError.ErrorCode)
		assert.Nil(t, err)
	})

	t.Run("retrieves errors for exit code 44", func(t *testing.T) {
		exitCodeErr := getExitError(44)
		sentErr, err := cliv2.GetErrorFromFile(exitCodeErr, validFilePath, config)

		snykErr := snyk_errors.Error{}
		assert.ErrorIs(t, sentErr, exitCodeErr)
		assert.ErrorAs(t, sentErr, &snykErr)
		assert.Equal(t, snykErr.ErrorCode, jsonAPIError.ErrorCode)
		assert.Nil(t, err)
	})
}
