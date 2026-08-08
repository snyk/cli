package main

import (
	"os"

	"github.com/snyk/ambient-canary/pkg/daemon"
	"github.com/snyk/cli-extension-axi/pkg/agent"
	"github.com/snyk/cli-extension-cos/pkg/cos"
	"github.com/snyk/remy-cli-extension/pkg/remy"
	"github.com/snyk/rift-cli-extension/pkg/rift"

	"github.com/snyk/cli/cliv2/pkg/core"
)

func main() {
	os.Exit(core.Run(
		core.WithAdditionalExtensions(agent.Init),
		core.WithAdditionalExtensions(remy.Init),
		core.WithAdditionalExtensions(cos.Init),
		core.WithAdditionalExtensions(daemon.Init),
		core.WithAdditionalExtensions(rift.Init),
	))
}
