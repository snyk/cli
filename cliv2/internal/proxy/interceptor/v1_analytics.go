package interceptor

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"github.com/elazarl/goproxy"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"io"
	"net/http"
	"regexp"
)

// v1AnalyticsInterceptor looks for requests to the (now deprecated) v1 analytics endpoint, and re-directs these
// requests to the v2 analytics service. This is a temporary measure to allow users to migrate to the new service.
type v1AnalyticsInterceptor struct {
	requestCondition goproxy.ReqCondition
	debugLogger      *zerolog.Logger
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
		v.flattenObject(flatMap, data, "v1", "")
	} else {
		return nil, fmt.Errorf("found no 'data' object in the request body")
	}

	return flatMap, nil
}

// flattenObject recursively flattens a nested JSON structure
func (v v1AnalyticsInterceptor) flattenObject(result map[string]interface{}, obj map[string]interface{}, prefix string, parentKey string) {
	for k, val := range obj {
		newKey := prefix + "-" + k
		if parentKey != "" {
			newKey = prefix + "-" + parentKey + "-" + k
		}

		switch value := val.(type) {
		case map[string]interface{}:
			// For nested objects, recurse with the current key as parent
			v.flattenObject(result, value, prefix, k)
		case []interface{}:
			// The v2 analytics endpoint only accepts strings, integers, or booleans. So we must stringify arrays, floats and the like.
			// Should this ever change in the future, just remove this entire case statement.
			result[newKey] = fmt.Sprintf("%v", value)
		default:
			result[newKey] = value
		}
	}
}

func (v v1AnalyticsInterceptor) GetHandler() HandlerFunc {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		r, err := gzip.NewReader(req.Body)
		if err != nil {
			v.debugLogger.Printf(fmt.Sprintf("gzip.NewReader: %v", err))
			return req, nil
		}

		// Not really using the buffer, but it allows us to spy on the req.Body without consuming the stream.
		var buf bytes.Buffer
		tee := io.TeeReader(r, &buf)

		defer r.Close()

		bodyBytes, err := io.ReadAll(tee)
		if err != nil {
			v.debugLogger.Printf(fmt.Sprintf("Error reading body: %v", err))
			return req, nil
		}

		flattened, err := v.flattenAnalyticsPayload(bodyBytes)
		if err != nil {
			v.debugLogger.Printf(fmt.Sprintf("gzip.NewReader: %v", err))
			return req, nil
		}

		// Add each key-value pair to the "extension" object of the analytics instrumentation
		for key, val := range flattened {
			v.invocationCtx.GetAnalytics().GetInstrumentation().AddExtension(key, val)
		}

		return req, nil
	}
}

func NewV1AnalyticsInterceptor(invocationCtx workflow.InvocationContext, debugLogger *zerolog.Logger) Interceptor {
	i := v1AnalyticsInterceptor{
		requestCondition: goproxy.UrlMatches(regexp.MustCompile("^*/v1/analytics/cli")),
		debugLogger:      debugLogger,
		invocationCtx:    invocationCtx,
	}
	return i
}
