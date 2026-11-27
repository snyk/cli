package proxy_test

import (
	"encoding/base64"
	"net/http"
	"regexp"
	"sync/atomic"
	"testing"

	"github.com/elazarl/goproxy"
	"github.com/elazarl/goproxy/ext/auth"
	gafAuth "github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/proxy"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

type authInjectingInterceptor struct{ handler goproxy.FuncReqHandler }

func (i authInjectingInterceptor) GetHandler() goproxy.FuncReqHandler { return i.handler }
func (i authInjectingInterceptor) GetCondition() goproxy.ReqCondition {
	return goproxy.UrlMatches(regexp.MustCompile(".*"))
}

func Test_proxy_interceptorUrlAndAuthInjection(t *testing.T) {
	tests := []struct {
		name           string
		requestUrl     string
		additionalUrls []string
		expectedAuth   string
	}{
		{name: "api host on the default port", requestUrl: "https://api.snyk.io/v1/foo", expectedAuth: "token"},
		{name: "api host with explicit default port", requestUrl: "https://api.snyk.io:443/v1/foo", expectedAuth: "token"},
		{name: "additional url without port matches default port", requestUrl: "https://extra.example.test/api/x", additionalUrls: []string{"https://extra.example.test/api"}, expectedAuth: "token"},
		{name: "additional url with explicit port matches", requestUrl: "https://extra.example.test:8443/api/x", additionalUrls: []string{"https://extra.example.test:8443/api"}, expectedAuth: "token"},
		{name: "additional url with explicit default port does not match a port-less request", requestUrl: "https://extra.example.test/api/x", additionalUrls: []string{"https://extra.example.test:443/api"}, expectedAuth: ""},
		{name: "unrelated host gets no auth", requestUrl: "https://other.example.test/x", expectedAuth: ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			config := configuration.NewWithOpts()
			config.Set(configuration.API_URL, "https://api.snyk.io")
			config.Set(configuration.AUTHENTICATION_ADDITIONAL_URLS, tc.additionalUrls)

			var seen atomic.Pointer[http.Request]
			next := roundTripperFunc(func(req *http.Request) (*http.Response, error) {
				seen.Store(req)
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody, Request: req}, nil
			})
			authMiddleware := middleware.NewAuthHeaderMiddleware(config, gafAuth.NewTokenAuthenticator(func() string { return "token" }), next)

			wp := newProxy(t, false)
			wp.RegisterInterceptor(authInjectingInterceptor{handler: func(req *http.Request, _ *goproxy.ProxyCtx) (*http.Request, *http.Response) {
				resp, err := authMiddleware.RoundTrip(req)
				assert.NoError(t, err)
				return req, resp
			}})
			require.NoError(t, wp.Start())
			t.Cleanup(wp.Close)
			client, _ := newCountingClient(t, wp)

			result := fetch(t, client, tc.requestUrl, false)

			assert.Equal(t, http.StatusOK, result.statusCode)
			intercepted := seen.Load()
			require.NotNil(t, intercepted)
			assert.Equal(t, tc.requestUrl, intercepted.URL.String())
			assert.Equal(t, tc.expectedAuth, intercepted.Header.Get("Authorization"))
		})
	}
}

func Test_proxy_handleConnect(t *testing.T) {
	wp := newProxy(t, false)
	connectContext := func(password string) *goproxy.ProxyCtx {
		req, err := http.NewRequest(http.MethodConnect, "https://api.snyk.io:443", nil)
		require.NoError(t, err)
		credentials := base64.StdEncoding.EncodeToString([]byte(proxy.PROXY_USERNAME + ":" + password))
		req.Header.Set("Proxy-Authorization", "Basic "+credentials)
		return &goproxy.ProxyCtx{Req: req}
	}

	action, _ := wp.HandleConnect("api.snyk.io:443", connectContext(wp.ProxyInfo().Password))
	require.NotNil(t, action)
	assert.EqualValues(t, goproxy.ConnectMitm, action.Action)

	action, _ = wp.HandleConnect("api.snyk.io:443", connectContext("wrong"))
	require.NotNil(t, action)
	assert.EqualValues(t, goproxy.ConnectReject, action.Action)
}

func Test_ext_basicConnectReturnsOkConnectOnSuccess(t *testing.T) {
	ctx := &goproxy.ProxyCtx{Req: &http.Request{Header: http.Header{"Proxy-Authorization": {"Basic " + base64.StdEncoding.EncodeToString([]byte("u:p"))}}}}

	action, _ := auth.BasicConnect("", func(string, string) bool { return true }).HandleConnect("host:443", ctx)

	assert.Same(t, goproxy.OkConnect, action, "WrapperProxy.HandleConnect only MITMs when the ext auth handler returns goproxy.OkConnect; a newer ext that returns nil would silently skip MITM")
}
