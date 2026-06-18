package core

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/stretchr/testify/assert"
)

func Test_shallSendInstrumentation(t *testing.T) {
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	instrumentor := analytics.NewInstrumentationCollector()

	// case: nothing configured
	actual := shallSendInstrumentation(config, instrumentor)
	assert.True(t, actual)

	// case: any command called from an IDE
	config.Set(configuration.INTEGRATION_NAME, "VS_CODE")
	actual = shallSendInstrumentation(config, instrumentor)
	assert.False(t, actual)

	// case: analytics report command called from an IDE
	instrumentor.SetCategory([]string{"analytics", "report", "inputData"})
	actual = shallSendInstrumentation(config, instrumentor)
	assert.False(t, actual)
}

func Test_addClientMachineId(t *testing.T) {
	t.Run("emits studio::client_machine_id when INTERNAL_SNYK_CLIENT_MACHINE_ID env var is set", func(t *testing.T) {
		// Mirrors how Studio sets the env var before exec'ing the snyk binary
		// (studio-internal/.../scan_worker.py: env["INTERNAL_SNYK_CLIENT_MACHINE_ID"] = _machine_id)
		// and the prod config in cliv2/pkg/core/main.go uses WithSupportedEnvVarPrefixes("snyk_", "internal_", ...)
		t.Setenv("INTERNAL_SNYK_CLIENT_MACHINE_ID", "studio-device-id-abc")
		config := configuration.NewWithOpts(
			configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"),
		)
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		assert.NotNil(t, obj.Data.Attributes.Interaction.Extension)
		assert.Equal(t, "studio-device-id-abc", (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
	})

	t.Run("emits studio::client_machine_id when config key is set directly", func(t *testing.T) {
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		config.Set("internal_snyk_client_machine_id", "test-machine-123")
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		assert.NotNil(t, obj.Data.Attributes.Interaction.Extension)
		assert.Equal(t, "test-machine-123", (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
	})

	t.Run("omits studio::client_machine_id when env var and config are empty", func(t *testing.T) {
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		if obj.Data.Attributes.Interaction.Extension != nil {
			_, present := (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"]
			assert.False(t, present)
		}
	})
}
