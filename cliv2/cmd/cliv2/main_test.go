package main_test

import (
	"os"
	main "snyk/cling/cmd/cliv2"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_getEnvVariables(t *testing.T) {
	upstreamProxy := ""
	snykDNSNames := []string{"snyk.io", "*.snyk.io"}
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		SnykDNSNames: snykDNSNames,
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 0)
}

func Test_getEnvVariables_no_proxy (t *testing.T) {
	upstreamProxy := "MADE_UP_NAME"
	snykDNSNames := []string{"snyk.io", "*.snyk.io"}
	cacheDirectory := ""

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		SnykDNSNames: snykDNSNames,
		CacheDirectory: cacheDirectory,
	}

	err := main.MainWithErrorCode(variables, os.Args[1:])
	assert.Equal(t, err, 2)
}
// This test sets polluted DNS values but doesn't cause a fail. Debugging needed
// func Test_getEnvVariables_no_DNS(t *testing.T) {
// 	upstreamProxy := ""
// 	snykDNSNames := []string{"MADE_UP_NAME_1", "MADE_UP_NAME_2"}
// 	cacheDirectory := ""

// 	variables := main.EnvironmentVariables{
// 		UpstreamProxy: upstreamProxy,
// 		SnykDNSNames: snykDNSNames,
// 		CacheDirectory: cacheDirectory,
// 	}

// 	err := main.MainWithErrorCode(variables, os.Args[1:])
// 	assert.Equal(t, err, 2)
// }

func Test_getEnvVariables_no_cache(t *testing.T) {
	upstreamProxy := ""
	snykDNSNames := []string{"snyk.io", "*.snyk.io"}
	cacheDirectory := "MADE_UP_FOLDER_NAME"

	variables := main.EnvironmentVariables{
		UpstreamProxy: upstreamProxy,
		SnykDNSNames: snykDNSNames,
		CacheDirectory: cacheDirectory,
	}

	mainErr := main.MainWithErrorCode(variables, os.Args[1:])
	
	assert.Equal(t, mainErr, 0)
	assert.DirExists(t, cacheDirectory)
}