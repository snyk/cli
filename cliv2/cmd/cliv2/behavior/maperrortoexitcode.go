package behavior

import (
	"github.com/snyk/error-catalog-golang-public/aibom"
	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/constants"
)

var MapErrorCatalogToExitCode func(err *snyk_errors.Error, defaultValue int) int = mapErrorToExitCode

// mapErrorToExitCode maps error catalog errors to exit codes. Please extend the switch statement if new error codes need to be mapped.
func mapErrorToExitCode(err *snyk_errors.Error, defaultValue int) int {
	var errorCatalogToExitCodeMap = map[string]int{
		code.NewUnsupportedProjectError("").ErrorCode: constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS,
		aibom.NewNoSupportedFilesError("").ErrorCode:  constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS,
		snyk.NewMaintenanceWindowError("").ErrorCode:  constants.SNYK_EXIT_CODE_EX_TEMPFAIL,
		// Add new mappings here
	}

	if exitCode, ok := errorCatalogToExitCodeMap[err.ErrorCode]; ok {
		return exitCode
	}

	return defaultValue
}
