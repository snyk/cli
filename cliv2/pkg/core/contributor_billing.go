package core

import (
	"context"
	"strings"
	"sync"

	"github.com/snyk/go-application-framework/pkg/clibilling"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

var (
	commandBillingMu       sync.Mutex
	commandBillingBag      *clibilling.Capture
	commandBillingRepoPath string
)

func beginContributorBilling(ctx context.Context, config configuration.Configuration) context.Context {
	commandBillingMu.Lock()
	commandBillingBag = clibilling.NewCapture()
	commandBillingRepoPath = billingRepoPath(config)
	commandBillingMu.Unlock()
	return clibilling.WithCapture(ctx, commandBillingBag)
}

func finishContributorBilling(
	ctx context.Context,
	engine workflow.Engine,
	config configuration.Configuration,
	success bool,
) {
	commandBillingMu.Lock()
	bag := commandBillingBag
	repoPath := commandBillingRepoPath
	commandBillingBag = nil
	commandBillingRepoPath = ""
	commandBillingMu.Unlock()

	opts := clibilling.FinishOptionsFromConfig(config, engine)
	opts.RepoPath = repoPath
	clibilling.Finish(ctx, bag, opts, success)
}

func billingRepoPath(config configuration.Configuration) string {
	dirs := config.GetStringSlice(configuration.INPUT_DIRECTORY)
	if len(dirs) > 0 && strings.TrimSpace(dirs[0]) != "" {
		return dirs[0]
	}
	return "."
}
