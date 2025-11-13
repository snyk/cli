package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/go-application-framework/pkg/apiclients/testapi"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/utils/ufm"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

const unsetExitCode = -1

// getErrorFromWorkFlowData processes the given workflow data and returns an error with the appropriate exit code.
//
// The decision matrix is as follows:
//
// UFM Pass | UFM Fail | Test Summary Pass | Test Summary Fail | DataErrors | ExitCode
// ?        | Y        | ?                 | ?                 | ?           | 1
// Y        | N        | ?                 | ?                 | ?           | 0
// N        | N        | N                 | Y                 | ?           | 1
// N        | N        | Y                 | N                 | N           | 0
// N        | N        | N                 | N                 | Y           | 3
//
// Legend: Y = Yes, N = No, ? = Don't care/any value
//
// The function works in the following steps:
// 1. Check all UFM results - if ANY fail, exit 1 immediately
// 2. If any UFM passed (and none failed), exit 0 regardless of other conditions
// 3. Check test summary for open issues (only if no UFM results)
// 4. Check for data errors (only if no UFM and no test summary issues)
// 5. No issues found, exit 0
func getErrorFromWorkFlowData(engine workflow.Engine, data []workflow.Data) error {
	if data == nil {
		return nil
	}

	// Step 1: Check all UFM results - if ANY fail, exit 1 immediately
	hasUFMPass := false
	for _, item := range data {
		if item == nil {
			continue
		}
		ufmExitCode := handleUFMResult(item)
		if ufmExitCode == constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND {
			return createErrorWithExitCode(ufmExitCode, nil)
		}
		if ufmExitCode == constants.SNYK_EXIT_CODE_OK {
			hasUFMPass = true
		}
	}

	// Step 2: If any UFM passed (and none failed), exit 0 regardless of other conditions
	if hasUFMPass {
		return nil
	}

	// Step 3: Check test summary for open issues (only if no UFM results)
	for _, item := range data {
		if item == nil {
			continue
		}
		if testSummaryExitCode, testSummaryErr := handleTestSummary(engine, item); testSummaryErr != nil {
			return testSummaryErr
		} else if testSummaryExitCode == constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND {
			return createErrorWithExitCode(testSummaryExitCode, nil)
		}
	}

	// Step 4: Check for data errors (only if no UFM and no test summary issues)
	for _, item := range data {
		if item == nil {
			continue
		}
		if dataErrExitCode, dataErr := handleDataErrors(item); dataErr != nil {
			return createErrorWithExitCode(dataErrExitCode, dataErr)
		}
	}

	// Step 5: No issues found, exit 0
	return nil
}

// handleUFMResult processes UFM test results and returns the appropriate exit code
func handleUFMResult(data workflow.Data) int {
	testResult := ufm.GetTestResultsFromWorkflowData(data)
	if len(testResult) == 0 {
		return unsetExitCode
	}

	ufmPass := false

	for _, t := range testResult {
		if passFail := t.GetPassFail(); passFail != nil {
			if *passFail == testapi.Fail {
				return constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND
			} else {
				ufmPass = true
			}
		}
	}

	if ufmPass {
		return constants.SNYK_EXIT_CODE_OK
	}

	return unsetExitCode
}

// handleTestSummary processes test summary data and returns the appropriate exit code
func handleTestSummary(engine workflow.Engine, data workflow.Data) (int, error) {
	if !strings.EqualFold(data.GetContentType(), content_type.TEST_SUMMARY) {
		return unsetExitCode, nil
	}

	payload, ok := data.GetPayload().([]byte)
	if !ok {
		return unsetExitCode, fmt.Errorf("invalid payload type: %T", data.GetPayload())
	}

	var summary json_schemas.TestSummary
	if err := json.Unmarshal(payload, &summary); err != nil {
		return unsetExitCode, fmt.Errorf("failed to parse test summary payload: %w", err)
	}

	engine.GetAnalytics().GetInstrumentation().SetTestSummary(summary)

	// Check if any results have open vulnerabilities
	for _, result := range summary.Results {
		if result.Open > 0 {
			return constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, nil
		}
	}

	return unsetExitCode, nil
}

// handleDataErrors processes data errors and returns the appropriate exit code and error
func handleDataErrors(data workflow.Data) (int, error) {
	for _, dataError := range data.GetErrorList() {
		if dataError.ErrorCode == code.NewUnsupportedProjectError("").ErrorCode {
			return constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS, dataError
		}
	}
	return unsetExitCode, nil
}

// createErrorWithExitCode creates an error with exit code if needed
func createErrorWithExitCode(exitCode int, err error) error {
	if exitCode <= constants.SNYK_EXIT_CODE_OK {
		return nil
	}

	errorWithExitCode := &cli_errors.ErrorWithExitCode{
		ExitCode: exitCode,
	}

	if err == nil {
		return errorWithExitCode
	}
	return errors.Join(err, errorWithExitCode)
}
