package main_test

import (
	"os"
	"strings"
	"testing"

	main "github.com/snyk/cli/cliv2/cmd/cliv2"
	"github.com/snyk/cli/cliv2/internal/httpauth"

	"github.com/stretchr/testify/assert"
)

func Test_MainWithErrorCode(t *testing.T) {
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 0)
}

func Test_MainWithErrorCode_no_cache(t *testing.T) {
	cacheDirectory := "MADE_UP_NAME"

	variables := main.EnvironmentVariables{
		CacheDirectory: cacheDirectory,
	}

	mainErr := main.MainWithErrorCode(variables, os.Args[1:])

	assert.Equal(t, mainErr, 0)
	assert.DirExists(t, cacheDirectory)
}

func Test_GetConfiguration(t *testing.T) {
	cmd := "_bin/snyk_darwin_arm64 --debug --proxy-negotiate --proxy=http://host.example.com:3128 --insecure test"
	args := strings.Split(cmd, " ")

	expectedConfig := main.EnvironmentVariables{
		Insecure:                     true,
		ProxyAuthenticationMechanism: httpauth.Negotiate,
		ProxyAddr:                    "http://host.example.com:3128",
	}
	expectedArgs := []string{"_bin/snyk_darwin_arm64", "--debug", "--insecure", "test"}

	actualConfig, actualArgs := main.GetConfiguration(args)

	assert.Equal(t, expectedArgs, actualArgs)
	assert.Equal(t, expectedConfig, actualConfig)
}
