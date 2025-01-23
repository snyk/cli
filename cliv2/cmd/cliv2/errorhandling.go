package main

import (
	"errors"
	"os/exec"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

// add a generic error catalog error
func decorateError(err error) error {
	if err == nil {
		return err
	}

	if eErr, isExitError := err.(*exec.ExitError); isExitError && eErr.ExitCode() != constants.SNYK_EXIT_CODE_ERROR {
		return err
	}

	if _, isErrorWithCode := err.(*cli_errors.ErrorWithExitCode); isErrorWithCode {
		return err
	}

	var errorCatalogError snyk_errors.Error
	if !errors.As(err, &errorCatalogError) {
		err = errors.Join(err, cli.NewGeneralCLIFailureError(err.Error()))
	}
	return err
}
