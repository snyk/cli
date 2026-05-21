package main

import (
	"os"

	"github.com/snyk/cli/cliv2/pkg/runner"
)

func main() {
	os.Exit(runner.Run())
}
