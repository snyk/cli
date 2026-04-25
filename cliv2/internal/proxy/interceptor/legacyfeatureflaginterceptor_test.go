package interceptor

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/mocks"

	"github.com/elazarl/goproxy"
	"github.com/stretchr/testify/assert"
)

func TestLegacyFeatureFlagInterceptor_Routing(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		shouldHandle bool
		configKey    string // only used when shouldHandle == true
	}{
		{
			name:         "maven path",
			path:         "https://example.com/v1/cli-config/feature-flags/show-maven-build-scope?org=abc",
			shouldHandle: true,
			configKey:    FeatureFlagShowMavenBuildScope,
		},
		{
			name:         "npm path",
			path:         "https://example.com/v1/cli-config/feature-flags/show-npm-scope?org=abc",
			shouldHandle: true,
			configKey:    FeatureFlagShowNpmBuildScope,
		},
		{
			name:         "other path",
			path:         "https://example.com/api/v1/other-endpoint",
			shouldHandle: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			configMock := mocks.NewMockConfiguration(ctrl)

			// Only expect config access when the interceptor should handle the path.
			if tt.shouldHandle {
				configMock.EXPECT().
					GetBool(tt.configKey).
					Return(true).
					AnyTimes()
			}

			invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
			invocationCtxMock.EXPECT().
				GetConfiguration().
				Return(configMock).
				AnyTimes()

			interceptor := NewLegacyFeatureFlagInterceptor(invocationCtxMock)
			handler := interceptor.GetHandler()

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			proxyCtx := &goproxy.ProxyCtx{}

			matched := interceptor.GetCondition().HandleReq(req, proxyCtx)
			assert.Equal(t, tt.shouldHandle, matched)

			if !tt.shouldHandle {
				return
			}

			logger := zerolog.Nop()
			invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

			_, resp := handler(req, proxyCtx)
			assert.NotNil(t, resp)
			defer func() { _ = resp.Body.Close() }()

			assert.Equal(t, http.StatusOK, resp.StatusCode)
			assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))

			bodyBytes, err := io.ReadAll(resp.Body)
			assert.NoError(t, err)

			var parsed featureFlagResponse
			assert.NoError(t, json.Unmarshal(bodyBytes, &parsed))
			assert.True(t, parsed.OK)
		})
	}
}
