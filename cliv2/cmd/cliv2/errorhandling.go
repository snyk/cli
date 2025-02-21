package main

import (
	"errors"
	"iter"
	"os/exec"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/cli/cliv2/internal/cliv2"
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

// getErrorMessage returns the appropriate error message for the specified error. Defaults to the standard error message method,
// but if the error matches the Error Catalog model, the returned value will become the detail field.
func getErrorMessage(err error) string {
	message := err.Error()
	snykErr := snyk_errors.Error{}
	if errors.As(err, &snykErr) {
		message = snykErr.Detail
	}

	return message
}

// errorHasBeenShown return whether the error was already presented by the Typescript CLI or not.
// This will iterate through the error chain to find if any of the errors in the chain has been shown.
func errorHasBeenShown(err error) bool {
	for err := range iterErrorChain(err) {
		snykErr := snyk_errors.Error{}
		if errors.As(err, &snykErr) {
			wasDisplayed, ok := snykErr.Meta[cliv2.ERROR_HAS_BEEN_DISPLAYED].(bool)
			if !ok {
				continue
			}

			// we stop checking the chain if we find an error that was presented already.
			if wasDisplayed {
				return true
			}
		}
	}

	// none of the errors in the chain were presented.
	return false
}

// IterErrorChain returns an iterator with all the errors from the error parameter, including the initial error.
// Taken from this proposal: https://github.com/golang/go/issues/66455
// Eg: errA -> errB -> errC will yield an iterator with the following errors:
// ["errA -> errB -> errC", "errA", "errB", "errC"]
func iterErrorChain(err error) iter.Seq[error] {
	return func(yield func(error) bool) {
		yieldAll(err, yield)
	}
}

// yieldAll is the generator function that walks the error chain.
func yieldAll(err error, yield func(error) bool) bool {
	for err != nil {
		if !yield(err) {
			return false
		}
		switch x := err.(type) {
		case interface{ Unwrap() error }:
			err = x.Unwrap()
		case interface{ Unwrap() []error }:
			for _, err := range x.Unwrap() {
				if !yieldAll(err, yield) {
					return false
				}
			}
			return true
		default:
			return true
		}
	}
	return true
}
