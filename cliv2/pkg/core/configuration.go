package core

import (
	"os"
	"strings"

	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

func defaultOAuthFF(config configuration.Configuration) configuration.DefaultValueFunction {
	return func(_ configuration.Configuration, existingValue interface{}) (interface{}, error) {
		if _, ok := os.LookupEnv(auth.CONFIG_KEY_OAUTH_TOKEN); ok {
			return true, nil
		}

		keysThatMightDisableOAuth := config.GetAllKeysThatContainValues(configuration.AUTHENTICATION_BEARER_TOKEN)
		alternativeTokenKeys := config.GetAllKeysThatContainValues(configuration.AUTHENTICATION_TOKEN)
		keysThatMightDisableOAuth = append(keysThatMightDisableOAuth, alternativeTokenKeys...)

		for _, key := range keysThatMightDisableOAuth {
			keyType := config.GetKeyType(key)
			if keyType == configuration.EnvVarKeyType {
				return false, nil
			}
		}

		return true, nil
	}
}

func defaultNetworkRequestRetryAllowedPaths() configuration.DefaultValueFunction {
	callback := func(_ configuration.Configuration, existingValue interface{}) (interface{}, error) {
		paths := []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation"}

		if raw, ok := existingValue.(string); ok {
			for _, part := range strings.Split(raw, ",") {
				if trimmed := strings.TrimSpace(part); trimmed != "" {
					paths = append(paths, trimmed)
				}
			}
		} else if strSlice, ok := existingValue.([]string); ok {
			paths = append(paths, strSlice...)
		} else if ifaceSlice, ok := existingValue.([]interface{}); ok {
			for _, v := range ifaceSlice {
				if str, ok := v.(string); ok && str != "" {
					paths = append(paths, str)
				}
			}
		}

		return paths, nil
	}
	return callback
}

// applyStartupValues sets the values that the command line gives the run, and enables the preview feature flags when
// preview features are on, unless the configuration sets them. It is applied to the default configuration before the
// engine is initialized, and to the configuration of the selected profile after the selection, because a profile does
// not carry the values of the default configuration.
func applyStartupValues(config configuration.Configuration) {
	if noProxyAuth := config.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}
	if config.GetBool(configuration.PREVIEW_FEATURES_ENABLED) {
		// TODO: remove once CLI-1733 is solved
		if !config.IsSet(utils.FF_FILE_FILTER_METACHARACTER_FIX) {
			config.Set(utils.FF_FILE_FILTER_METACHARACTER_FIX, true)
		}
		if !config.IsSet(utils.FF_GITIGNORE_RESPECT_TRACKED_FILES) {
			config.Set(utils.FF_GITIGNORE_RESPECT_TRACKED_FILES, true)
		}
	}
}
