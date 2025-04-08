package interceptor

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"github.com/elazarl/goproxy"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"io"
	"net/http"
	"regexp"
)

// v1AnalyticsInterceptor looks for requests to the (now deprecated) v1 analytics endpoint, and re-directs these
// requests to the v2 analytics service. This is a temporary measure to allow users to migrate to the new service.
type v1AnalyticsInterceptor struct {
	requestCondition goproxy.ReqCondition
}

func (v v1AnalyticsInterceptor) GetCondition() goproxy.ReqCondition {
	return v.requestCondition
}

func (v v1AnalyticsInterceptor) GetHandler(ctx workflow.InvocationContext) HandlerFunc {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		r, err := gzip.NewReader(req.Body)
		if err != nil {
			ctx.GetLogger().Printf(fmt.Sprintf("gzip.NewReader: %v", err))
			return req, nil
		}

		// Not really using the buffer, but it allows us to spy on the req.Body without consuming the stream.
		var buf bytes.Buffer
		tee := io.TeeReader(r, &buf)

		defer r.Close()

		bodyBytes, bodyErr := io.ReadAll(tee)
		if bodyErr != nil {
			ctx.GetLogger().Printf(fmt.Sprintf("Error reading body: %v", bodyErr))
			return req, nil
		}
		ctx.GetLogger().Printf(string(bodyBytes))

		return req, nil
	}
}

func NewV1AnalyticsInterceptor() Interceptor {
	i := v1AnalyticsInterceptor{
		requestCondition: goproxy.UrlMatches(regexp.MustCompile("^*/v1/analytics/cli")),
	}
	return i
}
