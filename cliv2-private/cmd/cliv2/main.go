package main

import (
	"os"

	"github.com/snyk/remy-cli-extension/pkg/remy"

	"github.com/snyk/cli/cliv2/pkg/core"
)

func main() {
	os.Exit(core.Run(
		core.WithAdditionalExtensions(remy.Init),
	))
}
