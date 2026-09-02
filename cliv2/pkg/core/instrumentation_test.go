package core

import (
	"context"
	"os"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func Test_sendInstrumentation_passesEngineConfigurationToInstrumentationObject(t *testing.T) {
	globalConfiguration = configuration.NewWithOpts(configuration.WithAutomaticEnv())

	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)

	// The client machine id is real Studio data, not a secret, so it has to come back
	// verbatim rather than as "***".
	machineId := "studio-device-id-abc12345"
	t.Setenv("INTERNAL_SNYK_CLIENT_MACHINE_ID", machineId)
	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())

	// One call from shallSendInstrumentation, one to derive analytics.WithConfiguration.
	// If the call site regresses to only passing WithLogger, this expectation goes unmet.
	mockEngine.EXPECT().GetConfiguration().Return(engineConfig).Times(2)
	mockEngine.EXPECT().Invoke(localworkflows.WORKFLOWID_REPORT_ANALYTICS, gomock.Any(), gomock.Any()).Return(nil, nil)

	instrumentor := analytics.NewInstrumentationCollector()
	addClientMachineId(instrumentor, engineConfig)
	logger := zerolog.Nop()

	sendInstrumentation(context.Background(), mockEngine, instrumentor, &logger)

	// sendInstrumentation just ran the extension through the same scrub chokepoint;
	// re-deriving the object (a pure read, doesn't mutate the collector) proves the
	// machine id survived it rather than coming back "***".
	obj, err := analytics.GetV2InstrumentationObject(instrumentor, analytics.WithConfiguration(engineConfig))
	assert.NoError(t, err)
	assert.Equal(t, machineId, (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
}

// sendOneExtension drives one extension field through the real send path and returns
// the extension as analytics received it. populateRedactionTerms runs first, exactly as
// the --debug path runs it, so any leak of the argv/environment sweep into configuration
// is redacting by the time the payload is built.
func sendOneExtension(t *testing.T, engineConfig configuration.Configuration, key string, value any) map[string]interface{} {
	t.Helper()
	globalConfiguration = configuration.NewWithOpts(configuration.WithAutomaticEnv())

	mockEngine := mocks.NewMockEngine(gomock.NewController(t))
	mockEngine.EXPECT().GetWorkflows().Return([]workflow.Identifier{})
	populateRedactionTerms(engineConfig, mockEngine)

	mockEngine.EXPECT().GetConfiguration().Return(engineConfig).Times(2)
	mockEngine.EXPECT().Invoke(localworkflows.WORKFLOWID_REPORT_ANALYTICS, gomock.Any(), gomock.Any()).Return(nil, nil)

	instrumentor := analytics.NewInstrumentationCollector()
	instrumentor.AddExtension(key, value)
	logger := zerolog.Nop()

	sendInstrumentation(context.Background(), mockEngine, instrumentor, &logger)

	// Re-deriving the object is a pure read, so it reports what sendInstrumentation
	// itself just put through the scrub chokepoint.
	obj, err := analytics.GetV2InstrumentationObject(instrumentor, analytics.WithConfiguration(engineConfig))
	require.NoError(t, err)
	require.NotNil(t, obj.Data.Attributes.Interaction.Extension)
	return *obj.Data.Attributes.Interaction.Extension
}

func Test_sendInstrumentation_keepsValueCollidingWithArgvToken(t *testing.T) {
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "test", "--target-reference", "my-feature-branch"}
	defer func() { os.Args = oldArgs }()

	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	extension := sendOneExtension(t, engineConfig, "legacycli::metadata__targetBranch", "my-feature-branch")

	assert.Equal(t, "my-feature-branch", extension["legacycli::metadata__targetBranch"])
}

func Test_sendInstrumentation_keepsValueCollidingWithEnvironmentValue(t *testing.T) {
	t.Setenv("SNYK_TEST_PLUGIN_MARKER", "snyk-nodejs-lockfile-parser")

	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	extension := sendOneExtension(t, engineConfig, "legacycli::metadata__pluginName", "snyk-nodejs-lockfile-parser")

	assert.Equal(t, "snyk-nodejs-lockfile-parser", extension["legacycli::metadata__pluginName"])
}

func Test_sendInstrumentation_redactsAuthenticationToken(t *testing.T) {
	// Not token-shaped, so only the exact-value layer can catch it.
	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	engineConfig.Set(configuration.AUTHENTICATION_TOKEN, "an-exact-credential-the-cli-holds")

	extension := sendOneExtension(t, engineConfig, "legacycli::metadata__targetBranch", "branch an-exact-credential-the-cli-holds")

	assert.Equal(t, "branch ***", extension["legacycli::metadata__targetBranch"])
}

func Test_sendInstrumentation_redactsTokenShapedValue(t *testing.T) {
	// Nothing in config or argv names this value; the shape pattern is all that stands between
	// it and analytics, and it is the layer this change leans on.
	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())

	extension := sendOneExtension(t, engineConfig, "legacycli::metadata__targetBranch", "ghp_016C7e42F292c6912E7710c838347Ae178B4a")

	assert.Equal(t, "ghp_***", extension["legacycli::metadata__targetBranch"])
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
