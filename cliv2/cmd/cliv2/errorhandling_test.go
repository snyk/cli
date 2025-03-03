package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/cliv2"
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

func Test_iterErrorChain(t *testing.T) {
	t.Run("wrapping errors.Join", func(t *testing.T) {
		err1 := errors.New("first error")
		err2 := fmt.Errorf("second error")
		joined := errors.Join(err1, err2)

		errors := []error{}
		for err := range iterErrorChain(joined) {
			errors = append(errors, err)
		}

		assert.Contains(t, errors, joined)
		assert.Contains(t, errors, err1)
		assert.Contains(t, errors, err2)
	})

	t.Run("wrapping using fmt.Errorf", func(t *testing.T) {
		err1 := errors.New("first error")
		err2 := fmt.Errorf("second error")
		wrapped := fmt.Errorf("wrapped: %w %w", err1, err2)

		errors := []error{}
		for err := range iterErrorChain(wrapped) {
			errors = append(errors, err)
		}

		assert.Contains(t, errors, wrapped)
		assert.Contains(t, errors, err1)
		assert.Contains(t, errors, err2)
	})

	t.Run("combined wrapping", func(t *testing.T) {
		err1 := errors.New("first error")
		err2 := fmt.Errorf("second error")
		joined := errors.Join(err1, err2)

		cause := errors.New("cause")
		snykErr := snyk_errors.Error{
			Title: "error struct",
			Cause: cause,
		}

		wrapped := fmt.Errorf("wrapped: %w %w", snykErr, joined)

		errors := []error{}
		for err := range iterErrorChain(wrapped) {
			errors = append(errors, err)
		}

		assert.Contains(t, errors, wrapped)
		assert.Contains(t, errors, snykErr)
		assert.Contains(t, errors, cause)
		assert.Contains(t, errors, joined)
		assert.Contains(t, errors, err2)
		assert.Contains(t, errors, err1)
	})
}

func Test_errorHasBeenShown(t *testing.T) {
	t.Run("has been displayed", func(t *testing.T) {
		err := snyk_errors.Error{
			Meta: map[string]any{
				cliv2.ERROR_HAS_BEEN_DISPLAYED: true,
			},
		}

		hasBeenShown := errorHasBeenShown(err)
		assert.Equal(t, hasBeenShown, true)
	})

	t.Run("unset value", func(t *testing.T) {
		err := snyk_errors.Error{
			Meta: map[string]any{},
		}

		hasBeenShown := errorHasBeenShown(err)
		assert.Equal(t, hasBeenShown, false)
	})

	t.Run("multiple errors in chain", func(t *testing.T) {
		first := snyk_errors.Error{
			Meta: map[string]any{
				cliv2.ERROR_HAS_BEEN_DISPLAYED: false,
			},
		}
		second := snyk_errors.Error{
			Meta: map[string]any{},
		}
		third := snyk_errors.Error{
			Meta: map[string]any{
				cliv2.ERROR_HAS_BEEN_DISPLAYED: true,
			},
		}
		chain := fmt.Errorf("exit error: %w", errors.Join(first, second, third))

		hasBeenShown := errorHasBeenShown(chain)
		assert.Equal(t, hasBeenShown, true)
	})
}
