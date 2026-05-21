package main

import (
	"os"

	"github.com/snyk/remy-cli-extension/pkg/remy"

	"github.com/snyk/cli/cliv2/pkg/runner"
)

func main() {
	os.Exit(runner.Run(
		runner.WithAdditionalExtensions(remy.Init),
	))
}
