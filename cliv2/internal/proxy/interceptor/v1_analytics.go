package interceptor

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"

	"github.com/snyk/cli/cliv2/internal/utils"

	"github.com/elazarl/goproxy"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

// excludedKeys contains a list of v1 analytics keys that is already present in the v2 payload and should thus not be added
var excludedKeys = []string{
	"args",
	"ci",
	"command",
	"durationMs",
	"error",
	"error-message",
	"iac-terraform-plan",
	"id",
	"integrationEnvironment",
	"integrationEnvironmentVersion",
	"integrationName",
	"integrationVersion",
	"metrics",
	"nodeVersion",
	"os",
	"osArch",
	"osPlatform",
	"osRelease",
	"platform",
	"standalone",
	"version",
}

// v1AnalyticsInterceptor looks for requests to the (now deprecated) v1 analytics endpoint, and re-directs these
// requests to the v2 analytics service. This is a temporary measure to allow users to migrate to the new service.
type v1AnalyticsInterceptor struct {
	requestCondition goproxy.ReqCondition
	invocationCtx    workflow.InvocationContext
}

func (v v1AnalyticsInterceptor) GetCondition() goproxy.ReqCondition {
	return v.requestCondition
}

// flattenAnalyticsPayload transforms nested JSON into a flat structure with prefixed keys
func (v v1AnalyticsInterceptor) flattenAnalyticsPayload(bodyBytes []byte) (map[string]interface{}, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		return nil, fmt.Errorf("parsing JSON: %w", err)
	}

	// Create a flat map with prefixed keys
	flatMap := make(map[string]interface{})
	if data, ok := payload["data"].(map[string]interface{}); ok {
		v.flattenObject(flatMap, data, "")
	} else {
		return nil, fmt.Errorf("found no 'data' object in the request body")
	}

	return flatMap, nil
}

// flattenObject recursively flattens a nested JSON structure
func (v v1AnalyticsInterceptor) flattenObject(result map[string]interface{}, obj map[string]interface{}, parentKey string) {
	for k, val := range obj {
		if utils.Contains(excludedKeys, k) {
			continue
		}

		newParentKey := k
		if parentKey != "" {
			newParentKey = parentKey + "__" + k
		}

		switch value := val.(type) {
		// The analytics service does not accept `null` values, so we skip them entirely
		case nil:
			continue
		case map[string]interface{}:
			// For nested objects, recurse with the current key as parent
			v.flattenObject(result, value, newParentKey)
		case []interface{}:
			// The v2 analytics endpoint only accepts strings, integers, or booleans. So we must stringify arrays, floats and the like.
			// Should this ever change in the future, just remove this entire case statement.
			result[newParentKey] = fmt.Sprintf("%v", value)
		default:
			result[newParentKey] = value
		}
	}
}

func (v v1AnalyticsInterceptor) GetHandler() goproxy.FuncReqHandler {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		bodyBytesGzipped, err := io.ReadAll(req.Body)
		if err != nil {
			v.invocationCtx.GetEnhancedLogger().Printf("unable to add v1 analytics to the instrumentation data. Failed to read intercepted request body: %v", err)
			return req, nil
		}

		// Since reading the body will consume it, we need to reset the body to its original state
		req.Body = io.NopCloser(bytes.NewBuffer(bodyBytesGzipped))
		r, err := gzip.NewReader(bytes.NewBuffer(bodyBytesGzipped))
		if err != nil {
			v.invocationCtx.GetEnhancedLogger().Printf("unable to add v1 analytics to the instrumentation data. Failed to call gzip.NewReader: %v", err)
			return req, nil
		}

		defer r.Close()

		bodyBytes, err := io.ReadAll(r)
		if err != nil {
			v.invocationCtx.GetEnhancedLogger().Printf("unable to add v1 analytics to the instrumentation data. Error when trying to read the request body: %v", err)
			return req, nil
		}

		flattened, err := v.flattenAnalyticsPayload(bodyBytes)
		if err != nil {
			v.invocationCtx.GetEnhancedLogger().Printf("unable to add v1 analytics to the instrumentation data. Failed to flatten analytics object: %v", err)
			return req, nil
		}

		// Add each key-value pair to the "extension" object of the analytics instrumentation
		for key, val := range flattened {
			switch p := val.(type) {
			case string:
				v.invocationCtx.GetAnalytics().AddExtensionStringValue(key, val.(string))
			case int:
				v.invocationCtx.GetAnalytics().AddExtensionIntegerValue(key, val.(int))
			case bool:
				v.invocationCtx.GetAnalytics().AddExtensionBoolValue(key, val.(bool))
			default:
				v.invocationCtx.GetEnhancedLogger().Warn().Msgf("Cannot add value of type %v", p)
			}
		}

		return req, nil
	}
}

func NewV1AnalyticsInterceptor(invocationCtx workflow.InvocationContext) Interceptor {
	i := v1AnalyticsInterceptor{
		requestCondition: goproxy.UrlMatches(regexp.MustCompile("^*/v1/analytics/cli")),
		invocationCtx:    invocationCtx,
	}
	return i
}
