package cli_errors

import (
	"errors"
	"fmt"
	"testing"

	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/stretchr/testify/assert"
)

func TestFindMostRelevantError_Empty(t *testing.T) {
	result := FindMostRelevantError([]error{})
	assert.Nil(t, result)
}

func TestFindMostRelevantError_NoMaintenanceError(t *testing.T) {
	err := snyk_errors.Error{Title: "Other Error", ErrorCode: "SNYK-0001", Level: "error", StatusCode: 500}
	result := FindMostRelevantError([]error{err})

	assert.Equal(t, result, err)
}

func TestFindMostRelevantError_FindsMaintenanceError(t *testing.T) {
	err := snyk.NewMaintenanceWindowError("")
	result := FindMostRelevantError([]error{err})

	assert.NotNil(t, result)

	actualErrorCatalog := snyk_errors.Error{}
	assert.ErrorAs(t, result, &actualErrorCatalog)
	assert.Equal(t, snyk.NewMaintenanceWindowError("").ErrorCode, actualErrorCatalog.ErrorCode)
}

func TestFindMostRelevantError_FindsMaintenanceErrorAmongOthers(t *testing.T) {
	errs := []error{
		snyk_errors.Error{Title: "Other Error 1", ErrorCode: "SNYK-0001", Level: "error", StatusCode: 500},
		snyk.NewMaintenanceWindowError(""),
		snyk_errors.Error{Title: "Other Error 2", ErrorCode: "SNYK-0002", Level: "warn", StatusCode: 400},
	}

	result := FindMostRelevantError(errs)

	assert.NotNil(t, result)
	actualErrorCatalog := snyk_errors.Error{}
	assert.ErrorAs(t, result, &actualErrorCatalog)
	assert.Equal(t, snyk.NewMaintenanceWindowError("").ErrorCode, actualErrorCatalog.ErrorCode)
}

func TestFindMostRelevantError_FindsMaintenanceErrorInJoinedErrors(t *testing.T) {
	innerError := fmt.Errorf("wrapped: %w", snyk.NewMaintenanceWindowError(""))
	joinedErr := errors.Join(
		snyk_errors.Error{Title: "Inner Error", ErrorCode: "SNYK-0001", Level: "error", StatusCode: 500, Cause: innerError},
	)

	errs := []error{joinedErr}
	result := FindMostRelevantError(errs)

	actualErrorCatalog := snyk_errors.Error{}
	assert.ErrorAs(t, result, &actualErrorCatalog)
	assert.Equal(t, snyk.NewMaintenanceWindowError("").ErrorCode, actualErrorCatalog.ErrorCode)
}

func TestFindMostRelevantError_FindsMaintenanceErrorInNestedJoinedErrors(t *testing.T) {
	innerJoin := errors.Join(
		snyk_errors.Error{Title: "Inner Error", ErrorCode: "SNYK-0001", Level: "error", StatusCode: 500},
		snyk.NewMaintenanceWindowError(""),
	)
	outerJoin := errors.Join(
		snyk_errors.Error{Title: "Outer Error", ErrorCode: "SNYK-0002", Level: "warn", StatusCode: 400},
		innerJoin,
	)

	errs := []error{outerJoin}
	result := FindMostRelevantError(errs)

	assert.NotNil(t, result)
	actualErrorCatalog := snyk_errors.Error{}
	assert.ErrorAs(t, result, &actualErrorCatalog)
	assert.Equal(t, snyk.NewMaintenanceWindowError("").ErrorCode, actualErrorCatalog.ErrorCode)
}

func TestFindMostRelevantError_HandlesNilErrors(t *testing.T) {
	errs := []error{
		nil,
		snyk.NewMaintenanceWindowError(""),
		nil,
	}

	result := FindMostRelevantError(errs)

	assert.NotNil(t, result)
	actualErrorCatalog := snyk_errors.Error{}
	assert.ErrorAs(t, result, &actualErrorCatalog)
	assert.Equal(t, snyk.NewMaintenanceWindowError("").ErrorCode, actualErrorCatalog.ErrorCode)
}

func TestFindMostRelevantError_AllNilErrors(t *testing.T) {
	errs := []error{nil, nil, nil}
	result := FindMostRelevantError(errs)
	assert.Nil(t, result)
}

func TestFindMostRelevantError_OnlyPlainErrors(t *testing.T) {
	errs := []error{
		fmt.Errorf("plain error 1"),
		fmt.Errorf("plain error 2"),
	}

	result := FindMostRelevantError(errs)
	assert.Equal(t, errors.Join(errs...), result)
}

func TestFindMostRelevantError_PreservesErrorWithExitCode(t *testing.T) {
	exitCodeErr := &ErrorWithExitCode{ExitCode: 1}
	errs := []error{exitCodeErr}

	result := FindMostRelevantError(errs)

	// Should preserve the ErrorWithExitCode
	var resultExitCode *ErrorWithExitCode
	assert.True(t, errors.As(result, &resultExitCode))
	assert.Equal(t, 1, resultExitCode.ExitCode)
}

func TestFindMostRelevantError_PreservesErrorWithExitCodeAmongOthers(t *testing.T) {
	exitCodeErr := &ErrorWithExitCode{ExitCode: 1}
	otherErr := fmt.Errorf("some other error")
	errs := []error{otherErr, exitCodeErr}

	result := FindMostRelevantError(errs)

	// Should preserve the ErrorWithExitCode in the joined error
	var resultExitCode *ErrorWithExitCode
	assert.True(t, errors.As(result, &resultExitCode))
	assert.Equal(t, 1, resultExitCode.ExitCode)
}

func TestMaxRecursionDepth(t *testing.T) {
	maintenanceError := snyk.NewMaintenanceWindowError("")
	err := fmt.Errorf("wrapped: %w", fmt.Errorf("wrapped: %w", maintenanceError))

	actualError := findSnykErrorByCode(err, maintenanceError.ErrorCode, 1)
	assert.Nil(t, actualError)

	actualError = findSnykErrorByCode(err, maintenanceError.ErrorCode, 10)
	assert.NotNil(t, actualError)
}
