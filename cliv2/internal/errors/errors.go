package cli_errors

import "fmt"

type ErrorWithExitCode struct {
	ExitCode int
}

func (e ErrorWithExitCode) Error() string {
	return fmt.Sprintf("exit code: %d", e.ExitCode)
}
