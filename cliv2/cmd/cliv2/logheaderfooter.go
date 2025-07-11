package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/utils"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/fips"
)

func redactAuthorizationTokens(token string) string {
	temp := sha256.Sum256([]byte(token))
	tokenShaSum := fmt.Sprintf("%s***%s", hex.EncodeToString(temp[0:4]), hex.EncodeToString(temp[12:16]))
	return tokenShaSum
}

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
		if tokenType == string(auth.AUTH_TYPE_TOKEN) && auth.IsAuthTypePAT(token) {
			tokenType = string(auth.AUTH_TYPE_PAT)
		}
		tokenShaSum = redactAuthorizationTokens(token)
		tokenDetails = fmt.Sprintf(" (type=%s)", tokenType)
	}

	if config.GetBool(configuration.FF_OAUTH_AUTH_FLOW_ENABLED) {
		oauthEnabled = "Enabled"
		token, err := auth.GetOAuthToken(config)
		if token != nil && err == nil {
			tokenShaSum = redactAuthorizationTokens(token.AccessToken)
			tokenDetails = fmt.Sprintf(" (type=oauth; expiry=%v)", token.Expiry.UTC())
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

func tablePrint(name string, value string) {
	title := name
	if len(name) > 0 {
		title = title + ":"
	}
	globalLogger.Printf("%-22s %s", title, value)
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

	cacheEnabled := "disabled"
	if !config.GetBool(configuration.CONFIG_CACHE_DISABLED) {
		ttl := config.GetDuration(configuration.CONFIG_CACHE_TTL)
		ttlString := "(ttl=no expiration)"
		if ttl > 0 {
			ttlString = fmt.Sprintf(" (ttl=%v)", ttl)
		}
		cacheEnabled = fmt.Sprintf("enabled %s", ttlString)
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
	tablePrint("  request attempts", fmt.Sprintf("%d", config.GetInt(middleware.ConfigurationKeyRetryAttempts)))
	tablePrint("  config cache", cacheEnabled)
	tablePrint("Checks", "")

	sanityCheckResults := config_utils.CheckSanity(config)
	for _, result := range sanityCheckResults {
		tablePrint("  Configuration", result.Description)
	}

	if len(sanityCheckResults) == 0 {
		tablePrint("  Configuration", "all good")
	}
}

func writeLogFooter(exitCode int, errs []error) {
	// output error details
	if exitCode > 1 && len(errs) > 0 {
		ecErrs := formatErrorCatalogErrors(errs)

		for i, err := range ecErrs {
			tablePrint(fmt.Sprintf("Error (%d)", i), fmt.Sprintf("%s (%s)", err.ErrorCode, err.Title))
			tablePrint("  Type", err.Type)
			tablePrint("  Classification", err.Classification)

			// description
			if _, ok := err.Meta["description"]; ok && len(err.Description) == 0 {
				tablePrint("  Description", err.Meta["description"].(string))
			}
			tablePrint("  Description", err.Description)

			// details
			_, hasDetails := err.Meta["details"]
			if hasDetails && len(err.Meta["details"].([]string)) > 0 {
				tablePrint("  Details", "")
				for i, details := range utils.Dedupe(err.Meta["details"].([]string)) {
					tablePrint(fmt.Sprintf("    %d", i), details)
				}
			}

			// links
			if len(err.Links) > 0 {
				tablePrint("  Links", "")
				for i, link := range err.Links {
					tablePrint(fmt.Sprintf("    %d", i), link)
				}
			}

			// requests
			_, hasRequestDetails := err.Meta["requests"]
			if hasRequestDetails && len(err.Meta["requests"].([]string)) > 0 {
				tablePrint("  Requests", "")
				for i, request := range err.Meta["requests"].([]string) {
					tablePrint(fmt.Sprintf("    %d", i), request)
				}
			}
		}
	}
	tablePrint("Interaction", interactionId)
	tablePrint("Exit Code", strconv.Itoa(exitCode))
}

func formatErrorCatalogErrors(errs []error) []snyk_errors.Error {
	var formattedErrs []snyk_errors.Error

	for _, err := range errs {
		var snykError snyk_errors.Error
		if errors.As(err, &snykError) {
			snykError = updateMeta(snykError)

			// Check if an error with the same ErrorCode already exists in formattedErrs
			found := false
			for i, fErr := range formattedErrs {
				if snykError.ErrorCode == fErr.ErrorCode {
					// Merge requests
					formattedErrs[i].Meta["requests"] = append(
						fErr.Meta["requests"].([]string),
						snykError.Meta["requests"].([]string)...,
					)
					// Merge details
					formattedErrs[i].Meta["details"] = append(
						fErr.Meta["details"].([]string),
						snykError.Meta["details"].([]string)...,
					)
					found = true
					break
				}
			}

			// If no matching error was found, append the current error
			if !found {
				formattedErrs = append(formattedErrs, snykError)
			}
		}
	}

	return formattedErrs
}

func updateMeta(err snyk_errors.Error) snyk_errors.Error {
	if err.Meta == nil {
		err.Meta = make(map[string]interface{})
	}

	// add requests meta
	if _, ok := err.Meta["requests"]; !ok {
		err.Meta["requests"] = []string{}
	}
	if requestID, hasID := err.Meta["request-id"]; hasID {
		if requestPath, hasPath := err.Meta["request-path"]; hasPath {
			err.Meta["requests"] = append(
				err.Meta["requests"].([]string),
				fmt.Sprintf("%s - %s", requestID, requestPath),
			)
		}
	}

	// add details meta
	if _, ok := err.Meta["details"]; !ok {
		err.Meta["details"] = []string{}
	}
	err.Meta["details"] = append(err.Meta["details"].([]string), err.Detail)

	return err
}
