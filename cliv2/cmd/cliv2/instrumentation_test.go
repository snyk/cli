package main

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
