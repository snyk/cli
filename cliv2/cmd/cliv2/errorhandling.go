package main

import (
	"errors"
	"github.com/snyk/error-catalog-golang-public/cli"
	"os/exec"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
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
	var errWithMeta error
	if errors.As(err, &errorCatalogError) {
		errWithMeta = middleware.AddMetaDataToErr(errorCatalogError, meta)
	} else {
		genericError := cli.NewGeneralCLIFailureError(err.Error())
		genericError.StatusCode = 0
		errWithMeta = middleware.AddMetaDataToErr(genericError, meta)
	}

	err = errors.Join(err, errWithMeta)
	return err
}
