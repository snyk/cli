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
	t.Run("is nil error", func(t *testing.T) {
		assert.Nil(t, decorateError(nil))
	})

	t.Run("preserves nested ExitError", func(t *testing.T) {
		err1 := cli.NewConnectionTimeoutError("")
		err2 := &exec.ExitError{
			ProcessState: &os.ProcessState{},
		}
		actualErr := decorateError(errors.Join(err1, err2))
		// Assert that err2 is present in actualErr
		if !errors.Is(actualErr, err2) {
			t.Errorf("Expected actualErr to contain err2, but it did not")
		}
	})

	t.Run("is ErrorWithExitCode", func(t *testing.T) {
		err := &cli_errors.ErrorWithExitCode{
			ExitCode: 2,
		}
		assert.Equal(t, err, decorateError(err))
	})

	t.Run("is ExitError", func(t *testing.T) {
		err := &exec.ExitError{
			ProcessState: &os.ProcessState{},
		}
		assert.Equal(t, err, decorateError(err))
	})

	t.Run("is already error catalog error", func(t *testing.T) {
		err := cli.NewConnectionTimeoutError("")
		actualErr := decorateError(err)
		assert.Equal(t, err, actualErr)
	})

	t.Run("is a generic error", func(t *testing.T) {
		err := errors.New("generic error")
		actualErr := decorateError(err)
		expectedError := cli.NewGeneralCLIFailureError("")
		assert.ErrorIs(t, actualErr, err)
		assert.ErrorAs(t, actualErr, &expectedError)
	})
}
