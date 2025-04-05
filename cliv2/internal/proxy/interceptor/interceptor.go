package interceptor

import (
	"github.com/elazarl/goproxy"
	"net/http"
)

type Interceptor interface {
	GetCondition() (goproxy.ReqCondition, error)
	GetHandler() func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response)
}

func GetRegisteredInterceptors() []Interceptor {
	return []Interceptor{
		NewV1AnalyticsInterceptor(),
	}
}
