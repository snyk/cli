package core

import (
	"os"
	"strings"

	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
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
