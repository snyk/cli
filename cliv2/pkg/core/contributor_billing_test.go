package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/clibilling"
	"github.com/snyk/go-application-framework/pkg/configuration"
)

func Test_beginContributorBilling_noOpWhenCaptureDisabled(t *testing.T) {
	t.Parallel()

	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(configuration.NewWithOpts()))
	ctx := beginContributorBilling(context.Background(), engine, configuration.NewWithOpts())
	assert.Nil(t, clibilling.FromContext(ctx))
}

func Test_beginContributorBilling_attachesBagWhenCaptureEnabled(t *testing.T) {
	t.Parallel()

	config := configuration.NewWithOpts()
	config.Set(configuration.INPUT_DIRECTORY, []string{"/tmp/repo"})
	engine := clibilling.EnableIfConfigured(
		app.CreateAppEngineWithOptions(
			app.WithConfiguration(config),
			app.WithContributorBillingCapture(),
		),
	)

	ctx := beginContributorBilling(context.Background(), engine, config)
	assert.NotNil(t, clibilling.FromContext(ctx))
}

func Test_finishContributorBilling_noOpWhenCaptureDisabled(t *testing.T) {
	t.Parallel()

	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(configuration.NewWithOpts()))
	finishContributorBilling(context.Background(), engine, configuration.NewWithOpts(), true)
}
