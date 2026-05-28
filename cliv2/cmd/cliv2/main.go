package main

import (
	"os"

	"github.com/snyk/cli/cliv2/pkg/core"
)

// main is the entry point for the CLI application.
// * To register public workflows, see pkg/core/workflows.go
// * To register private workflows, see /cliv2-private/cmd/cliv2/main.go
func main() {
	os.Exit(core.Run())
}
