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

func (ni networkInjector) GetHandler() HandlerFunc {
	return func(req *http.Request, proxyCtx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		resp, err := ni.invocationCtx.GetNetworkAccess().GetRoundTripper().RoundTrip(req)
		if err != nil {
			ni.invocationCtx.GetEnhancedLogger().Printf("unable to add v1 analytics to the instrumentation data. Failed to read intercepted request body: %v", err)
			return req, nil
		}
		ni.invocationCtx.GetEnhancedLogger().Printf("sent something")
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
