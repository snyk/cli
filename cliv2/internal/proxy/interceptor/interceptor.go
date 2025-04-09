package interceptor

import (
	"github.com/elazarl/goproxy"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"net/http"
)

type HandlerFunc func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response)

// Interceptor is an interface that defines self-registering MITM-style handlers
// for interacting with requests send to the go proxy from the legacy CLI.
// Add a new interceptor by implementing the Interceptor interface and adding it to
// the GetRegisteredInterceptors function.
type Interceptor interface {
	GetHandler() HandlerFunc
	GetCondition() goproxy.ReqCondition
}

func GetRegisteredInterceptors(invocationCtx workflow.InvocationContext, debugLogger *zerolog.Logger) []Interceptor {
	return []Interceptor{
		NewV1AnalyticsInterceptor(invocationCtx, debugLogger),
	}
}
