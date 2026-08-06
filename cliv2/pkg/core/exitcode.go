package core

import (
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/exitcode"
)

const unsetExitCode = exitcode.UnsetExitCode

func getErrorFromWorkFlowData(engine workflow.Engine, data []workflow.Data) error {
	return exitcode.GetErrorFromWorkFlowData(engine, data)
}

func createErrorWithExitCode(ec int, err error) error {
	return exitcode.CreateErrorWithExitCode(ec, err)
}

func mapErrorToExitCode(err error) int {
	return exitcode.MapErrorToExitCode(err)
}
