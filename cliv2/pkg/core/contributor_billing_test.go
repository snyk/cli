package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/go-application-framework/pkg/clibilling"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func Test_beginContributorBilling_attachesBagToContext(t *testing.T) {
	t.Parallel()

	config := configuration.NewWithOpts()
	config.Set(configuration.INPUT_DIRECTORY, []string{"/tmp/repo"})

	ctx := beginContributorBilling(context.Background(), config)
	assert.NotNil(t, clibilling.FromContext(ctx))
}

func Test_finishContributorBilling_clearsActiveBag(t *testing.T) {
	t.Parallel()

	config := configuration.NewWithOpts()
	engine := workflow.NewDefaultWorkFlowEngine()
	engine.SetConfiguration(config)

	ctx := beginContributorBilling(context.Background(), config)
	finishContributorBilling(ctx, engine, config, false)
}

func Test_billingRepoPath(t *testing.T) {
	t.Parallel()

	config := configuration.NewWithOpts()
	assert.Equal(t, ".", billingRepoPath(config))

	config.Set(configuration.INPUT_DIRECTORY, []string{"/tmp/repo"})
	assert.Equal(t, "/tmp/repo", billingRepoPath(config))
}
