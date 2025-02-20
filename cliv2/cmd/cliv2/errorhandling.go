package main

import (
	"errors"
	"os/exec"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
)

// decorate generic errors that do not contain Error-Catalog Errors
func decorateError(err error, meta map[string]any) error {
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
	if errors.As(err, &errorCatalogError) {
		for k, v := range meta {
			snyk_errors.WithMeta(k, v)(&errorCatalogError)
		}

		// Rebuild the error chain, replacing the original errorCatalogError
		var newErr error = errorCatalogError
		current := err
		for current != nil {
			if current.Error() == errorCatalogError.Error() {
				current = errors.Unwrap(current)
				continue
			}
			newErr = errors.Join(newErr, current)
			current = errors.Unwrap(current)
		}

		return newErr
	}

	genericError := cli.NewGeneralCLIFailureError(err.Error())
	genericError.StatusCode = 0

	for k, v := range meta {
		snyk_errors.WithMeta(k, v)(&genericError)
	}

	return errors.Join(err, genericError)
}
