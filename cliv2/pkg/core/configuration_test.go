package core

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/stretchr/testify/assert"

	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

// Test_applyStartupValues_proxyNoAuth: with PROXY_NOAUTH the proxy authentication mechanism is NoAuth, without it the
// mechanism is left as it is.
func Test_applyStartupValues_proxyNoAuth(t *testing.T) {
	noAuth := httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth)

	t.Run("with PROXY_NOAUTH the mechanism is NoAuth", func(t *testing.T) {
		config := configuration.NewWithOpts()
		config.Set(basic_workflows.PROXY_NOAUTH, true)

		applyStartupValues(config)

		assert.Equal(t, noAuth, config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM))
	})

	t.Run("without PROXY_NOAUTH the mechanism is untouched", func(t *testing.T) {
		config := configuration.NewWithOpts()
		config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, "untouched")

		applyStartupValues(config)

		assert.Equal(t, "untouched", config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM))
	})
}
