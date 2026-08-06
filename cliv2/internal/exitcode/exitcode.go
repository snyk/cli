package exitcode

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/apiclients/testapi"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/utils/ufm"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/cmd/cliv2/behavior"
	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

const UnsetExitCode = -1

// GetErrorFromWorkFlowData processes the given workflow data and returns an error with the appropriate exit code.
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
func GetErrorFromWorkFlowData(engine workflow.Engine, data []workflow.Data) error {
	if data == nil {
		return nil
	}

	hasUFMPass := false
	for _, item := range data {
		if item == nil {
			continue
		}
		ufmExitCode := handleUFMResult(item)
		if ufmExitCode == constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND {
			return CreateErrorWithExitCode(ufmExitCode, nil)
		}
		if ufmExitCode == constants.SNYK_EXIT_CODE_OK {
			hasUFMPass = true
		}
	}

	if hasUFMPass {
		return nil
	}

	for _, item := range data {
		if item == nil {
			continue
		}
		if testSummaryExitCode, testSummaryErr := handleTestSummary(engine, item); testSummaryErr != nil {
			return testSummaryErr
		} else if testSummaryExitCode == constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND {
			return CreateErrorWithExitCode(testSummaryExitCode, nil)
		}
	}

	for _, item := range data {
		if item == nil {
			continue
		}
		if dataErrExitCode, dataErr := handleDataErrors(item); dataErr != nil {
			return CreateErrorWithExitCode(dataErrExitCode, dataErr)
		}
	}

	return nil
}

func handleUFMResult(data workflow.Data) int {
	testResult := ufm.GetTestResultsFromWorkflowData(data)
	if len(testResult) == 0 {
		return UnsetExitCode
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

	return UnsetExitCode
}

func handleTestSummary(engine workflow.Engine, data workflow.Data) (int, error) {
	if !strings.EqualFold(data.GetContentType(), content_type.TEST_SUMMARY) {
		return UnsetExitCode, nil
	}

	payload, ok := data.GetPayload().([]byte)
	if !ok {
		return UnsetExitCode, fmt.Errorf("invalid payload type: %T", data.GetPayload())
	}

	var summary json_schemas.TestSummary
	if err := json.Unmarshal(payload, &summary); err != nil {
		return UnsetExitCode, fmt.Errorf("failed to parse test summary payload: %w", err)
	}

	engine.GetAnalytics().GetInstrumentation().SetTestSummary(summary)

	for _, result := range summary.Results {
		if result.Open > 0 {
			return constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, nil
		}
	}

	return UnsetExitCode, nil
}

func handleDataErrors(data workflow.Data) (int, error) {
	for _, dataError := range data.GetErrorList() {
		if ec := MapErrorToExitCode(dataError); ec != UnsetExitCode {
			return ec, dataError
		}
	}
	return UnsetExitCode, nil
}

func CreateErrorWithExitCode(ec int, err error) error {
	if ec <= constants.SNYK_EXIT_CODE_OK {
		return nil
	}

	errorWithExitCode := &cli_errors.ErrorWithExitCode{
		ExitCode: ec,
	}

	if err == nil {
		return errorWithExitCode
	}
	return errors.Join(err, errorWithExitCode)
}

// MapErrorToExitCode maps specific errors to an exit code. Unmapped errors will return UnsetExitCode.
func MapErrorToExitCode(err error) int {
	exitCodeError := cli_errors.ErrorWithExitCode{}
	var exitError *exec.ExitError
	if errors.Is(err, exitCodeError) || errors.As(err, &exitError) {
		return UnsetExitCode
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return constants.SNYK_EXIT_CODE_EX_UNAVAILABLE
	}

	errCatalogError := snyk_errors.Error{}
	if errors.As(err, &errCatalogError) {
		return behavior.MapErrorCatalogToExitCode(&errCatalogError, UnsetExitCode)
	}

	return UnsetExitCode
}
