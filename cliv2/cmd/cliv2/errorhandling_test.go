package main

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/error-catalog-golang-public/cli"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

func Test_decorateError(t *testing.T) {
	t.Run("is nil error", func(t *testing.T) {
		assert.Nil(t, decorateError(nil))
	})

	t.Run("is exit error", func(t *testing.T) {
		err := &cli_errors.ErrorWithExitCode{
			ExitCode: 2,
		}
		assert.Equal(t, err, decorateError(err))
	})

	t.Run("is already error catalog error", func(t *testing.T) {
		err := cli.NewConnectionTimeoutError("")
		assert.Equal(t, err, decorateError(err))
	})

}
