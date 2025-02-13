package main

import (
	"errors"
	"os"
	"os/exec"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/error-catalog-golang-public/cli"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

func Test_decorateError(t *testing.T) {
	meta := map[string]any{}
	t.Run("is nil error", func(t *testing.T) {
		assert.Nil(t, decorateError(nil, meta))
	})

	t.Run("is ErrorWithExitCode", func(t *testing.T) {
		err := &cli_errors.ErrorWithExitCode{
			ExitCode: 2,
		}
		assert.Equal(t, err, decorateError(err, meta))
	})

	t.Run("is ExitError", func(t *testing.T) {
		err := &exec.ExitError{
			ProcessState: &os.ProcessState{},
		}
		assert.Equal(t, err, decorateError(err, meta))
	})

	t.Run("is already error catalog error", func(t *testing.T) {
		err := cli.NewConnectionTimeoutError("")
		actualErr := decorateError(err, meta)
		assert.ErrorAs(t, actualErr, &err)
	})

	t.Run("is a generic error", func(t *testing.T) {
		err := errors.New("generic error")
		actualErr := decorateError(err, meta)
		expectedError := cli.NewGeneralCLIFailureError("")
		assert.ErrorIs(t, actualErr, err)
		assert.ErrorAs(t, actualErr, &expectedError)
	})
}
