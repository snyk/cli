package behavior

import (
	"github.com/snyk/error-catalog-golang-public/aibom"
	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/constants"
)

// MapErrorCatalogToExitCode translates error catalog entries into CLI exit statuses.
//
// # Design philosophy
//
// Adopting a new exit code is an exceptional situation, not the default.
// Because the CLI provides structured JSON output, automation should
// parse the JSON for granular error details (e.g., specific error IDs,
// messages, or metadata).
//
// Exit codes should signal broad categories of error states rather than
// individual scenarios. Ask: "Does a shell script need to branch logic
// based solely on this number?" If the answer is no, use the default (1).
//
// # Public contract and breaking changes
//
// Exit codes constitute a stable public API contract with our customers.
// Modification, reassignment, or removal of existing exit codes is a
// breaking change and must align with the organization's centralized
// versioning and deprecation processes.
//
// Exit code constraints
//
//   - 0: Success.
//   - 1: General Failure (The default for 90% of cases).
//   - 2: CLI Usage Error (Reserved for invalid flags or arguments).
//   - 3-125: Custom Application Logic (Safe range for Snyk-specific errors).
//   - 126-255: Reserved (Used by OS/Shell for execution errors and signals).
//
// # Technical warning
//
// Exit codes are 8-bit integers. Values > 255 will wrap around (modulo 256).
// For example, returning 256 results in a 0 (Success), which is a security risk.
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
