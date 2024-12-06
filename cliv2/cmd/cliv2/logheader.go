package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"

	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/fips"

	"github.com/snyk/cli/cliv2/internal/cliv2"
)

func logHeaderAuthorizationInfo(
	config configuration.Configuration,
	networkAccess networking.NetworkAccess,
) (string, string, string) {
	oauthEnabled := "Disabled"
	var authorization, tokenShaSum, tokenDetails, userAgent string

	apiRequest := &http.Request{
		URL:    config.GetUrl(configuration.API_URL),
		Header: http.Header{},
	}

	err := networkAccess.AddHeaders(apiRequest)
	if err != nil {
		globalLogger.Print(err)
	}

	authHeader := apiRequest.Header.Get("Authorization")
	splitHeader := strings.Split(authHeader, " ")
	if len(splitHeader) == 2 {
		tokenType := splitHeader[0]
		token := splitHeader[1]
		temp := sha256.Sum256([]byte(token))
		tokenShaSum = hex.EncodeToString(temp[0:16]) + "[...]"
		tokenDetails = fmt.Sprintf(" (type=%s)", tokenType)
	}

	if config.GetBool(configuration.FF_OAUTH_AUTH_FLOW_ENABLED) {
		oauthEnabled = "Enabled"
		token, err := auth.GetOAuthToken(config)
		if token != nil && err == nil {
			tokenDetails = fmt.Sprintf(" (type=oauth; expiry=%v)", token.Expiry.UTC())
			temp := sha256.Sum256([]byte(token.AccessToken))
			tokenShaSum = hex.EncodeToString(temp[0:16]) + "[...]"
		}
	}

	userAgent = apiRequest.Header.Get("User-Agent")
	platformFromUserAgent := strings.Split(userAgent, " ")
	if len(platformFromUserAgent) > 1 {
		userAgent = strings.Join(platformFromUserAgent[1:], " ")
		r, _ := regexp.Compile("[();]")
		userAgent = strings.TrimSpace(r.ReplaceAllString(userAgent, " "))
	}

	authorization = fmt.Sprintf("%s %s", tokenShaSum, tokenDetails)

	return authorization, oauthEnabled, userAgent
}

func getFipsStatus(config configuration.Configuration) string {
	fipsEnabled := "Disabled"
	if !fips.IsAvailable() {
		fipsEnabled = "Not available"
	} else if config.GetBool(configuration.FIPS_ENABLED) {
		fipsEnabled = "Enabled"
	}
	return fipsEnabled
}

func writeLogHeader(config configuration.Configuration, networkAccess networking.NetworkAccess) {
	authorization, _, userAgent := logHeaderAuthorizationInfo(config, networkAccess)

	org := config.GetString(configuration.ORGANIZATION)
	insecureHTTPS := "false"
	if config.GetBool(configuration.INSECURE_HTTPS) {
		insecureHTTPS = "true"
	}

	analytics := "enabled"
	if config.GetBool(configuration.ANALYTICS_DISABLED) {
		analytics = "disabled"
	}

	previewFeaturesEnabled := "disabled"
	if config.GetBool(configuration.PREVIEW_FEATURES_ENABLED) {
		previewFeaturesEnabled = "enabled"
	}

	tablePrint := func(name string, value string) {
		globalLogger.Printf("%-22s %s", name+":", value)
	}

	fipsEnabled := getFipsStatus(config)

	tablePrint("Version", cliv2.GetFullVersion()+" "+buildType)
	tablePrint("Platform", userAgent)
	tablePrint("API", config.GetString(configuration.API_URL))

	region, err := localworkflows.DetermineRegionFromUrl(config.GetString(configuration.API_URL))
	if err == nil {
		tablePrint("Region", region)
	}

	tablePrint("Cache", config.GetString(configuration.CACHE_PATH))
	tablePrint("Organization", org)
	tablePrint("Insecure HTTPS", insecureHTTPS)
	tablePrint("Analytics", analytics)
	tablePrint("Authorization", authorization)
	tablePrint("Interaction", interactionId)
	tablePrint("Features", "")
	tablePrint("  preview", previewFeaturesEnabled)
	tablePrint("  fips", fipsEnabled)
	tablePrint("Checks", "")

	sanityCheckResults := config_utils.CheckSanity(config)
	for _, result := range sanityCheckResults {
		tablePrint("  Configuration", result.Description)
	}

	if len(sanityCheckResults) == 0 {
		tablePrint("  Configuration", "all good")
	}
}
