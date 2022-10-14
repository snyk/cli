package utils

import (
	"fmt"

	"github.com/snyk/go-application-framework/pkg/configuration"
)

func GetAuthHeader(config configuration.Configuration) string {

	bearerToken := config.GetString(configuration.AUTHENTICATION_BEARER_TOKEN)
	if len(bearerToken) > 0 {
		return fmt.Sprintf("Bearer %s", bearerToken)
	}

	token := config.GetString(configuration.AUTHENTICATION_TOKEN)
	if len(token) > 0 {
		return fmt.Sprintf("token %s", token)
	}

	return ""
}
