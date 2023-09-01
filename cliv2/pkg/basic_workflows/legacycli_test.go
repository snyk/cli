package basic_workflows

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/stretchr/testify/assert"
)

func Test_DisableLegacyCLIAnalyticsViaConfig(t *testing.T) {
	var err error
	config := configuration.NewInMemory()
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(config))
	engine.AddExtensionInitializer(Init)
	err = engine.Init()
	assert.Nil(t, err)

	config.Set(configuration.ANALYTICS_DISABLED, true)
	config.Set(configuration.RAW_CMD_ARGS, []string{"woof"})

	_, _ = engine.Invoke(WORKFLOWID_LEGACY_CLI)

	// TODO find a good way the test
}
