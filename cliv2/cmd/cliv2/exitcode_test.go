package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"testing"

	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

func TestMapErrorToExitCode(t *testing.T) {
	t.Run("nil error returns unset", func(t *testing.T) {
		exitCode := mapErrorToExitCode(nil)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("ErrorWithExitCode returns unset", func(t *testing.T) {
		exitCodeErr := &cli_errors.ErrorWithExitCode{ExitCode: 42}
		exitCode := mapErrorToExitCode(exitCodeErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("wrapped ErrorWithExitCode returns unset", func(t *testing.T) {
		exitCodeErr := &cli_errors.ErrorWithExitCode{ExitCode: 42}
		wrappedErr := errors.Join(exitCodeErr, errors.New("additional context"))
		exitCode := mapErrorToExitCode(wrappedErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("exec.ExitError returns unset", func(t *testing.T) {
		execErr := &exec.ExitError{ProcessState: &os.ProcessState{}}
		exitCode := mapErrorToExitCode(execErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("wrapped exec.ExitError returns unset", func(t *testing.T) {
		execErr := &exec.ExitError{ProcessState: &os.ProcessState{}}
		wrappedErr := errors.Join(execErr, errors.New("command failed"))
		exitCode := mapErrorToExitCode(wrappedErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("context.DeadlineExceeded returns EX_UNAVAILABLE", func(t *testing.T) {
		exitCode := mapErrorToExitCode(context.DeadlineExceeded)
		if exitCode != constants.SNYK_EXIT_CODE_EX_UNAVAILABLE {
			t.Errorf("expected exit code %d, got %d", constants.SNYK_EXIT_CODE_EX_UNAVAILABLE, exitCode)
		}
	})

	t.Run("wrapped context.DeadlineExceeded returns EX_UNAVAILABLE", func(t *testing.T) {
		wrappedErr := errors.Join(context.DeadlineExceeded, errors.New("timeout occurred"))
		exitCode := mapErrorToExitCode(wrappedErr)
		if exitCode != constants.SNYK_EXIT_CODE_EX_UNAVAILABLE {
			t.Errorf("expected exit code %d, got %d", constants.SNYK_EXIT_CODE_EX_UNAVAILABLE, exitCode)
		}
	})

	t.Run("wrapped unsupported project error returns UNSUPPORTED_PROJECTS", func(t *testing.T) {
		unsupportedErr := code.NewUnsupportedProjectError("test project")
		wrappedErr := errors.Join(unsupportedErr, errors.New("additional context"))
		exitCode := mapErrorToExitCode(wrappedErr)
		if exitCode != constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS {
			t.Errorf("expected exit code %d, got %d", constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS, exitCode)
		}
	})

	t.Run("other error catalog error returns unset", func(t *testing.T) {
		otherErr := snyk_errors.Error{
			ErrorCode: "OTHER_ERROR_CODE",
			Detail:    "some other error",
		}
		exitCode := mapErrorToExitCode(otherErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})

	t.Run("generic error returns unset", func(t *testing.T) {
		genericErr := errors.New("some generic error")
		exitCode := mapErrorToExitCode(genericErr)
		if exitCode != unsetExitCode {
			t.Errorf("expected exit code %d, got %d", unsetExitCode, exitCode)
		}
	})
}
