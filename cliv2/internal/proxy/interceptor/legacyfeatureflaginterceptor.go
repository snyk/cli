package interceptor

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"

	"github.com/elazarl/goproxy"
	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

const FeatureFlagShowMavenBuildScope = "internal_snyk_show_maven_scope_enabled"
const FeatureFlagShowNpmBuildScope = "internal_snyk_show_npm_scope_enabled"

// generalFeatureFlagConfigKeyPrefix namespaces the configuration keys that cache
// the general (API-backed) feature flags.
//
// Using a dedicated, prefixed key — instead of the flag's own name — is what
// makes the resolution correct: an unset key forces the batch resolver to run
// against the API (see RegisterFeatureFlagDefaults), and when the organization
// cannot be determined that resolver returns an error so the interceptor falls
// back to the network. A key named after the flag could collide with a value
// set elsewhere in the configuration and be served verbatim, silently masking
// the real flag state.
const generalFeatureFlagConfigKeyPrefix = "internal_snyk_legacy_cli_ff_"

// generalFeatureFlagConfigKey returns the configuration key used to cache the
// given general feature flag.
func generalFeatureFlagConfigKey(flag string) string {
	return generalFeatureFlagConfigKeyPrefix + flag
}

// featureFlagConfigKeys maps a feature-flag name (as it appears in a
// /cli-config/feature-flags/<name> URL) to the configuration key its value is
// read from.
//
// show-maven-build-scope and show-npm-scope keep their dedicated override keys,
// which are resolved from config/env and NOT the API — preserving existing
// behaviour. Every other flag in LegacyCLIFeatureFlags maps to a prefixed,
// API-backed key (see RegisterFeatureFlagDefaults), so reading one triggers —
// and process-caches — a single batched API resolution.
var featureFlagConfigKeys = buildFeatureFlagConfigKeys()

func buildFeatureFlagConfigKeys() map[string]string {
	keys := map[string]string{
		"show-maven-build-scope": FeatureFlagShowMavenBuildScope,
		"show-npm-scope":         FeatureFlagShowNpmBuildScope,
	}
	for _, flag := range LegacyCLIFeatureFlags {
		if _, exists := keys[flag]; !exists {
			keys[flag] = generalFeatureFlagConfigKey(flag)
		}
	}
	return keys
}

var featureFlagPath = regexp.MustCompile(`/cli-config/feature-flags/([^/?]+)/?(?:\?.*)?$`)

type legacyFeatureFlagInterceptor struct {
	requestCondition goproxy.ReqCondition
	invocationCtx    workflow.InvocationContext
}

type featureFlagResponse struct {
	OK bool `json:"ok"`
}

func (ni legacyFeatureFlagInterceptor) GetCondition() goproxy.ReqCondition {
	return ni.requestCondition
}

// GetHandler resolves feature-flag lookups from the CLIv2 configuration so the
// legacy CLI does not query the API for each flag. Known flags are answered from
// config, which caches the resolved value for the lifetime of the process.
// Unknown flags — and any whose resolution errors — are passed through to the
// network so the legacy CLI keeps its own behaviour (e.g. auth-error handling).
func (ni legacyFeatureFlagInterceptor) GetHandler() goproxy.FuncReqHandler {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		match := featureFlagPath.FindStringSubmatch(req.URL.Path)
		if len(match) < 2 {
			return req, nil
		}
		configKey, known := featureFlagConfigKeys[match[1]]
		if !known {
			return req, nil
		}

		enabled, err := ni.invocationCtx.GetConfiguration().GetBoolWithError(configKey)
		if err != nil {
			ni.invocationCtx.GetEnhancedLogger().Printf(
				"legacyFeatureFlagInterceptor: resolving %q failed: %v; passing through to network",
				match[1], err)
			return req, nil
		}

		b, err := json.Marshal(featureFlagResponse{OK: enabled})
		if err != nil {
			return req, nil
		}

		resp := &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(b)),
			Request:    req,
		}
		resp.Header.Set("Content-Type", "application/json")
		ni.invocationCtx.GetEnhancedLogger().Printf(
			"legacyFeatureFlagInterceptor response for %s is %v", match[1], enabled)

		return req, resp
	}
}

// RegisterFeatureFlagDefaults registers the API-backed config defaults for the
// general feature flags, so the interceptor can resolve them via the
// configuration (which caches the value for the process). The maven/npm scope
// flags are intentionally left as config/env overrides and are not registered.
//
// All general flags are registered through the batch resolver so the first
// lookup resolves every flag in a single request. When the organization cannot
// be determined the resolver returns an error rather than a default value; the
// interceptor treats that as "pass through to network", so the legacy CLI's own
// per-flag request decides the outcome and the flag is never silently disabled.
func RegisterFeatureFlagDefaults(engine workflow.Engine) {
	configKeyToFlag := map[string]string{}
	for flagName, configKey := range featureFlagConfigKeys {
		if configKey == generalFeatureFlagConfigKey(flagName) {
			configKeyToFlag[configKey] = flagName
		}
	}

	if len(configKeyToFlag) > 0 {
		config_utils.AddFeatureFlagsToConfig(engine, configKeyToFlag)
	}
}

func NewLegacyFeatureFlagInterceptor(invocationCtx workflow.InvocationContext) Interceptor {
	return legacyFeatureFlagInterceptor{
		requestCondition: goproxy.UrlMatches(featureFlagPath),
		invocationCtx:    invocationCtx,
	}
}
