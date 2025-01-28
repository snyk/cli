package main

import (
	"errors"
	"os/exec"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

// decorate generic errors that do not contain Error-Catalog Errors
func decorateError(err error) error {
	if err == nil {
		return nil
	}

	if _, isExitError := err.(*exec.ExitError); isExitError {
		return err
	}

	if _, isErrorWithCode := err.(*cli_errors.ErrorWithExitCode); isErrorWithCode {
		return err
	}

	var errorCatalogError snyk_errors.Error
	if !errors.As(err, &errorCatalogError) {
		genericError := cli.NewGeneralCLIFailureError(err.Error())
		genericError.StatusCode = 0
		err = errors.Join(err, genericError)
	}
	return err
}
