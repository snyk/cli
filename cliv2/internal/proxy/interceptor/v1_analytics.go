package interceptor

import (
	"compress/gzip"
	"fmt"
	"github.com/elazarl/goproxy"
	"io"
	"net/http"
	"os"
	"regexp"
)

// v1AnalyticsInterceptor looks for requests to the (now deprecated) v1 analytics endpoint, and re-directs these
// requests to the v2 analytics service. This is a temporary measure to allow users to migrate to the new service.
type v1AnalyticsInterceptor struct {
	requestCondition goproxy.ReqCondition
	handler          func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response)
}

func v1AnalyticsHandlerFunc(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	reader, err := gzip.NewReader(req.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gzip.NewReader: %v\n", err)
	}
	defer reader.Close()
	bodyBytes, bodyErr := io.ReadAll(reader)
	fmt.Println(string(bodyBytes), bodyErr)

	return req, nil
}

func (v v1AnalyticsInterceptor) GetCondition() (goproxy.ReqCondition, error) {
	if v.requestCondition == nil {
		return nil, fmt.Errorf("request condition is not set")
	}

	return v.requestCondition, nil
}

func (v v1AnalyticsInterceptor) GetHandler() func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	return v.handler
}

func NewV1AnalyticsInterceptor() Interceptor {
	i := v1AnalyticsInterceptor{goproxy.UrlMatches(regexp.MustCompile("^*/v1/analytics/cli")), v1AnalyticsHandlerFunc}
	return i
}
