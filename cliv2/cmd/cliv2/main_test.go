package main_test

import (
	"os"
	main "snyk/cling/cmd/cliv2"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_getEnvVariables(t *testing.T) {
	upstreamProxy := ""
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 0)
}

func Test_getEnvVariables_no_proxy (t *testing.T) {
	upstreamProxy := "MADE_UP_NAME"
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 2)
}

func Test_getEnvVariables_no_cache(t *testing.T) {
	upstreamProxy := ""
	cacheDirectory := "MADE_UP_NAME"

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		CacheDirectory: cacheDirectory,
	}

	mainErr := main.MainWithErrorCode(variables, os.Args[1:])
	
	assert.Equal(t, mainErr, 0)
	assert.DirExists(t, cacheDirectory)
}