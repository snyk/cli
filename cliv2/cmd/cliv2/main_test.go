package main_test

import (
	"os"
	"testing"

	main "github.com/snyk/cli/cliv2/cmd/cliv2"

	"github.com/stretchr/testify/assert"
)

func Test_MainWithErrorCode(t *testing.T) {
	err := main.MainWithErrorCode(os.Args[1:])
	assert.Equal(t, err, 0)
}
