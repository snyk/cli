package cli_errors

import (
	"errors"
	"fmt"
	"os/exec"

	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/constants"
)

type ErrorWithExitCode struct {
	ExitCode int
}

func (e ErrorWithExitCode) Error() string {
	return fmt.Sprintf("exit code: %d", e.ExitCode)
}

// IsFailure reports whether err represents an actual failure that needs error
// processing, as opposed to a command result that merely carries a known
// non-failure exit code (vulnerabilities found or unsupported projects).
func IsFailure(err error) bool {
	if err == nil {
		return false
	}
	if exitErr, ok := err.(*exec.ExitError); ok {
		return !isNonFailureExitCode(exitErr.ExitCode())
	}
	if exitCodeErr, ok := err.(*ErrorWithExitCode); ok {
		return !isNonFailureExitCode(exitCodeErr.ExitCode)
	}
	return true
}

func isNonFailureExitCode(code int) bool {
	switch code {
	case constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND,
		constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS:
		return true
	default:
		return false
	}
}

// FindMostRelevantError determines the most relevant error from a list of errors, inspecting the full error chain. The returned error can be used for display and exit code mapping.
func FindMostRelevantError(errorList []error) error {
	if len(errorList) == 0 {
		return nil
	}

	// 1. find known high priority errors
	maxRecursionDepth := 1000
	knownHighPriorityErrors := []string{snyk.NewMaintenanceWindowError("").ErrorCode}
	for _, err := range errorList {
		if err == nil {
			continue
		}

		for _, knownHighPriorityErrorCode := range knownHighPriorityErrors {
			if snykErr := findSnykErrorByCode(err, knownHighPriorityErrorCode, maxRecursionDepth); snykErr != nil {
				return *snykErr
			}
		}
	}

	// 2. TODO: implement a prioritization logic to determine the most relevant error, this could be based on status code, error level, classification, etc.

	// fallback: create a single error from all errors
	if len(errorList) == 1 {
		return errorList[0]
	} else if len(errorList) > 1 {
		return errors.Join(errorList...)
	}

	return nil
}

// findSnykErrorByCode recursively searches for a snyk error with the given error code.
func findSnykErrorByCode(err error, errorCode string, recursionDepth int) *snyk_errors.Error {
	if err == nil || recursionDepth <= 0 {
		return nil
	}

	// reduce depth to avoid infinite recursion
	recursionDepth--

	// Check if this error wraps multiple errors (e.g., from errors.Join)
	if unwrapped, ok := err.(interface{ Unwrap() []error }); ok {
		for _, inner := range unwrapped.Unwrap() {
			if found := findSnykErrorByCode(inner, errorCode, recursionDepth); found != nil {
				return found
			}
		}
		return nil
	}

	// Recurse into single-wrapped errors (e.g., fmt.Errorf("%w", ...) or snyk_errors.Error with Cause)
	if unwrapped, ok := err.(interface{ Unwrap() error }); ok {
		if found := findSnykErrorByCode(unwrapped.Unwrap(), errorCode, recursionDepth); found != nil {
			return found
		}
	}

	// Check if this error itself is the target snyk error
	if snykErr, ok := err.(snyk_errors.Error); ok && snykErr.ErrorCode == errorCode {
		return &snykErr
	}

	return nil
}
