package interceptor

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"

	"github.com/elazarl/goproxy"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

const FeatureFlagShowMavenBuildScope = "internal_snyk_show_maven_scope_enabled"
const FeatureFlagShowNpmBuildScope = "internal_snyk_show_npm_scope_enabled"

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

// GetHandler for legacyFeatureFlagInterceptor will re-route all registry requests from the proxy to the configured feature flag values.
// This ensures that we can control feature flag values for the legacy CLI from the CLIv2 configuration.
// Currently, only the "show-maven-build-scope" and "show-npm-scope" feature flags are supported.
func (ni legacyFeatureFlagInterceptor) GetHandler() goproxy.FuncReqHandler {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		ni.invocationCtx.GetEnhancedLogger().Printf("legacyFeatureFlagInterceptor handling request for %s", req.URL.Path)
		var configKey string
		switch req.URL.Path {
		case "/v1/cli-config/feature-flags/show-maven-build-scope":
			configKey = FeatureFlagShowMavenBuildScope
		case "/v1/cli-config/feature-flags/show-npm-scope":
			configKey = FeatureFlagShowNpmBuildScope
		default:
			return req, nil
		}

		enabled := ni.invocationCtx.
			GetConfiguration().
			GetBool(configKey)

		payload := featureFlagResponse{OK: enabled}
		b, err := json.Marshal(payload)
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
		ni.invocationCtx.GetEnhancedLogger().Printf("legacyFeatureFlagInterceptor response for %s is %v", configKey, enabled)

		return req, resp
	}
}

func NewLegacyFeatureFlagInterceptor(invocationCtx workflow.InvocationContext) Interceptor {
	i := legacyFeatureFlagInterceptor{
		requestCondition: goproxy.UrlMatches(
			regexp.MustCompile(`/cli-config/feature-flags/(show-maven-build-scope|show-npm-scope)/?(?:\?.*)?$`),
		),
		invocationCtx: invocationCtx,
	}
	return i
}
