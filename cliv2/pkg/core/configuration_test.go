package core

import (
	"testing"

	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

func Test_defaultOAuthFF(t *testing.T) {
	newConfig := func() configuration.Configuration {
		config := configuration.NewWithOpts(
			configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_"),
		)
		config.AddAlternativeKeys(configuration.AUTHENTICATION_TOKEN, []string{"snyk_token", "snyk_cfg_api", "api"})
		config.AddAlternativeKeys(configuration.AUTHENTICATION_BEARER_TOKEN, []string{"snyk_oauth_token", "snyk_docker_token"})
		return config
	}

	evaluate := func(config configuration.Configuration) bool {
		value, err := defaultOAuthFF()(config, nil)
		require.NoError(t, err)
		enabled, ok := value.(bool)
		require.True(t, ok)
		return enabled
	}

	t.Run("env token storage forces OAuth on when visible", func(t *testing.T) {
		t.Setenv(auth.CONFIG_KEY_OAUTH_TOKEN, `{"access_token":"x"}`)
		assert.True(t, evaluate(newConfig()))
	})

	t.Run("ignored env token storage under profile does not force OAuth on", func(t *testing.T) {
		// With both storage and SNYK_TOKEN in the process env, os.LookupEnv would still
		// force OAuth on. Through config, ignored storage lets SNYK_TOKEN disable it.
		t.Setenv(auth.CONFIG_KEY_OAUTH_TOKEN, `{"access_token":"x"}`)
		t.Setenv("SNYK_TOKEN", "api-token")
		config := configuration.NewWithOpts(
			configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_"),
			configuration.WithIgnoredEnvVars(auth.CONFIG_KEY_OAUTH_TOKEN),
		)
		config.AddAlternativeKeys(configuration.AUTHENTICATION_TOKEN, []string{"snyk_token", "snyk_cfg_api", "api"})
		assert.False(t, evaluate(config))
		assert.Empty(t, config.GetAllKeysThatContainValues(auth.CONFIG_KEY_OAUTH_TOKEN))
	})

	t.Run("env SNYK_TOKEN forces OAuth off when visible", func(t *testing.T) {
		t.Setenv("SNYK_TOKEN", "api-token")
		assert.False(t, evaluate(newConfig()))
	})

	t.Run("ignored SNYK_TOKEN under profile does not force OAuth off", func(t *testing.T) {
		t.Setenv("SNYK_TOKEN", "api-token")
		config := configuration.NewWithOpts(
			configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_"),
			configuration.WithIgnoredEnvVars("SNYK_TOKEN"),
		)
		config.AddAlternativeKeys(configuration.AUTHENTICATION_TOKEN, []string{"snyk_token", "snyk_cfg_api", "api"})
		assert.True(t, evaluate(config))
		assert.Empty(t, config.GetAllKeysThatContainValues(configuration.AUTHENTICATION_TOKEN))
	})
}

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
