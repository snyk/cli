package main_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	main "github.com/snyk/cli/cliv2/cmd/cliv2"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/httpauth"

	"github.com/stretchr/testify/assert"
)

func Test_MainWithErrorCode(t *testing.T) {
	cacheDirectory := ""

	variables := &cliv2.CliConfiguration{
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 0)
}

func Test_MainWithErrorCode_no_cache(t *testing.T) {
	cacheDirectory, err := filepath.Abs("./MADE_UP_NAME")
	t.Log(cacheDirectory)
	assert.Nil(t, err)

	variables := &cliv2.CliConfiguration{
		CacheDirectory: cacheDirectory,
	}

	cmd := "version --debug"
	args := strings.Split(cmd, " ")
	mainErr := main.MainWithErrorCode(variables, args)

	assert.Equal(t, mainErr, 0)
	assert.DirExists(t, cacheDirectory)
	os.RemoveAll(cacheDirectory)
}

func Test_GetConfiguration_debugEnabled1(t *testing.T) {
	cmd := "_bin/snyk_darwin_arm64 --debug"
	args := strings.Split(cmd, " ")

	expectedConfig := &cliv2.CliConfiguration{
		Insecure:                     false,
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
		ProxyAddr:                    "",
		Debug:                        true,
	}

	actualConfig := main.GetConfiguration(args)

	assert.Equal(t, expectedConfig, actualConfig)
}

func Test_GetConfiguration_debugEnabled2(t *testing.T) {
	cmd := "_bin/snyk_darwin_arm64 -d"
	args := strings.Split(cmd, " ")

	expectedConfig := &cliv2.CliConfiguration{
		Insecure:                     false,
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
		ProxyAddr:                    "",
		Debug:                        true,
	}

	actualConfig := main.GetConfiguration(args)

	assert.Equal(t, expectedConfig, actualConfig)
}
