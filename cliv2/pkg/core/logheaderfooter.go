package core

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
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/utils"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking/fips"
)

func redactAuthorizationTokens(token string) string {
	temp := sha256.Sum256([]byte(token))
	tokenShaSum := fmt.Sprintf("%s***%s", hex.EncodeToString(temp[0:4]), hex.EncodeToString(temp[12:16]))
	return tokenShaSum
}

func (r *cliRun) logHeaderAuthorizationInfo() (string, string, string) {
	config := r.config
	networkAccess := r.engine.GetNetworkAccess()
	oauthEnabled := "Disabled"
	var authorization, tokenShaSum, tokenDetails, userAgent string

	apiRequest := &http.Request{
		URL:    config.GetUrl(configuration.API_URL),
		Header: http.Header{},
	}

	err := networkAccess.AddHeaders(apiRequest)
	if err != nil {
		r.logger.Print(err)
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

func (r *cliRun) tablePrint(name string, value string) {
	title := name
	if len(name) > 0 {
		title = title + ":"
	}
	r.logger.Printf("%-22s %s", title, value)
}

func (r *cliRun) writeLogHeader() {
	config := r.config
	authorization, _, userAgent := r.logHeaderAuthorizationInfo()

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

	r.tablePrint("Version", cliv2.GetFullVersion()+" "+buildType)
	r.tablePrint("Platform", userAgent)
	r.tablePrint("API", config.GetString(configuration.API_URL))

	region, err := localworkflows.DetermineRegionFromUrl(config.GetString(configuration.API_URL))
	if err == nil {
		r.tablePrint("Region", region)
	}

	r.tablePrint("Cache", config.GetString(configuration.CACHE_PATH))
	r.tablePrint("Organization", org)
	r.tablePrint("Insecure HTTPS", insecureHTTPS)
	r.tablePrint("Analytics", analytics)
	r.tablePrint("Authorization", authorization)
	r.tablePrint("Interaction", r.interactionId)
	machineID, machineIDErr := r.engine.GetRuntimeInfo().GetMachineID()
	// Any errors are printed below rather than checked here. It is valid to have both a machine ID and an error (e.g., if a machine ID cannot be stored).
	if machineID == "" {
		machineID = "unavailable"
	}
	r.tablePrint("Machine ID", machineID)
	for _, line := range machineIDErrorLines(machineIDErr) {
		r.tablePrint("  Error", strings.ReplaceAll(line, "\n", "; "))
	}
	r.tablePrint("Features", "")
	r.tablePrint("  preview", previewFeaturesEnabled)
	r.tablePrint("  fips", fipsEnabled)
	r.tablePrint("  request attempts", fmt.Sprintf("%d", config.GetInt(middleware.ConfigurationKeyRequestAttempts)))
	r.tablePrint("  config cache", cacheEnabled)
	r.tablePrint("Checks", "")

	sanityCheckResults := config_utils.CheckSanity(config)
	for _, result := range sanityCheckResults {
		r.tablePrint("  Configuration", result.Description)
	}

	if len(sanityCheckResults) == 0 {
		r.tablePrint("  Configuration", "all good")
	}
}

// machineIDErrorLines skips runtimeinfo.ErrNoMachineID because the "unavailable" marker already reports it.
func machineIDErrorLines(err error) []string {
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		var lines []string
		for _, e := range joined.Unwrap() {
			lines = append(lines, machineIDErrorLines(e)...)
		}
		return lines
	}
	if err == nil || errors.Is(err, runtimeinfo.ErrNoMachineID) {
		return nil
	}
	var catalogErr snyk_errors.Error
	if errors.As(err, &catalogErr) {
		return []string{fmt.Sprintf("%s %s: %s", catalogErr.ErrorCode, catalogErr.Title, catalogErr.Detail)}
	}
	return []string{err.Error()}
}

func (r *cliRun) writeLogFooter(exitCode int, errs []error) {
	const maxLength = 100
	r.logger.Print("")
	r.logger.Printf("------------ Summary ------------")
	// to make things easier to find, let's repeat the header before the footer
	r.writeLogHeader()

	// output error details
	ecErrs := formatErrorCatalogErrors(errs)
	if len(ecErrs) > 0 {
		r.logger.Print("")
		r.logger.Printf("------------ Errors ------------")

		for _, err := range ecErrs {
			r.tablePrint(strings.ToUpper(err.Level), fmt.Sprintf("%s (%s)", err.Title, err.ErrorCode))

			description := err.Description
			// description
			if _, ok := err.Meta["description"]; ok && len(description) == 0 {
				tmp, ok := err.Meta["description"].(string)
				if ok {
					description = tmp
				}
			}

			if len(description) > 0 {
				r.logger.Print("  Description:")
				r.tablePrintMaxLength("", description, maxLength)
			}

			// links
			err.Links = append(err.Links, err.Type)
			if len(err.Links) > 0 {
				r.tablePrint("  Links", "")
				for _, link := range err.Links {
					r.tablePrint("", link)
				}
			}

			r.logger.Print("")

			// details
			_, hasDetails := err.Meta["details"]
			if hasDetails && len(err.Meta["details"].([]string)) > 0 {
				for i, details := range utils.Dedupe(err.Meta["details"].([]string)) {
					r.logger.Printf("  Instance %d:", i+1)
					r.tablePrintMaxLength("", details, maxLength)
					r.logger.Print("")
				}
			}

			// requests
			_, hasRequestDetails := err.Meta["requests"]
			if hasRequestDetails && len(err.Meta["requests"].([]string)) > 0 {
				r.tablePrint("  Requests", "")
				for i, request := range err.Meta["requests"].([]string) {
					r.tablePrint(fmt.Sprintf("    %d", i), request)
				}
				r.logger.Print("")
			}
		}
	} else {
		r.logger.Print("")
	}

	r.tablePrint("Exit Code", strconv.Itoa(exitCode))
}

func (r *cliRun) tablePrintMaxLength(name string, value string, maxLength int) {
	for _, inputLine := range strings.Split(value, "\n") {
		tmp := inputLine
		for {
			line := tmp
			if len(tmp) > maxLength {
				line = tmp[:maxLength]
			}
			tmp = tmp[len(line):]
			r.tablePrint("", strings.TrimSpace(line))

			if len(tmp) == 0 {
				break
			}
		}
	}
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
