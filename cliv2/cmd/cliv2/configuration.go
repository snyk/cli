package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"os"

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
