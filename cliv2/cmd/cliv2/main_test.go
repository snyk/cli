package main_test

import (
	"os"
	"testing"

	main "github.com/snyk/cli/cliv2/cmd/cliv2"

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
