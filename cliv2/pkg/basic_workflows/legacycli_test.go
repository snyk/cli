package basic_workflows

import (
	"context"
	"fmt"
	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/networking"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_finalizeArguments(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_doubleDashNotAppend(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "x"}
	actual := finalizeArguments([]string{"a", "b", "c", "--", "x"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "--proxy-noauth", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

// Test_proxyWithErrorHandler tests if we correctly either set or do not set the "snyk-terminate" header,
// which is a signal to the legacy TypeScript CLI that it should stop trying to send HTTP requests.
func Test_proxyWithErrorHandler(t *testing.T) {
	ctrl := gomock.NewController(t)
	logger := zerolog.Nop()
	config := configuration.NewWithOpts()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	server := httptest.NewServer(handler)
	defer server.Close()

	networkAccess := networking.NewNetworkAccess(config)
	networkAccess.AddErrorHandler(func(err error, _ context.Context) error { return err })

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().GetNetworkAccess().Return(networkAccess).AnyTimes()
	invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

	testCases := []struct {
		name              string
		configureApiUrl   string
		expectedIntercept bool
	}{
		{
			name:              "intercepts traffic based on configuration",
			configureApiUrl:   server.URL,
			expectedIntercept: true,
		},
		{
			name:              "does not intercept external traffic",
			configureApiUrl:   "http://api.snyk.io",
			expectedIntercept: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			config.Set(configuration.API_URL, tc.configureApiUrl)
			wp, err := createInternalProxy(config, &logger, invocationCtxMock)
			assert.Nil(t, err)

			defer wp.Close()

			client := http.Client{Transport: &http.Transport{Proxy: func(*http.Request) (*url.URL, error) {
				return &url.URL{Scheme: "http", Host: fmt.Sprintf("127.0.0.1:%d", wp.ProxyInfo().Port)}, nil
			}}}

			res, err := client.Get(server.URL)
			assert.NotNil(t, res)

			assert.Equal(t, tc.expectedIntercept, res.Header.Get(proxy.HeaderSnykTerminate) == "true")
			assert.Nil(t, err)
		})
	}
}
