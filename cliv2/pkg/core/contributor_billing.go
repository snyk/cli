package core

import (
	"context"

	"github.com/snyk/go-application-framework/pkg/clibilling"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func beginContributorBilling(
	ctx context.Context,
	engine workflow.Engine,
	config configuration.Configuration,
) context.Context {
	captureEngine, ok := clibilling.AsCaptureEngine(engine)
	if !ok {
		return ctx
	}
	return captureEngine.BeginContributorCommandFromConfig(ctx, config)
}

func finishContributorBilling(
	ctx context.Context,
	engine workflow.Engine,
	config configuration.Configuration,
	success bool,
) {
	captureEngine, ok := clibilling.AsCaptureEngine(engine)
	if !ok {
		return
	}
	captureEngine.FinishContributorCommand(
		ctx,
		clibilling.FinishOptionsFromConfig(config, engine),
		success,
	)
}
