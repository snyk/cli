package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
	"github.com/snyk/go-application-framework/pkg/apiclients/testapi"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/utils/ufm"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func getErrorFromWorkFlowData(engine workflow.Engine, data []workflow.Data) error {
	if data == nil {
		return nil
	}

	var err error
	exitCode := constants.SNYK_EXIT_CODE_OK

	for _, item := range data {
		if item == nil {
			continue
		}

		// Handle UFM results - these take precedence
		if ufmExitCode := handleUFMResult(item); ufmExitCode != constants.SNYK_EXIT_CODE_OK {
			exitCode = ufmExitCode
			break // UFM result is the ultimate exit code
		}

		// Handle test summary
		if testSummaryExitCode, testSummaryErr := handleTestSummary(engine, item); testSummaryErr != nil {
			return testSummaryErr
		} else if testSummaryExitCode != constants.SNYK_EXIT_CODE_OK {
			exitCode = testSummaryExitCode
		}

		// Handle data errors (only if no exit code set yet)
		if exitCode == constants.SNYK_EXIT_CODE_OK {
			if dataErrExitCode, dataErr := handleDataErrors(item); dataErr != nil {
				err = dataErr
				exitCode = dataErrExitCode
			}
		}
	}

	return createErrorWithExitCode(exitCode, err)
}

// handleUFMResult processes UFM test results and returns the appropriate exit code
func handleUFMResult(data workflow.Data) int {
	testResult := ufm.GetTestResultsFromWorkflowData(data)
	if testResult == nil {
		return constants.SNYK_EXIT_CODE_OK
	}

	passFail := testResult[0].GetPassFail()
	if passFail == nil {
		return constants.SNYK_EXIT_CODE_OK
	}

	if *passFail == testapi.Fail {
		return constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND
	}
	return constants.SNYK_EXIT_CODE_OK
}

// handleTestSummary processes test summary data and returns the appropriate exit code
func handleTestSummary(engine workflow.Engine, data workflow.Data) (int, error) {
	if !strings.EqualFold(data.GetContentType(), content_type.TEST_SUMMARY) {
		return constants.SNYK_EXIT_CODE_OK, nil
	}

	payload, ok := data.GetPayload().([]byte)
	if !ok {
		return 0, fmt.Errorf("invalid payload type: %T", data.GetPayload())
	}

	var summary json_schemas.TestSummary
	if err := json.Unmarshal(payload, &summary); err != nil {
		return 0, fmt.Errorf("failed to parse test summary payload: %w", err)
	}

	engine.GetAnalytics().GetInstrumentation().SetTestSummary(summary)

	// Check if any results have open vulnerabilities
	for _, result := range summary.Results {
		if result.Open > 0 {
			return constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, nil
		}
	}

	return constants.SNYK_EXIT_CODE_OK, nil
}

// handleDataErrors processes data errors and returns the appropriate exit code and error
func handleDataErrors(data workflow.Data) (int, error) {
	for _, dataError := range data.GetErrorList() {
		if dataError.ErrorCode == "SNYK-CODE-0006" {
			return constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS, dataError
		}
	}
	return constants.SNYK_EXIT_CODE_OK, nil
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
