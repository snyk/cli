package interceptor

import (
	"github.com/elazarl/goproxy"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"net/http"
	"regexp"
)

type networkInjector struct {
	requestCondition goproxy.ReqCondition
	invocationCtx    workflow.InvocationContext
}

func (ni networkInjector) GetCondition() goproxy.ReqCondition {
	return ni.requestCondition
}

// GetHandler for networkinjector will re-route all requests from the proxy to the existing networking layer.
// This ensures that we can implement network-layer logic centrally instead of having logic for the legacycli
// and the gocli in two different places.
func (ni networkInjector) GetHandler() goproxy.FuncReqHandler {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		resp, err := ni.invocationCtx.GetNetworkAccess().GetRoundTripper().RoundTrip(req)
		if err != nil {
			ni.invocationCtx.GetEnhancedLogger().Trace().Msgf("intercepting call failed with error: %v", err)

			// We use goproxy's context to store the error, which we use later in the handling of all legacycli responses.
			proxyCtx.Error = err

			// Returning a non-nil response is a signal to goproxy that it should not use its own RoundTripper to relay the request.
			return req, resp
		}
		return req, resp
	}
}

func NewNetworkInjector(invocationCtx workflow.InvocationContext) Interceptor {
	i := networkInjector{
		requestCondition: goproxy.UrlMatches(regexp.MustCompile(".*")),
		invocationCtx:    invocationCtx,
	}
	return i
}
